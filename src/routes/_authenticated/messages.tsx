import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyBookings } from "@/lib/public.functions";
import { CustomerShell } from "@/components/AppShells";
import { Button } from "@/components/ui/button";
import { STATUS_LABEL, whenIn } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/messages")({
  head: () => ({ meta: [{ title: "Messages — Bookie" }, { name: "description", content: "Your chats with business receptionists." }, { property: "og:title", content: "Messages — Bookie" }, { property: "og:description", content: "Your chats with businesses on Bookie." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: Messages,
});

const CUSTOMER_STATUS: Record<string, string> = { ...STATUS_LABEL, awaiting_deposit: "Deposit pending", inquiry: "Chatting" };

function Messages() {
  const list = useServerFn(getMyBookings);
  const { data, isLoading } = useQuery({ queryKey: ["my-chats"], queryFn: () => list(), refetchInterval: 15000 });
  return (
    <CustomerShell>
      <h1 className="font-display text-2xl font-semibold sm:text-3xl">Messages</h1>
      {isLoading && <p className="mt-6 text-sm text-muted-foreground">Loading chats…</p>}
      {!isLoading && (data ?? []).length === 0 && <div className="mt-8 rounded-lg border border-dashed border-border p-8 text-center"><p className="font-medium">No chats yet</p><p className="mt-1 text-sm text-muted-foreground">Open a business and tap “Chat with receptionist”.</p><Button asChild className="mt-4"><Link to="/feed">Find a business</Link></Button></div>}
      <ul className="mt-4 divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
        {(data ?? []).filter((c) => c.vendor).map((c) => (
          <li key={c.id}><Link to="/chat/$id" params={{ id: c.id }} className="flex min-w-0 items-center gap-3 p-3 hover:bg-secondary/60 sm:p-4">
            <span className="grid size-11 shrink-0 place-items-center rounded-full bg-secondary font-display text-lg text-primary">{c.vendor!.business_name.charAt(0)}</span>
            <span className="min-w-0 flex-1">
              <span className="flex items-baseline justify-between gap-2"><span className="truncate font-semibold">{c.vendor!.business_name}</span><span className="shrink-0 text-[11px] text-muted-foreground">{whenIn(c.updated_at, c.vendor!.timezone)}</span></span>
              <span className="block truncate text-sm text-muted-foreground">{c.preview ? `${c.fromMe ? "You: " : ""}${c.preview}` : "Say hello to start"}</span>
              {c.status !== "inquiry" && <span className="mt-1 inline-block rounded-full bg-secondary px-2 py-0.5 text-[11px]">{CUSTOMER_STATUS[c.status] ?? c.status}{c.start_at ? ` · ${whenIn(c.start_at, c.vendor!.timezone)}` : ""}</span>}
            </span>
          </Link></li>
        ))}
      </ul>
    </CustomerShell>
  );
}
