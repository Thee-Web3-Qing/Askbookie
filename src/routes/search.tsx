import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { z } from "zod";
import { Search as SearchIcon } from "lucide-react";
import { listBusinesses } from "@/lib/public.functions";
import { CustomerShell } from "@/components/AppShells";
import { BusinessCard } from "@/components/BusinessCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/search")({
  validateSearch: (s) => z.object({ q: z.string().max(80).optional() }).parse(s),
  head: () => ({ meta: [
    { title: "Search services — Bookie" },
    { name: "description", content: "Search for the service you need and see businesses that offer it." },
    { property: "og:title", content: "Search services — Bookie" },
    { property: "og:description", content: "Find a business for the service you need." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: SearchPage,
});

const IDEAS = ["Haircut", "Photographer", "Cleaning", "Makeup", "Tutor", "Car wash"];

function SearchPage() {
  const { q } = Route.useSearch();
  const navigate = useNavigate({ from: "/search" });
  const [text, setText] = useState(q ?? "");
  useEffect(() => setText(q ?? ""), [q]);
  const { data, isFetching } = useQuery({ queryKey: ["search", q], queryFn: () => listBusinesses({ data: { q } }), enabled: !!q });
  const go = (v: string) => navigate({ search: { q: v.trim() || undefined } });

  return (
    <CustomerShell>
      <h1 className="font-display text-2xl font-semibold sm:text-3xl">What do you need?</h1>
      <form onSubmit={(e) => { e.preventDefault(); go(text); }} className="mt-4 flex gap-2">
        <div className="relative min-w-0 flex-1"><SearchIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input autoFocus value={text} onChange={(e) => setText(e.target.value)} placeholder="Search services or businesses" className="h-11 rounded-full pl-9 text-base" aria-label="Search services" /></div>
        <Button type="submit" className="h-11 rounded-full">Search</Button>
      </form>
      {!q && <div className="mt-6"><p className="text-sm text-muted-foreground">Popular searches</p><div className="mt-2 flex flex-wrap gap-2">{IDEAS.map((i) => <Button key={i} variant="outline" size="sm" className="rounded-full" onClick={() => go(i)}>{i}</Button>)}</div></div>}
      {q && <p className="mt-6 text-sm text-muted-foreground">{isFetching ? "Searching…" : `${data?.length ?? 0} ${data?.length === 1 ? "business" : "businesses"} for “${q}”`}</p>}
      <div className="mt-3 grid gap-3 sm:grid-cols-2">{(data ?? []).map((b) => <BusinessCard key={b.id} b={b} />)}</div>
    </CustomerShell>
  );
}
