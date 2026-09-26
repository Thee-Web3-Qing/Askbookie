import { Link } from "@tanstack/react-router";
import { MapPin } from "lucide-react";
import { money } from "@/lib/format";

export type Listing = { id: string; slug: string; business_name: string; category: string; description: string; city: string; area: string; currency: string; country: string; services: string[]; from: number | null };

export function BusinessCard({ b }: { b: Listing }) {
  return (
    <Link to="/store/$slug" params={{ slug: b.slug }} className="flex min-w-0 gap-3 rounded-lg border border-border bg-card p-3 transition hover:border-primary/40 hover:shadow-sm sm:p-4">
      <span className="grid size-12 shrink-0 place-items-center rounded-lg bg-secondary font-display text-xl text-primary">{b.business_name.charAt(0)}</span>
      <span className="min-w-0 flex-1">
        <span className="flex items-start justify-between gap-2">
          <span className="min-w-0 truncate font-semibold">{b.business_name}</span>
          {b.from != null && <span className="shrink-0 text-xs text-muted-foreground">from <b className="text-foreground">{money(b.from, b.currency)}</b></span>}
        </span>
        <span className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground"><MapPin className="size-3 shrink-0" />{[b.category, b.area, b.city].filter(Boolean).join(" · ")}</span>
        <span className="mt-2 flex flex-wrap gap-1">{b.services.slice(0, 3).map((s) => <span key={s} className="max-w-full truncate rounded-full bg-secondary px-2 py-0.5 text-[11px]">{s}</span>)}</span>
      </span>
    </Link>
  );
}
