import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Clock3, MapPin, MessageCircle } from "lucide-react";
import { getPublicVendor, startConversation } from "@/lib/public.functions";
import { supabase } from "@/integrations/supabase/client";
import { CustomerShell } from "@/components/AppShells";
import { Button } from "@/components/ui/button";
import { money } from "@/lib/format";

export const Route = createFileRoute("/store/$slug")({
  loader: async ({ params }) => {
    const data = await getPublicVendor({ data: { slug: params.slug } });
    if (!data) throw notFound();
    return data;
  },
  head: ({ loaderData }) => {
    if (!loaderData) return { meta: [{ title: "Business not found — Bookie" }, { name: "robots", content: "noindex" }] };
    const name = loaderData.vendor.business_name;
    const desc = `${loaderData.vendor.category || "Services"} in ${loaderData.vendor.city}. See services and chat with ${name}'s receptionist to book.`;
    return { meta: [{ title: `${name} — book on Bookie` }, { name: "description", content: desc }, { property: "og:title", content: `${name} — book on Bookie` }, { property: "og:description", content: desc }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] };
  },
  errorComponent: ({ error }) => <div className="p-10 text-center">{error.message}</div>,
  notFoundComponent: () => <CustomerShell><p className="py-16 text-center font-display text-2xl">This business isn't on Bookie.</p><div className="text-center"><Button asChild><Link to="/feed">Browse businesses</Link></Button></div></CustomerShell>,
  component: Store,
});

const DAY = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

function Store() {
  const { vendor, services } = Route.useLoaderData();
  const start = useServerFn(startConversation);
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const hours = (vendor.working_hours ?? {}) as Record<string, { open: string; close: string } | null>;

  async function chat(service?: string) {
    if (busy) return;
    const { data } = await supabase.auth.getUser();
    if (!data.user) { navigate({ to: "/auth", search: { redirect: `/store/${vendor.slug}` } as never }); return; }
    setBusy(true);
    try {
      const r = await start({ data: { slug: vendor.slug } });
      navigate({ to: "/chat/$id", params: { id: r.id }, search: (service ? { ask: service } : {}) as never });
    } catch (e) { toast.error((e as Error).message); setBusy(false); }
  }

  const main = services.filter((s) => !s.is_addon);
  const addons = services.filter((s) => s.is_addon);
  return (
    <CustomerShell>
      <Link to="/feed" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" />Back</Link>
      <section className="mt-3 rounded-xl border border-border bg-card p-4 sm:p-6">
        <div className="flex items-start gap-3">
          <span className="grid size-14 shrink-0 place-items-center rounded-xl bg-primary font-display text-2xl text-primary-foreground">{vendor.business_name.charAt(0)}</span>
          <div className="min-w-0"><h1 className="break-words font-display text-2xl font-semibold leading-tight sm:text-3xl">{vendor.business_name}</h1><p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground"><MapPin className="size-3.5 shrink-0" />{[vendor.category, vendor.area, vendor.city].filter(Boolean).join(" · ")}</p></div>
        </div>
        {vendor.description && <p className="mt-4 break-words text-sm leading-relaxed">{vendor.description}</p>}
        <Button className="mt-5 h-11 w-full sm:w-auto" onClick={() => chat()} disabled={busy}><MessageCircle className="size-4" />{busy ? "Opening chat…" : "Chat with receptionist"}</Button>
      </section>

      <h2 className="mt-7 font-display text-xl font-semibold">Services</h2>
      <div className="mt-3 divide-y divide-border rounded-xl border border-border bg-card">
        {main.map((s) => <button key={s.id} type="button" onClick={() => chat(`Hi, I'd like to book ${s.name}.`)} className="grid w-full grid-cols-[minmax(0,1fr)_auto] gap-3 p-4 text-left hover:bg-secondary/60">
          <span className="min-w-0"><span className="block break-words font-medium">{s.name}</span>{s.description && <span className="mt-0.5 block break-words text-xs text-muted-foreground">{s.description}</span>}<span className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><Clock3 className="size-3" />{s.duration_minutes} min</span></span>
          <span className="text-right"><span className="block font-semibold">{money(s.list_price, vendor.currency)}</span><span className="text-xs text-primary">Book</span></span>
        </button>)}
      </div>
      {addons.length > 0 && <><h3 className="mt-5 text-sm font-semibold">Add-ons</h3><div className="mt-2 flex flex-wrap gap-2">{addons.map((a) => <span key={a.id} className="rounded-full bg-secondary px-3 py-1 text-xs">{a.name} · {money(a.list_price, vendor.currency)}</span>)}</div></>}
      <p className="mt-3 text-xs text-muted-foreground">Listed prices. Ask the receptionist about options for your date or budget.</p>

      <h2 className="mt-7 font-display text-xl font-semibold">Opening hours</h2>
      <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 rounded-xl border border-border bg-card p-4 text-sm sm:grid-cols-4">
        {DAY.map((d) => <div key={d} className="flex justify-between gap-2"><dt className="capitalize text-muted-foreground">{d}</dt><dd>{hours[d] ? `${hours[d]!.open}–${hours[d]!.close}` : "Closed"}</dd></div>)}
      </dl>
    </CustomerShell>
  );
}
