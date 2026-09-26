import { COUNTRIES, guessCountry } from "@/lib/locale";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Briefcase, CalendarCheck, LogOut } from "lucide-react";
import { getMe, saveProfile } from "@/lib/account.functions";
import { getMyBookings } from "@/lib/public.functions";
import { supabase } from "@/integrations/supabase/client";
import { CustomerShell } from "@/components/AppShells";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { money, whenIn } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/me")({
  head: () => ({ meta: [{ title: "My account — Bookie" }, { name: "description", content: "Your profile, bookings and businesses." }, { property: "og:title", content: "My account — Bookie" }, { property: "og:description", content: "Your Bookie profile and bookings." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: Me,
});

function Me() {
  const fetchMe = useServerFn(getMe);
  const save = useServerFn(saveProfile);
  const list = useServerFn(getMyBookings);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data } = useQuery({ queryKey: ["me"], queryFn: () => fetchMe() });
  const { data: bookings } = useQuery({ queryKey: ["my-chats"], queryFn: () => list() });
  const [f, setF] = useState({ display_name: "", phone: "", city: "", country: "" });
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (data) setF({ display_name: data.profile.display_name ?? "", phone: data.profile.phone ?? "", city: data.profile.city ?? "", country: data.profile.country || guessCountry() }); }, [data]);
  const upcoming = (bookings ?? []).filter((b) => b.status === "confirmed" && b.start_at && new Date(b.start_at) > new Date());

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true);
    try { await save({ data: f }); if (f.country) localStorage.setItem("bookie_country", f.country); localStorage.setItem("bookie_city", f.city); toast.success("Saved"); } catch (err) { toast.error((err as Error).message); } finally { setBusy(false); }
  }
  async function signOut() { await qc.cancelQueries(); qc.clear(); await supabase.auth.signOut(); navigate({ to: "/auth", replace: true }); }

  return (
    <CustomerShell>
      <h1 className="font-display text-2xl font-semibold sm:text-3xl">My account</h1>
      <section className="mt-5 rounded-lg border border-border bg-card p-4">
        <h2 className="flex items-center gap-2 font-semibold"><CalendarCheck className="size-4 text-primary" />Upcoming bookings</h2>
        {upcoming.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">No confirmed bookings yet.</p> : <ul className="mt-2 divide-y divide-border">{upcoming.map((b) => <li key={b.id}><Link to="/chat/$id" params={{ id: b.id }} className="flex justify-between gap-3 py-2 text-sm"><span className="min-w-0 truncate">{b.vendor?.business_name} · {whenIn(b.start_at, b.vendor?.timezone)}</span><span className="shrink-0 font-medium">{money(b.total_price, b.vendor?.currency ?? "USD")}</span></Link></li>)}</ul>}
      </section>
      <form onSubmit={submit} className="mt-4 space-y-3 rounded-lg border border-border bg-card p-4">
        <h2 className="font-semibold">Your details</h2>
        <div><Label htmlFor="n">Name</Label><Input id="n" value={f.display_name} maxLength={100} onChange={(e) => setF({ ...f, display_name: e.target.value })} /></div>
        <div><Label htmlFor="p">Phone</Label><Input id="p" value={f.phone} maxLength={30} onChange={(e) => setF({ ...f, phone: e.target.value })} /></div>
        <div><Label htmlFor="c">City</Label><Input id="c" value={f.city} maxLength={60} onChange={(e) => setF({ ...f, city: e.target.value })} placeholder="Your city" /></div>
        <div><Label>Country</Label><Select value={f.country} onValueChange={(v) => setF({ ...f, country: v })}><SelectTrigger aria-label="Country"><SelectValue placeholder="Choose your country" /></SelectTrigger><SelectContent>{COUNTRIES.map((c) => <SelectItem key={c.code} value={c.code}>{c.name} · {c.currency}</SelectItem>)}</SelectContent></Select></div>
        <Button type="submit" disabled={busy}>Save</Button>
      </form>
      <section className="mt-4 rounded-lg border border-border bg-card p-4">
        <h2 className="flex items-center gap-2 font-semibold"><Briefcase className="size-4 text-primary" />Bookie for business</h2>
        <p className="mt-1 text-sm text-muted-foreground">{data?.businesses.length ? `You run ${data.businesses.length} ${data.businesses.length === 1 ? "business" : "businesses"}.` : "Run a business? Give it a receptionist that books for you."}</p>
        <Button asChild variant="outline" className="mt-3"><Link to="/business">{data?.businesses.length ? "Switch to vendor mode" : "Set up your business"}</Link></Button>
      </section>
      <Button variant="ghost" className="mt-4 w-full text-destructive" onClick={signOut}><LogOut className="size-4" />Sign out</Button>
    </CustomerShell>
  );
}
