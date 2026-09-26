import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Bot, ChevronRight, Wallet } from "lucide-react";
import { Bar, BarChart, XAxis } from "recharts";
import { deleteBusiness, getBilling, getMyVendor, setListed } from "@/lib/owner.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { cents } from "@/lib/locale";
import { AI_REPLY_PRICE } from "@/lib/reserved";

export const Route = createFileRoute("/_authenticated/business/$slug/settings")({
  head: () => ({ meta: [{ title: "Settings — Bookie for business" }, { name: "description", content: "AI usage, wallet, plan and business settings." }, { property: "og:title", content: "Settings — Bookie for business" }, { property: "og:description", content: "Manage AI usage, wallet and plan." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: Settings,
});

const config = { cost: { label: "Spent", color: "var(--color-primary)" } } satisfies ChartConfig;

function Settings() {
  const { slug } = Route.useParams();
  const fetchBilling = useServerFn(getBilling);
  const fetchV = useServerFn(getMyVendor);
  const listed = useServerFn(setListed);
  const remove = useServerFn(deleteBusiness);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [confirm, setConfirm] = useState("");
  const { data: b } = useQuery({ queryKey: ["billing"], queryFn: () => fetchBilling() });
  const { data: v } = useQuery({ queryKey: ["my-vendor", slug], queryFn: () => fetchV({ data: { slug } }) });

  const daily = new Map<string, number>();
  (b?.usage ?? []).forEach((u) => daily.set(u.day, (daily.get(u.day) ?? 0) + u.cost));
  const chart = [...daily.entries()].map(([day, cost]) => ({ day: day.slice(5), cost }));
  const low = b ? b.available < AI_REPLY_PRICE * 40 : false;

  async function setList(val: boolean) {
    try { await listed({ data: { slug, listed: val } }); await qc.invalidateQueries({ queryKey: ["my-vendor", slug] }); toast.success(val ? "Shown in the customer feed" : "Hidden from the customer feed"); } catch (e) { toast.error((e as Error).message); }
  }
  async function del() {
    try { await remove({ data: { slug, confirm } }); await qc.invalidateQueries(); toast.success("Business deleted"); navigate({ to: "/business" }); } catch (e) { toast.error((e as Error).message); }
  }

  return (
    <>
      <h1 className="font-display text-2xl font-semibold sm:text-3xl">Settings</h1>

      <section className="mt-5 rounded-lg border border-border bg-card p-4">
        <div className="flex items-center justify-between gap-2"><h2 className="flex items-center gap-2 font-semibold"><Wallet className="size-4 text-primary" />AI usage & wallet</h2><Badge variant="secondary" className="capitalize">{b?.plan ?? "free"} plan</Badge></div>
        <p className="mt-1 text-sm text-muted-foreground">Pay as you go: {cents(AI_REPLY_PRICE)} per receptionist reply, charged from your wallet once a day (in US dollars, wherever you are).</p>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <div className="min-w-0 rounded-md bg-secondary p-3"><p className="truncate font-display text-lg font-semibold sm:text-2xl">{cents(b?.available ?? 0)}</p><p className="text-[11px] text-muted-foreground">Available</p></div>
          <div className="min-w-0 rounded-md bg-secondary p-3"><p className="truncate font-display text-lg font-semibold sm:text-2xl">{b?.today.replies ?? 0}</p><p className="text-[11px] text-muted-foreground">Replies today</p></div>
          <div className="min-w-0 rounded-md bg-secondary p-3"><p className="truncate font-display text-lg font-semibold sm:text-2xl">{cents(b?.pending ?? 0)}</p><p className="text-[11px] text-muted-foreground">Due tonight</p></div>
        </div>
        {low && <p className="mt-3 flex items-start gap-2 rounded-md border border-warning/50 bg-warning/10 p-3 text-sm"><AlertTriangle className="mt-0.5 size-4 shrink-0" />Your wallet is running low. When it runs out, your receptionist pauses and you reply to customers yourself.</p>}
        <Button className="mt-3 w-full sm:w-auto" variant="outline" onClick={() => toast.info("Online top-ups are coming soon. Contact Bookie to add funds for now.")}>Top up wallet</Button>
        {chart.length > 0 && <ChartContainer config={config} className="mt-4 h-40 w-full"><BarChart data={chart}><XAxis dataKey="day" tickLine={false} axisLine={false} fontSize={11} /><ChartTooltip content={<ChartTooltipContent />} /><Bar dataKey="cost" fill="var(--color-cost)" radius={3} /></BarChart></ChartContainer>}
        <h3 className="mt-4 text-sm font-semibold">Wallet history</h3>
        <ul className="mt-2 divide-y divide-border text-sm">
          {(b?.ledger ?? []).length === 0 && <li className="py-2 text-muted-foreground">No activity yet.</li>}
          {(b?.ledger ?? []).map((l) => <li key={l.id} className="flex justify-between gap-3 py-2"><span className="min-w-0 truncate">{l.day ?? l.created_at.slice(0, 10)} · {l.note || l.kind}</span><span className={`shrink-0 font-medium ${l.amount < 0 ? "" : "text-success"}`}>{l.amount < 0 ? "−" : "+"}{cents(Math.abs(l.amount))}</span></li>)}
        </ul>
      </section>

      <section className="mt-4 divide-y divide-border rounded-lg border border-border bg-card">
        <Link to="/business/$slug/receptionist" params={{ slug }} className="flex items-center justify-between gap-3 p-4"><span className="flex min-w-0 items-center gap-3"><Bot className="size-5 shrink-0 text-primary" /><span className="min-w-0"><span className="block font-medium">Receptionist setup</span><span className="block truncate text-sm text-muted-foreground">Profile, services, hours, deposits, bargaining</span></span></span><ChevronRight className="size-4 shrink-0" /></Link>
        <label className="flex items-center justify-between gap-3 p-4"><span className="min-w-0"><span className="block font-medium">Show in customer feed</span><span className="block text-sm text-muted-foreground">Let people find you in Feed and Search.</span></span><Switch checked={v?.vendor.is_listed ?? true} onCheckedChange={setList} /></label>
        <div className="p-4"><p className="font-medium">Plan</p><p className="text-sm text-muted-foreground">Free: 1 business. Pro: up to 3 businesses. AI replies are pay as you go on both.</p></div>
      </section>

      <section className="mt-4 rounded-lg border border-destructive/40 bg-card p-4">
        <h2 className="font-semibold text-destructive">Delete business</h2>
        <p className="mt-1 text-sm text-muted-foreground">Removes this business, its chats and bookings. This can't be undone.</p>
        <AlertDialog><AlertDialogTrigger asChild><Button variant="outline" className="mt-3 text-destructive">Delete business</Button></AlertDialogTrigger>
          <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete {v?.vendor.business_name}?</AlertDialogTitle><AlertDialogDescription>Type <b>{slug}</b> to confirm.</AlertDialogDescription></AlertDialogHeader><Input value={confirm} onChange={(e) => setConfirm(e.target.value)} aria-label="Confirm business address" /><AlertDialogFooter><AlertDialogCancel>Keep it</AlertDialogCancel><AlertDialogAction disabled={confirm !== slug} onClick={() => void del()}>Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
      </section>
    </>
  );
}
