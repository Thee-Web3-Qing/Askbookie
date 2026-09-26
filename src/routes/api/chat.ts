import { createFileRoute } from "@tanstack/react-router";
import { createOpenAI } from "@ai-sdk/openai";
import { convertToModelMessages, createUIMessageStream, createUIMessageStreamResponse, stepCountIs, streamText, type UIMessage } from "ai";
import { z } from "zod";

const Body = z.object({ conversationId: z.string().uuid(), slug: z.string().max(80).optional(), messages: z.array(z.object({ role: z.string(), parts: z.array(z.object({ type: z.string(), text: z.string().optional() }).passthrough()) }).passthrough()).min(1).max(100) });

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const parsed = Body.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return new Response("Bad request", { status: 400 });
        const { conversationId } = parsed.data;
        const messages = parsed.data.messages as unknown as UIMessage[];
        const apiKey = process.env["LOVABLE_API_KEY"];
        if (!apiKey) return new Response("AI not configured", { status: 500 });

        const { supabaseAdmin: admin } = await import("@/integrations/supabase/client.server");
        const bearer = request.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
        if (!bearer) return new Response("Sign in to continue", { status: 401 });
        const { data: identity, error: authError } = await admin.auth.getUser(bearer);
        if (authError || !identity.user) return new Response("Sign in to continue", { status: 401 });
        const { data: owned } = await admin.from("conversations").select("id, vendor_id").eq("id", conversationId).eq("customer_id", identity.user.id).maybeSingle();
        if (!owned) return new Response("This conversation is unavailable", { status: 403 });
        const { loadContext, buildInstructions, buildTools } = await import("@/lib/agent.server");
        const { createLovableAiGatewayRunIdFetch, getLovableAiGatewayRunId, withLovableAiGatewayRunIdHeader } = await import("@/lib/ai/run-id.server");

        let ctx;
        try { ctx = await loadContext(admin, conversationId); } catch { return new Response("Not found", { status: 404 }); }

        const last = messages[messages.length - 1];
        if (!last || last.role !== "user") return new Response("Send a customer message", { status: 400 });
        const text = last.parts.filter((part) => part.type === "text").map((part) => part.text ?? "").join("\n").trim();
        if (!text || text.length > 4000) return new Response("Send a message under 4,000 characters", { status: 400 });
        const { data: stored } = await admin.from("messages").select("role, ui_message").eq("conversation_id", conversationId).order("created_at");
        const history = (stored ?? []).map((m) => m.ui_message as unknown as UIMessage);
        const canonicalUser: UIMessage = { id: `user_${crypto.randomUUID()}`, role: "user", parts: [{ type: "text", text }] };
        {
          const { error } = await admin.from("messages").insert({ conversation_id: conversationId, role: "user", ui_message: canonicalUser as never });
          if (error) return new Response("Could not save message", { status: 500 });
          await admin.from("conversations").update({ updated_at: new Date().toISOString() }).eq("id", conversationId);
        }

        const { data: canReply } = await admin.rpc("ai_can_reply", { _vendor: ctx.vendor.id });
        if (!canReply && !ctx.convo.ai_paused) {
          // Wallet is empty: pause the receptionist and hand the chat to the owner.
          const notice: UIMessage = { id: `sys_${crypto.randomUUID()}`, role: "assistant", metadata: { by: "owner" }, parts: [{ type: "text", text: "Thanks for your message. The business will reply shortly." }] };
          await admin.from("messages").insert({ conversation_id: conversationId, role: "owner", ui_message: notice as never });
          await admin.from("conversations").update({ ai_paused: true, bucket: "needs_you", escalation_reason: "Receptionist paused: your Bookie wallet is empty. Top up or reply yourself." }).eq("id", conversationId);
          const stream = createUIMessageStream({ execute: ({ writer }) => { writer.write({ type: "start", messageId: notice.id }); writer.write({ type: "text-start", id: "t" }); writer.write({ type: "text-delta", id: "t", delta: "Thanks for your message. The business will reply shortly." }); writer.write({ type: "text-end", id: "t" }); writer.write({ type: "finish" }); }, originalMessages: [...history, canonicalUser] });
          return createUIMessageStreamResponse({ stream });
        }

        if (ctx.convo.ai_paused) {
          const stream = createUIMessageStream({ execute: () => {}, originalMessages: [...history, canonicalUser] });
          return createUIMessageStreamResponse({ stream });
        }

        const isFirstReply = !history.some((m) => m.role === "assistant");
        const runIdFetch = createLovableAiGatewayRunIdFetch(getLovableAiGatewayRunId(request));
        const provider = createOpenAI({
          baseURL: "https://ai.gateway.lovable.dev/v1",
          apiKey,
          headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
          fetch: runIdFetch.fetch,
        });
        // Only send customer/assistant turns to the model; owner messages become assistant turns.
        const modelHistory = [...history, canonicalUser].map((m) => ({ ...m, role: m.role === "user" ? "user" : "assistant" })) as UIMessage[];
        const result = streamText({
          model: provider.responses("openai/gpt-6-astra"),
          maxRetries: 0,
          instructions: buildInstructions(ctx.vendor, ctx.services, ctx.convo),
          messages: await convertToModelMessages(modelHistory),
          tools: buildTools(admin, ctx),
          stopWhen: stepCountIs(50),
          abortSignal: request.signal,
          providerOptions: {
            openai: { forceReasoning: true, reasoningEffort: "low", reasoningSummary: "auto", store: false, include: ["reasoning.encrypted_content"] },
          },
        });
        const response = result.toUIMessageStreamResponse({
           originalMessages: [...history, canonicalUser],
          generateMessageId: () => `asst_${crypto.randomUUID()}`,
          onFinish: async ({ responseMessage }) => {
            const { error } = await admin.from("messages").insert({ conversation_id: conversationId, role: "assistant", ui_message: { ...responseMessage, id: responseMessage.id || `asst_${crypto.randomUUID()}` } as never });
            if (error) console.error("save assistant message failed", error);
            const { error: usageError } = await admin.rpc("record_ai_reply", { _vendor: ctx.vendor.id });
            if (usageError) console.error("record usage failed", usageError);
            if (isFirstReply) await admin.from("events").insert({ vendor_id: ctx.vendor.id, conversation_id: conversationId, kind: "inquiry_answered" });
          },
        });
        return withLovableAiGatewayRunIdHeader(response, runIdFetch);
      },
    },
  },
});
