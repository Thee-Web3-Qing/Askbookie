import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { MapPin, Search } from "lucide-react";
import { listBusinesses } from "@/lib/public.functions";
import { CustomerShell } from "@/components/AppShells";
import { BusinessCard, type Listing } from "@/components/BusinessCard";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { COUNTRIES, guessCountry, countryByCode } from "@/lib/locale";

export const Route = createFileRoute("/feed")({
  head: () => ({ meta: [
    { title: "Services around you — Bookie" },
    { name: "description", content: "Discover local service businesses near you, anywhere in the world, and chat with their receptionist to book." },
    { property: "og:title", content: "Services around you — Bookie" },
    { property: "og:description", content: "Find local businesses and book by chat." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: Feed,
});

function Feed() {
  const [country, setCountry] = useState("all");
  const [city, setCity] = useState("");
  useEffect(() => { setCountry(localStorage.getItem("bookie_country") || guessCountry() || "all"); setCity(localStorage.getItem("bookie_city") ?? ""); }, []);
  const { data: all, isLoading } = useQuery({ queryKey: ["feed", country], queryFn: () => listBusinesses({ data: country === "all" ? {} : { country } }) });
  const cities = [...new Set((all ?? []).map((b) => b.city).filter(Boolean))].sort();
  const data = city && cities.includes(city) ? (all ?? []).filter((b) => b.city === city) : all;
  const place = country === "all" ? "any country" : countryByCode(country)?.name ?? country;
  const groups = new Map<string, Listing[]>();
  (data ?? []).forEach((b) => { const k = b.category || "Other services"; groups.set(k, [...(groups.get(k) ?? []), b]); });

  return (
    <CustomerShell>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0"><p className="text-xs font-semibold uppercase text-primary">Around you</p><h1 className="font-display text-2xl font-semibold sm:text-3xl">Services near you</h1></div>
        <Select value={country} onValueChange={(v) => { setCountry(v); setCity(""); localStorage.setItem("bookie_country", v); }}>
          <SelectTrigger className="w-auto min-w-32 max-w-44 shrink-0" aria-label="Choose your country"><MapPin className="size-4" /><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">Everywhere</SelectItem>{COUNTRIES.map((c) => <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <Link to="/search" className="mt-4 flex items-center gap-2 rounded-full border border-border bg-card px-4 py-3 text-sm text-muted-foreground"><Search className="size-4" />Search for a service, e.g. haircut, photos, cleaning</Link>
      {cities.length > 1 && <div className="mt-4 flex gap-2 overflow-x-auto pb-1">{["", ...cities].map((c) => <button key={c || "all"} type="button" onClick={() => { setCity(c); localStorage.setItem("bookie_city", c); }} className={`shrink-0 rounded-full border px-3 py-1.5 text-xs ${city === c || (!c && !cities.includes(city)) ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"}`}>{c || "All cities"}</button>)}</div>}
      {isLoading && <p className="mt-8 text-sm text-muted-foreground">Finding businesses…</p>}
      {!isLoading && (data ?? []).length === 0 && <p className="mt-8 rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">No businesses listed in {place} yet. Try another country.</p>}
      <div className="mt-6 space-y-7">
        {[...groups.entries()].map(([cat, list]) => (
          <section key={cat}><h2 className="mb-3 font-display text-lg font-semibold">{cat}</h2><div className="grid gap-3 sm:grid-cols-2">{list.map((b) => <BusinessCard key={b.id} b={b} />)}</div></section>
        ))}
      </div>
    </CustomerShell>
  );
}
