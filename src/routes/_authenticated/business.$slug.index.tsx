import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { getDashboard } from "@/lib/owner.functions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowUpRight, CalendarDays, Copy } from "lucide-react";
import { money, STATUS_LABEL, whenIn } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/business/$slug/")({
  head: () => ({ meta: [{ title: "Business home — Bookie" }, { name: "description", content: "Your appointments, deposits and conversations." }, { property: "og:title", content: "Business home — Bookie" }, { property: "og:description", content: "See what your agent handled for you." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: Dashboard,
});

type Bucket = "needs_you" | "in_progress" | "handled";

function Dashboard() {
  const { slug } = Route.useParams();
  const fetchDash = useServerFn(getDashboard);
  const { data, isLoading, error } = useQuery({ queryKey: ["dashboard", slug], queryFn: () => fetchDash({ data: { slug } }), refetchInterval: 15000 });
  const [filter, setFilter] = useState<{ label: string; ids: string[] } | null>(null);
  const [bucket, setBucket] = useState<Bucket>("needs_you");

  if (isLoading) return <p className="text-muted-foreground">Loading…</p>;
  if (error || !data) return <p className="text-destructive">{(error as Error)?.message ?? "Business not found"}</p>;

  const { stats, conversations, vendor } = data;
  const tiles = [
    { n: String(stats.inquiries.count), l: "inquiries answered", ids: stats.inquiries.ids },
    { n: String(stats.confirmed.count), l: "appointments confirmed", ids: stats.confirmed.ids },
    { n: money(stats.deposits.amount, vendor.currency), l: "in deposits you confirmed", ids: stats.deposits.ids },
    { n: String(stats.negotiated.count), l: "customers negotiated with", ids: stats.negotiated.ids },
     { n: String(conversations.filter(c => c.status === "awaiting_deposit").length), l: "slots awaiting your confirmation", ids: conversations.filter(c => c.status === "awaiting_deposit").map(c => c.id) },
    { n: String(stats.needsYou.count), l: "conversations need you", ids: stats.needsYou.ids, hot: stats.needsYou.count > 0 },
  ];
  const shown = filter ? conversations.filter((c) => filter.ids.includes(c.id)) : conversations.filter((c) => c.bucket === bucket);
  const counts = { needs_you: 0, in_progress: 0, handled: 0 } as Record<Bucket, number>;
  conversations.forEach((c) => (counts[c.bucket as Bucket] = (counts[c.bucket as Bucket] ?? 0) + 1));
  const url = typeof window !== "undefined" ? `${window.location.origin}/store/${vendor.slug}` : `/store/${vendor.slug}`;
  const upcoming = conversations.filter((c) => c.status === "confirmed" && c.start_at && new Date(c.start_at).getTime() >= Date.now()).sort((a, b) => new Date(a.start_at ?? 0).getTime() - new Date(b.start_at ?? 0).getTime());

  return (
    <>
      <section>
         <p className="text-xs font-semibold uppercase text-primary">Your dashboard · last 24 hours</p>
        <h1 className="mt-2 max-w-3xl font-display text-2xl font-medium md:mt-3 md:text-5xl">Good day{vendor.owner_name ? `, ${vendor.owner_name}` : ""}. Here's what I handled.</h1>
        <div className="mt-5 grid grid-cols-2 border-y border-border sm:mt-8 sm:grid-cols-3 lg:grid-cols-6">
          {tiles.map((t) => <Button key={t.l} variant="ghost" onClick={() => setFilter({ label: t.l, ids: t.ids })} className={`h-auto min-h-20 min-w-0 flex-col items-start justify-center rounded-none border-b border-r border-border p-2 text-left transition hover:bg-secondary sm:min-h-28 sm:p-4 ${t.hot ? "bg-secondary" : ""}`}>
            <span className="max-w-full break-all font-display text-xl font-semibold text-foreground sm:text-2xl md:text-3xl">{t.n}</span>
            <span className="mt-1 whitespace-normal text-xs font-normal text-muted-foreground">{t.l}</span>
          </Button>)}
        </div>
         <Link to="/business/$slug/receptionist" params={{ slug }} className="mt-5 flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-4 hover:border-primary/40"><span className="min-w-0"><span className="block font-semibold">Receptionist setup</span><span className="block text-sm text-muted-foreground">Services, prices, hours, deposits and bargaining rules.</span></span><ArrowUpRight className="size-4 shrink-0" /></Link>
         <div className="mt-5 border-y border-border py-5 sm:mt-7 sm:py-6">
            <p className="text-xs font-semibold uppercase text-primary">Your booking link</p>
            <h2 className="mt-2 font-display text-2xl font-semibold">Let customers meet {vendor.business_name}'s receptionist.</h2>
           <p className="mt-1 text-sm text-muted-foreground">They can ask questions, discuss a price and secure a time while you keep working.</p>
           <div className="mt-4 flex flex-wrap items-center gap-2"><code className="max-w-full break-all bg-secondary px-3 py-2 text-sm text-foreground">{url}</code>
             <Button size="sm" variant="outline" title="Copy booking link" onClick={async () => { try { await navigator.clipboard.writeText(new URL(`/store/${vendor.slug}`, window.location.origin).href); toast.success("Link copied"); } catch { toast.error("Couldn't copy the link"); } }}><Copy /><span>Copy link</span></Button>
              <Button size="sm" variant="outline" asChild><Link to="/store/$slug" params={{ slug: vendor.slug }} target="_blank">View your store <ArrowUpRight /></Link></Button>
           </div>
         </div>
      </section>

       <section className="mt-7 sm:mt-10">
         <div className="flex items-center gap-2"><CalendarDays className="size-5 text-primary"/><h2 className="font-display text-2xl font-semibold">Upcoming appointments</h2><span className="text-sm text-muted-foreground">{upcoming.length}</span></div>
         <div className="mt-4 divide-y divide-border border-y border-border">
            {upcoming.length === 0 && <p className="py-5 text-sm text-muted-foreground">Confirmed bookings appear here after you verify any required deposit, or when no deposit is needed.</p>}
           {upcoming.map(c => <Link key={c.id} to="/business/$slug/messages/$id" params={{ slug, id: c.id }} className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 py-4 hover:text-primary"><div className="min-w-0"><p className="break-words font-semibold">{c.customer_name || "Customer"}</p><p className="text-sm text-muted-foreground">{whenIn(c.start_at, vendor.timezone)}</p></div><div className="flex shrink-0 items-center gap-2"><span className="font-medium">{money(c.total_price, vendor.currency)}</span><ArrowUpRight className="size-4 shrink-0"/></div></Link>)}
         </div>
       </section>

       <section className="mt-7 sm:mt-8">
        <div className="flex flex-wrap items-center gap-2">
          {filter ? (
            <>
              <h2 className="font-display text-2xl">{filter.label}</h2>
              <Button variant="ghost" size="sm" onClick={() => setFilter(null)}>Show all</Button>
            </>
          ) : (
            ([["needs_you", "Needs you"], ["in_progress", "In progress"], ["handled", "Handled automatically"]] as const).map(([k, l]) => (
              <Button key={k} variant={bucket === k ? "default" : "ghost"} onClick={() => setBucket(k)} className="rounded-md text-sm">
                {l} <span className="ml-1 opacity-70">{counts[k]}</span>
              </Button>
            ))
          )}
        </div>
        <div className="mt-4 divide-y divide-border overflow-hidden rounded-md border border-border bg-card">
          {shown.length === 0 && <p className="p-6 text-sm text-muted-foreground">Nothing here. Share your booking link to get chats flowing.</p>}
          {shown.map((c) => (
            <Link key={c.id} to="/business/$slug/messages/$id" params={{ slug, id: c.id }} className="flex flex-col gap-2 p-4 hover:bg-muted sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 break-words">
                <p className="font-semibold">{c.customer_name || "New customer"} {c.customer_phone && <span className="font-normal text-muted-foreground">· {c.customer_phone}</span>}</p>
                <p className="text-sm text-muted-foreground">{c.escalation_reason ? `⚠ ${c.escalation_reason}` : c.start_at ? whenIn(c.start_at, vendor.timezone) : `Updated ${whenIn(c.updated_at, vendor.timezone)}`}</p>
              </div>
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                {c.total_price ? <span className="text-sm font-semibold">{money(c.total_price, vendor.currency)}</span> : null}
                {c.ai_paused && <Badge variant="outline">You're replying</Badge>}
                <Badge className={c.status === "confirmed" ? "bg-success text-primary-foreground" : c.status === "awaiting_deposit" ? "bg-warning text-ink" : ""} variant={["confirmed", "awaiting_deposit"].includes(c.status) ? "default" : "secondary"}>
                  {STATUS_LABEL[c.status] ?? c.status}
                </Badge>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
