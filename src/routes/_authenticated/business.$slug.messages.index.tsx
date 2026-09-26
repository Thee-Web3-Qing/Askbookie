import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Check } from "lucide-react";
import { getDashboard, updateConversation } from "@/lib/owner.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { money, STATUS_LABEL, whenIn } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/business/$slug/messages/")({
  head: () => ({ meta: [{ title: "Messages — Bookie for business" }, { name: "description", content: "Chats that need your attention." }, { property: "og:title", content: "Messages — Bookie for business" }, { property: "og:description", content: "Customer chats for your business." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: VendorMessages,
});

type Tab = "needs_you" | "in_progress" | "handled";

function VendorMessages() {
  const { slug } = Route.useParams();
  const fetchDash = useServerFn(getDashboard);
  const update = useServerFn(updateConversation);
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("needs_you");
  const { data, isLoading } = useQuery({ queryKey: ["dashboard", slug], queryFn: () => fetchDash({ data: { slug } }), refetchInterval: 10000 });
  const all = data?.conversations ?? [];
  const shown = all.filter((c) => c.bucket === tab);
  const count = (t: Tab) => all.filter((c) => c.bucket === t).length;

  async function handled(id: string) {
    try { await update({ data: { slug, id, action: "resolve" } }); await qc.invalidateQueries({ queryKey: ["dashboard", slug] }); toast.success("Marked as handled"); } catch (e) { toast.error((e as Error).message); }
  }

  return (
    <>
      <h1 className="font-display text-2xl font-semibold sm:text-3xl">Messages</h1>
      <div className="mt-4 flex gap-1 overflow-x-auto">
        {([["needs_you", "Needs you"], ["in_progress", "In progress"], ["handled", "Handled"]] as const).map(([k, l]) => (
          <Button key={k} size="sm" variant={tab === k ? "default" : "ghost"} onClick={() => setTab(k)} className="shrink-0 rounded-full">{l} <span className="ml-1 opacity-70">{count(k)}</span></Button>
        ))}
      </div>
      {isLoading && <p className="mt-6 text-sm text-muted-foreground">Loading…</p>}
      {!isLoading && shown.length === 0 && <p className="mt-6 rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">{tab === "needs_you" ? "Nothing needs you right now." : "No chats here yet."}</p>}
      <ul className="mt-4 space-y-2">
        {shown.map((c) => (
          <li key={c.id} className="rounded-lg border border-border bg-card">
            <Link to="/business/$slug/messages/$id" params={{ slug, id: c.id }} className="block p-3 sm:p-4">
              <div className="flex items-start justify-between gap-2"><p className="min-w-0 truncate font-semibold">{c.customer_name || "New customer"}</p><Badge variant="secondary" className="shrink-0">{STATUS_LABEL[c.status] ?? c.status}</Badge></div>
              {c.escalation_reason && <p className="mt-1 flex items-start gap-1.5 text-sm"><AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" /><span className="min-w-0 break-words">{c.escalation_reason}</span></p>}
              <p className="mt-1 text-xs text-muted-foreground">{c.start_at ? whenIn(c.start_at, data!.vendor.timezone) : `Updated ${whenIn(c.updated_at, data!.vendor.timezone)}`}{c.total_price ? ` · ${money(c.total_price, data!.vendor.currency)}` : ""}{c.ai_paused ? " · You're replying" : ""}</p>
            </Link>
            {c.bucket === "needs_you" && <div className="flex gap-2 border-t border-border p-2">
              <Button asChild size="sm" className="flex-1"><Link to="/business/$slug/messages/$id" params={{ slug, id: c.id }}>Hop in</Link></Button>
              <Button size="sm" variant="outline" className="flex-1" onClick={() => handled(c.id)}><Check className="size-4" />Mark handled</Button>
            </div>}
          </li>
        ))}
      </ul>
    </>
  );
}
