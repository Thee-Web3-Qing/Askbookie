import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { getOwnerConversation, ownerReply, updateConversation } from "@/lib/owner.functions";
import { MessageBubble } from "@/components/MessageBubble";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { money, STATUS_LABEL, whenIn, timeIn } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/business/$slug/messages/$id")({
  head: () => ({ meta: [{ title: "Conversation — Bookie dashboard" }, { name: "description", content: "Review and take over a customer conversation." }, { property: "og:title", content: "Conversation — Bookie dashboard" }, { property: "og:description", content: "Review and take over a customer conversation." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: Conversation,
});

type Action = "pause_ai" | "resume_ai" | "resolve" | "mark_paid" | "waive_deposit" | "cancel" | "complete";

function Conversation() {
  const { id, slug } = Route.useParams();
  const fetchConvo = useServerFn(getOwnerConversation);
  const reply = useServerFn(ownerReply);
  const update = useServerFn(updateConversation);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["convo", id], queryFn: () => fetchConvo({ data: { slug, id } }), refetchInterval: 6000 });
  const [text, setText] = useState("");
  const [acting, setActing] = useState(false);

  async function act(action: Action) {
    if (acting) return;
    setActing(true);
    try { await update({ data: { slug, id, action } }); await qc.invalidateQueries(); toast.success(action === "mark_paid" || action === "waive_deposit" ? "Appointment confirmed" : "Done"); } catch (e) { toast.error((e as Error).message); }
    finally { setActing(false); }
  }
  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    try { await reply({ data: { slug, id, text } }); setText(""); await qc.invalidateQueries({ queryKey: ["convo", id] }); } catch (err) { toast.error((err as Error).message); }
  }

  if (isLoading || !data) return <p className="text-muted-foreground">Loading…</p>;
  const c = data.convo;
  const svc = (c as { services?: { name: string } | null }).services?.name;

  return (
    <>
      <Link to="/business/$slug/messages" params={{ slug }} className="text-sm text-muted-foreground hover:text-foreground">← Back to messages</Link>
       <div className="mt-4 grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-6">
         <section className="order-2 flex min-h-[60vh] min-w-0 flex-col rounded-md border border-border bg-muted/40 lg:order-1">
          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {data.messages.length === 0 && <p className="text-sm text-muted-foreground">No messages yet.</p>}
            {data.messages.map((m) => <MessageBubble key={m.id} m={m.ui_message as never} view="owner" />)}
          </div>
          <form onSubmit={send} className="flex gap-2 border-t border-border bg-card p-3">
            <Input className="min-w-0" value={text} onChange={(e) => setText(e.target.value)} placeholder={c.ai_paused ? "Reply as yourself…" : "Type to take over from the desk…"} />
            <Button className="shrink-0" type="submit">Send</Button>
          </form>
        </section>

         <aside className="order-1 flex min-w-0 flex-col gap-3 lg:order-2 lg:gap-4">
           <div className="rounded-md border border-border bg-card p-4 lg:p-5">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
              <h2 className="min-w-0 break-words font-display text-2xl">{c.customer_name || "New customer"}</h2>
              <Badge variant="secondary" className="max-w-28 whitespace-normal text-center sm:max-w-none">{STATUS_LABEL[c.status] ?? c.status}</Badge>
            </div>
            {c.customer_phone && <a href={`https://wa.me/${c.customer_phone.replace(/\D/g, "").replace(/^0/, "234")}`} target="_blank" rel="noreferrer" className="text-sm text-primary underline">{c.customer_phone} · WhatsApp</a>}
             <details className="mt-3 lg:hidden"><summary className="cursor-pointer text-sm font-medium text-primary">Booking details</summary><dl className="mt-3 space-y-2 text-sm">
               {[
                 ["Service", svc], ["When", whenIn(c.start_at, data.timezone)], ["Party", c.party_size > 1 ? `${c.party_size} people` : null],
                 ["Where", c.service_mode === "home" ? `Home · ${c.location_area}` : c.service_mode], ["Agreed price", c.agreed_price ? money(c.agreed_price, data.currency) : null],
                 ["Total", c.total_price ? money(c.total_price, data.currency) : null], ["Deposit", c.deposit_amount ? `${money(c.deposit_amount, data.currency)}${c.deposit_paid_at ? " · paid" : ""}` : null],
                 ["Hold until", c.status === "awaiting_deposit" ? timeIn(c.hold_expires_at, data.timezone) : null], ["Haggle rounds", c.negotiation_rounds || null],
               ].filter(([, v]) => v).map(([k, v]) => <div key={k as string} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-3"><dt className="text-muted-foreground">{k}</dt><dd className="min-w-0 break-words text-right font-medium capitalize">{v}</dd></div>)}
             </dl></details>
             <dl className="mt-4 hidden space-y-2 text-sm lg:block">
              {[
                ["Service", svc], ["When", whenIn(c.start_at, data.timezone)], ["Party", c.party_size > 1 ? `${c.party_size} people` : null],
                ["Where", c.service_mode === "home" ? `Home · ${c.location_area}` : c.service_mode], ["Agreed price", c.agreed_price ? money(c.agreed_price, data.currency) : null],
                ["Total", c.total_price ? money(c.total_price, data.currency) : null], ["Deposit", c.deposit_amount ? `${money(c.deposit_amount, data.currency)}${c.deposit_paid_at ? " · paid" : ""}` : null],
                ["Hold until", c.status === "awaiting_deposit" ? timeIn(c.hold_expires_at, data.timezone) : null], ["Haggle rounds", c.negotiation_rounds || null],
              ].filter(([, v]) => v).map(([k, v]) => (
                <div key={k as string} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-3"><dt className="min-w-0 text-muted-foreground">{k}</dt><dd className="min-w-0 break-words text-right font-medium capitalize">{v}</dd></div>
              ))}
            </dl>
          </div>
          {c.escalation_reason && (
            <div className="rounded-md border-2 border-gold bg-gold/10 p-4 text-sm">
              <p className="font-semibold">Needs your decision</p>
              <p className="mt-1">{c.escalation_reason}</p>
            </div>
          )}
           <div className="grid grid-cols-2 gap-2 rounded-md border border-border bg-card p-3 lg:grid-cols-1 lg:p-4 [&>button]:h-auto [&>button]:min-h-9 [&>button]:whitespace-normal">
            {c.ai_paused ? <Button variant="outline" onClick={() => act("resume_ai")}>Hand back to the desk</Button> : <Button variant="outline" onClick={() => act("pause_ai")}>Take over (pause desk)</Button>}
            {c.bucket === "needs_you" && <Button onClick={() => act("resolve")}>Mark decision handled</Button>}
            {c.status === "awaiting_deposit" && c.hold_expires_at && new Date(c.hold_expires_at) > new Date() && <>
                <p className="col-span-2 text-sm text-muted-foreground lg:col-span-1">Check your own payment records first. Bookie does not collect or verify payments.</p>
               <AlertDialog><AlertDialogTrigger asChild><Button disabled={acting}>Confirm deposit received</Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Confirm this deposit?</AlertDialogTitle><AlertDialogDescription>Only confirm after checking that {money(c.deposit_amount, data.currency)} arrived in your account. A customer receipt alone is not proof of payment.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Go back</AlertDialogCancel><AlertDialogAction onClick={() => void act("mark_paid")}>Yes, I verified it</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
               <Button variant="outline" disabled={acting} onClick={() => act("waive_deposit")}>Waive deposit & confirm</Button>
             </>}
            {c.status === "confirmed" && <Button variant="outline" onClick={() => act("complete")}>Mark completed</Button>}
             {!["cancelled", "completed"].includes(c.status) && <Button variant="ghost" className="col-span-2 text-destructive lg:col-span-1" onClick={() => act("cancel")}>Cancel booking</Button>}
          </div>
        </aside>
      </div>
    </>
  );
}
