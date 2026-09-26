import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Pencil } from "lucide-react";
import { getMyVendor, setServiceActive } from "@/lib/owner.functions";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { money } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/business/$slug/inventory")({
  head: () => ({ meta: [{ title: "Inventory — Bookie for business" }, { name: "description", content: "Your services, add-ons and price limits." }, { property: "og:title", content: "Inventory — Bookie for business" }, { property: "og:description", content: "Manage what your receptionist can sell." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: Inventory,
});

function Inventory() {
  const { slug } = Route.useParams();
  const fetchV = useServerFn(getMyVendor);
  const toggle = useServerFn(setServiceActive);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["my-vendor", slug], queryFn: () => fetchV({ data: { slug } }) });

  async function flip(id: string, active: boolean) {
    try { await toggle({ data: { slug, id, active } }); await qc.invalidateQueries({ queryKey: ["my-vendor", slug] }); toast.success(active ? "Now offered" : "Hidden from customers"); } catch (e) { toast.error((e as Error).message); }
  }
  const groups = [["Services", (data?.services ?? []).filter((s) => !s.is_addon)], ["Add-ons", (data?.services ?? []).filter((s) => s.is_addon)]] as const;

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-semibold sm:text-3xl">Inventory</h1>
        <Button asChild size="sm" variant="outline"><Link to="/business/$slug/receptionist" params={{ slug }}><Pencil className="size-4" />Edit</Link></Button>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">Listed is what customers see. Your receptionist never goes below the lowest price.</p>
      {isLoading && <p className="mt-6 text-sm text-muted-foreground">Loading…</p>}
      {groups.map(([title, list]) => list.length > 0 && (
        <section key={title} className="mt-6">
          <h2 className="font-semibold">{title}</h2>
          <ul className="mt-2 divide-y divide-border rounded-lg border border-border bg-card">
            {list.map((s) => (
              <li key={s.id} className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 p-3 sm:p-4 ${s.active ? "" : "opacity-60"}`}>
                <div className="min-w-0">
                  <p className="break-words font-medium">{s.name} <span className="text-xs font-normal text-muted-foreground">· {s.duration_minutes} min</span></p>
                  <p className="mt-1 flex flex-wrap gap-x-3 text-xs text-muted-foreground"><span>Listed <b className="text-foreground">{money(s.list_price, data?.vendor.currency ?? "USD")}</b></span><span>Preferred {money(s.preferred_price, data?.vendor.currency ?? "USD")}</span><span>Lowest {money(s.floor_price, data?.vendor.currency ?? "USD")}</span></p>
                </div>
                <Switch checked={s.active} onCheckedChange={(v) => flip(s.id, v)} aria-label={`Offer ${s.name}`} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}
