import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, Plus, ShoppingBag } from "lucide-react";
import { listMyBusinesses } from "@/lib/owner.functions";
import { Brand } from "@/components/Brand";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/business/")({
  head: () => ({ meta: [{ title: "Your businesses — Bookie for business" }, { name: "description", content: "Choose a business to manage or add a new one." }, { property: "og:title", content: "Your businesses — Bookie for business" }, { property: "og:description", content: "Manage your businesses on Bookie." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: Businesses,
});

function Businesses() {
  const list = useServerFn(listMyBusinesses);
  const { data, isLoading } = useQuery({ queryKey: ["my-businesses"], queryFn: () => list() });
  const atLimit = data ? data.businesses.length >= data.limit : true;
  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b border-border bg-card"><div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-2.5"><Brand /><Button asChild variant="outline" size="sm"><Link to="/feed"><ShoppingBag className="size-4" />Customer mode</Link></Button></div></header>
      <main className="mx-auto max-w-3xl px-4 py-6">
        <p className="text-xs font-semibold uppercase text-primary">Bookie for business</p>
        <h1 className="mt-1 font-display text-2xl font-semibold sm:text-3xl">Your businesses</h1>
        {data && <p className="mt-1 text-sm text-muted-foreground"><Badge variant="secondary" className="mr-2 capitalize">{data.plan}</Badge>{data.businesses.length} of {data.limit} {data.limit === 1 ? "business" : "businesses"} used</p>}
        {isLoading && <p className="mt-6 text-sm text-muted-foreground">Loading…</p>}
        <div className="mt-5 space-y-3">
          {data?.businesses.map((b) => (
            <Link key={b.id} to="/business/$slug" params={{ slug: b.slug }} className="flex min-w-0 items-center gap-3 rounded-lg border border-border bg-card p-4 hover:border-primary/40">
              <span className="grid size-12 shrink-0 place-items-center rounded-lg bg-primary font-display text-xl text-primary-foreground">{b.business_name.charAt(0)}</span>
              <span className="min-w-0 flex-1"><span className="block truncate font-semibold">{b.business_name}</span><span className="block truncate text-sm text-muted-foreground">{[b.category, b.city].filter(Boolean).join(" · ")}</span></span>
              {b.needsYou > 0 && <Badge className="shrink-0 bg-warning text-ink">{b.needsYou} need you</Badge>}
              <ArrowRight className="size-4 shrink-0" />
            </Link>
          ))}
        </div>
        {data && data.businesses.length === 0 && <div className="mt-4 rounded-lg border border-dashed border-border p-6 text-center"><p className="font-medium">Give your business a receptionist</p><p className="mt-1 text-sm text-muted-foreground">It answers customers, discusses prices within your limits and holds appointments for you.</p></div>}
        {atLimit && data && data.businesses.length > 0
          ? <p className="mt-5 rounded-lg bg-secondary p-4 text-sm">You're using all {data.limit} {data.limit === 1 ? "business" : "businesses"} on the {data.plan} plan.{data.plan === "free" && " Pro allows up to 3 businesses."}</p>
          : <Button asChild className="mt-5 h-11 w-full sm:w-auto"><Link to="/business/new"><Plus className="size-4" />Set up {data?.businesses.length ? "another" : "your"} business</Link></Button>}
      </main>
    </div>
  );
}
