import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowRight, Check } from "lucide-react";
import { getConversation } from "@/lib/public.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Conversation, ConversationContent, ConversationScrollButton } from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import { PromptInput, PromptInputTextarea, PromptInputFooter, PromptInputSubmit } from "@/components/ai-elements/prompt-input";
import { Tool, ToolHeader, ToolContent, ToolInput, ToolOutput } from "@/components/ai-elements/tool";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { money, timeIn, whenIn } from "@/lib/format";

export type Booking = NonNullable<Awaited<ReturnType<typeof getConversation>>>["booking"];
export type Service = { id: string; name: string; description: string | null; list_price: number; duration_minutes: number; is_addon: boolean };

const TOOL_LABEL: Record<string, string> = { "tool-quote": "Prepared your quote", "tool-check_availability": "Checked available times", "tool-negotiate": "Worked out an offer", "tool-hold_slot": "Held your time", "tool-recall_customer": "Checked your details", "tool-escalate_to_owner": "Checking with the owner" };

export function ReceptionChat({ id, initial, vendorName, services, initialBooking, ask, currency, timeZone }: { currency: string; timeZone: string; ask?: string | undefined; id: string; initial: UIMessage[]; vendorName: string; services: Service[]; initialBooking: Booking | null }) {
  const load = useServerFn(getConversation);
  const [booking, setBooking] = useState<Booking | null>(initialBooking);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const { messages, sendMessage, status, setMessages, stop, error } = useChat({
    id,
    messages: initial,
    transport: new DefaultChatTransport({ api: "/api/chat", body: { conversationId: id }, headers: async () => {
      const { data } = await supabase.auth.getSession();
      return data.session?.access_token ? { Authorization: `Bearer ${data.session.access_token}` } : {};
    } }),
    onError: (e) => toast.error(e.message),
    onFinish: () => { void refresh(); inputRef.current?.focus(); },
  });
  const busy = status === "submitted" || status === "streaming";

  async function refresh() {
    const r = await load({ data: { id } });
    if (!r) return;
    setBooking(r.booking);
    if (r.messages.length > messages.length && !busy) setMessages(r.messages as unknown as UIMessage[]);
  }
  useEffect(() => { void refresh(); const t = setInterval(() => { void refresh(); }, 8000); return () => clearInterval(t); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!busy) inputRef.current?.focus(); }, [busy]);

  function send(text: string) {
    if (!text.trim() || busy) return;
    void sendMessage({ text: text.trim() });
    inputRef.current?.focus();
  }

  const asked = useRef(false);
  useEffect(() => { if (ask && !asked.current && initial.length === 0) { asked.current = true; send(ask); } }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const holdActive = booking?.status === "awaiting_deposit" && booking.hold_expires_at && new Date(booking.hold_expires_at) > new Date();

  return <>
    <Conversation className="min-h-0 flex-1">
      <ConversationContent className="mx-auto w-full max-w-2xl gap-5 px-5 py-6 md:px-7">
        {messages.length === 0 && <div className="py-6">
          <span className="grid size-12 place-items-center rounded-full bg-secondary font-display text-xl text-primary">{vendorName.charAt(0)}</span>
          <h3 className="mt-5 font-display text-2xl font-semibold">Hello, welcome to {vendorName}.</h3>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">What are you looking to book? Tell me your date, location or budget and we’ll find what works.</p>
          <div className="mt-6 flex flex-wrap gap-2">{services.filter(s => !s.is_addon).slice(0, 3).map(s => <Button key={s.id} type="button" variant="outline" size="sm" onClick={() => send(`Hi, I'd like to book ${s.name}.`)} className="h-auto whitespace-normal py-2 text-left">{s.name} <ArrowRight className="size-3"/></Button>)}</div>
        </div>}
        {messages.map((m, i) => <Message key={m.id || `m${i}`} from={m.role}>
          {m.role === "assistant" && <p className="text-xs font-medium text-muted-foreground">{m.metadata && (m.metadata as { by?: string }).by === "owner" ? vendorName : `${vendorName} reception`}</p>}
          {m.parts.map((part, j) => {
            if (part.type === "text") return <MessageContent key={j} className={m.role === "user" ? "!bg-primary !text-primary-foreground" : ""}><MessageResponse>{part.text}</MessageResponse></MessageContent>;
            if (part.type.startsWith("tool-")) {
              const t = part as { type: string; state: "input-streaming" | "input-available" | "output-available" | "output-error"; input?: unknown; output?: unknown; errorText?: string };
              return <Tool key={j} defaultOpen={false} className="my-0 max-w-md border-border bg-background"><ToolHeader title={TOOL_LABEL[t.type] || "Checking details"} type={t.type as `tool-${string}`} state={t.state} /><ToolContent>{t.input != null && <ToolInput input={t.input} />}{(t.output != null || t.errorText) && <ToolOutput output={t.output} errorText={t.errorText} />}</ToolContent></Tool>;
            }
            return null;
          })}
        </Message>)}
         {status === "submitted" && <div className="text-sm text-muted-foreground"><Shimmer>{`${vendorName} reception is replying…`}</Shimmer></div>}
        {error && <p role="alert" className="text-sm text-destructive">{error.message}</p>}
        {holdActive && booking && <div className="border-l-2 border-primary bg-secondary p-5">
          <p className="text-xs font-semibold uppercase text-primary">Time held until {timeIn(booking.hold_expires_at, timeZone)}</p>
          <p className="mt-1 font-display text-xl font-semibold">{whenIn(booking.start_at, timeZone)}</p>
          <p className="mt-1 text-sm text-muted-foreground">Total {money(booking.total_price, currency)} · Deposit to arrange {money(booking.deposit_amount, currency)}</p>
          <p className="mt-3 text-sm">Arrange payment directly with {vendorName}. Your appointment is confirmed only when the business verifies it.</p>
        </div>}
        {booking?.status === "confirmed" && <div className="border-l-2 border-success bg-secondary p-5"><p className="flex items-center gap-2 font-display text-xl font-semibold"><Check className="size-5 text-success"/> You’re booked</p><p className="mt-1 text-sm text-muted-foreground">{whenIn(booking.start_at, timeZone)} · {money(booking.total_price, currency)}</p></div>}
        {booking?.status === "expired" && <p className="text-sm text-muted-foreground">Your held time expired. Ask me for another available time.</p>}
      </ConversationContent>
      <ConversationScrollButton />
    </Conversation>
    <div className="border-t border-border px-4 py-3 md:px-7">
      <PromptInput onSubmit={({ text }) => { send(text); setDraft(""); }} className="mx-auto max-w-2xl border-border bg-background shadow-none">
        <PromptInputTextarea ref={inputRef} autoFocus placeholder="Ask about a service, date or price…" onChange={e => setDraft(e.target.value)} className="min-h-10 text-base" />
        <PromptInputFooter className="justify-end"><PromptInputSubmit status={status} onStop={stop} disabled={!busy && !draft.trim()} className="size-8" /></PromptInputFooter>
      </PromptInput>
    </div>
  </>;
}
