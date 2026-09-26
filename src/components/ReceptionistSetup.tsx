import { useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { getMyVendor, saveVendor } from "@/lib/owner.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { COUNTRIES, countryByCode, currencySymbol, guessCountry } from "@/lib/locale";
import { ArrowLeft, ArrowRight, Check, LockKeyhole } from "lucide-react";

const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
type Svc = { id?: string; name: string; description: string; duration_minutes: number; list_price: number; preferred_price: number; floor_price: number; group_price_per_person: number | null; is_addon: boolean };
type Form = {
  slug: string; area: string; is_listed: boolean; business_name: string; owner_name: string; category: string; description: string; city: string; country: string; currency: string; timezone: string;
  service_modes: ("studio" | "home" | "virtual")[]; studio_address: string; location_fees: { area: string; fee: number }[]; outside_area_rule: string;
  working_hours: Record<string, { open: string; close: string } | null>; buffer_minutes: number; min_notice_hours: number; max_bookings_per_day: number;
  deposit_type: "none" | "fixed" | "percent" | "full"; deposit_value: number; hold_minutes: number;
  negotiation: { enabled: boolean; max_rounds: number; protect_weekends: boolean; below_preferred_needs_deposit_now: boolean; weekday_discount: number; studio_discount: number; pay_now_discount: number };
  escalate_group_over: number; cancellation_policy: string; services: Svc[];
};

const DEFAULT: Form = {
  slug: "", area: "", is_listed: true, business_name: "", owner_name: "", category: "", description: "", city: "", country: "", currency: "USD", timezone: "UTC",
  service_modes: ["studio"], studio_address: "", location_fees: [], outside_area_rule: "Outside your service area: quote required",
  working_hours: { mon: { open: "09:00", close: "18:00" }, tue: { open: "09:00", close: "18:00" }, wed: { open: "09:00", close: "18:00" }, thu: { open: "09:00", close: "18:00" }, fri: { open: "09:00", close: "18:00" }, sat: { open: "06:00", close: "17:00" }, sun: null },
  buffer_minutes: 30, min_notice_hours: 12, max_bookings_per_day: 4, deposit_type: "percent", deposit_value: 30, hold_minutes: 30,
   negotiation: { enabled: true, max_rounds: 3, protect_weekends: true, below_preferred_needs_deposit_now: false, weekday_discount: 0, studio_discount: 0, pay_now_discount: 0 },
  escalate_group_over: 6, cancellation_policy: "Deposit refundable up to 48 hours before. Transferable once up to 24 hours before. Forfeited for same-day cancellation.",
  services: [{ name: "", description: "", duration_minutes: 60, list_price: 0, preferred_price: 0, floor_price: 0, group_price_per_person: null, is_addon: false }],
};

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
     <section className="border-b border-border pb-5 sm:pb-8">
      <h2 className="font-display text-2xl">{title}</h2>
      {hint && <p className="mt-1 text-sm text-muted-foreground">{hint}</p>}
      <div className="mt-5 space-y-4">{children}</div>
    </section>
  );
}
const num = (v: string) => (v === "" ? 0 : Number(v));

export function ReceptionistSetup({ slug }: { slug?: string }) {
  const fetchVendor = useServerFn(getMyVendor);
  const save = useServerFn(saveVendor);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({ queryKey: ["my-vendor", slug], queryFn: () => fetchVendor({ data: { slug: slug! } }), enabled: !!slug });
  const [f, setF] = useState<Form>(DEFAULT);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState(0);
  const [unlocked, setUnlocked] = useState(0);
  const steps = ["Your business", "Services & pricing", "Where you work", "Hours & availability", "Deposits & policies"];

  useEffect(() => {
    if (!data) return;
    const v = data.vendor;
    setF({
      ...DEFAULT,
      ...(Object.fromEntries(Object.keys(DEFAULT).filter((k) => k !== "services").map((k) => [k, (v as Record<string, unknown>)[k] ?? (DEFAULT as Record<string, unknown>)[k]])) as Omit<Form, "services">),
      services: data.services.filter((s) => s.active).map((s) => ({ id: s.id, name: s.name, description: s.description, duration_minutes: s.duration_minutes, list_price: s.list_price, preferred_price: s.preferred_price, floor_price: s.floor_price, group_price_per_person: s.group_price_per_person, is_addon: s.is_addon })),
    });
  }, [data]);
  useEffect(() => { if (slug) return; const c = countryByCode(guessCountry()); if (c) setF((p) => (p.country ? p : { ...p, country: c.code, currency: c.currency, timezone: c.timezone })); }, [slug]);

  const cur = currencySymbol(f.currency);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((p) => ({ ...p, [k]: v }));
  const setNeg = (k: keyof Form["negotiation"], v: number | boolean) => setF((p) => ({ ...p, negotiation: { ...p.negotiation, [k]: v } }));
  const setSvc = (i: number, patch: Partial<Svc>) => setF((p) => ({ ...p, services: p.services.map((s, j) => (j === i ? { ...s, ...patch } : s)) }));

  function continueStage() {
    if (stage === 0 && (!f.business_name.trim() || !f.owner_name.trim() || !f.slug.trim())) {
      toast.error("Add your business name, first name and booking link to continue."); return;
    }
    if (stage === 0 && !f.country) {
      toast.error("Choose the country your business is in."); return;
    }
    if (stage === 1 && (f.services.length === 0 || f.services.some((svc) => !svc.name.trim() || svc.duration_minutes <= 0 || svc.floor_price > svc.preferred_price || svc.preferred_price > svc.list_price))) {
      toast.error("Add a service with a name, duration and prices from floor to listed."); return;
    }
    if (stage === 2 && f.service_modes.length === 0) { toast.error("Choose at least one way you work."); return; }
    if (stage < steps.length - 1) {
      setUnlocked((current) => Math.max(current, stage + 1));
      setStage(stage + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else submit();
  }

  async function submit() {
    setBusy(true);
    try {
      const r = await save({ data: { ...f, vendorId: data?.vendor.id ?? null } });
      await qc.invalidateQueries();
      toast.success("Saved. Your receptionist is ready. Share your booking link from Home.");
      navigate({ to: "/business/$slug", params: { slug: r.slug } });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (slug && isLoading) return <p className="text-muted-foreground">Loading…</p>;

  return (
    <>
      <div className="grid min-w-0 gap-10 lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="min-w-0 lg:border-r lg:border-border lg:pr-7">
           <p className="mb-3 text-xs font-semibold uppercase text-muted-foreground lg:mb-5">Set up your desk</p>
           <nav aria-label="Setup stages" className="flex max-w-full gap-1 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible">
            {steps.map((name, i) => (
               <Button key={name} type="button" variant="ghost" disabled={i > unlocked} onClick={() => setStage(i)} title={name} className={`h-9 shrink-0 justify-start gap-2 rounded-md px-2 text-left text-sm lg:h-auto lg:w-full lg:gap-3 lg:px-3 lg:py-3 ${stage === i ? "bg-secondary text-foreground" : "text-muted-foreground"}`}>
                <span className={`grid size-6 shrink-0 place-items-center rounded-full border text-xs ${stage === i ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>{i > unlocked ? <LockKeyhole className="size-3" /> : i < unlocked ? <Check className="size-3" /> : `0${i + 1}`}</span>
                 <span className="hidden min-w-0 sm:inline lg:inline">{name}</span>
              </Button>
            ))}
          </nav>
        </aside>
        <div className="min-w-0 max-w-3xl">
          <p className="text-xs font-semibold uppercase text-primary">Step {stage + 1} of {steps.length}</p>
          <h1 className="mt-3 font-display text-3xl font-semibold md:text-4xl">{steps[stage]}</h1>
           <p className="mt-2 max-w-full text-sm text-muted-foreground">{stage === 0 ? "The essentials customers will see when they meet your desk." : stage === 1 ? "List what you offer and set the prices your desk must respect." : stage === 2 ? "Tell customers where you can meet them." : stage === 3 ? "Only offer times that work for you." : "Decide how a booking gets secured. Once saved, copy your customer booking link from the dashboard."}</p>
          <div className="mt-7 h-1 bg-secondary"><div className="h-full bg-gold transition-all duration-300" style={{ width: `${((stage + 1) / steps.length) * 100}%` }} /></div>
           <div className="mt-5 space-y-6 sm:mt-9">
        {stage === 0 && (
        <Section title="Your business">
          <div className="grid gap-4 md:grid-cols-2">
            <div><Label>Business name</Label><Input value={f.business_name} onChange={(e) => { set("business_name", e.target.value); if (!data) set("slug", e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")); }} placeholder="Your business name" /></div>
            <div><Label>Your first name (what the desk calls you)</Label><Input value={f.owner_name} onChange={(e) => set("owner_name", e.target.value)} placeholder="Your name" /></div>
            <div><Label>What you do</Label><Input value={f.category} onChange={(e) => set("category", e.target.value)} placeholder="e.g. Barber, photographer, tutor" /></div>
            <div><Label>Country</Label><Select value={f.country} onValueChange={(v) => { const c = countryByCode(v); if (c) setF((p) => ({ ...p, country: c.code, currency: c.currency, timezone: c.timezone })); }}><SelectTrigger aria-label="Country"><SelectValue placeholder="Choose your country" /></SelectTrigger><SelectContent>{COUNTRIES.map((c) => <SelectItem key={c.code} value={c.code}>{c.name} · {c.currency}</SelectItem>)}</SelectContent></Select><p className="mt-1 text-xs text-muted-foreground">Prices use {f.currency}; times use {f.timezone}.</p></div>
            <div><Label>City</Label><Input value={f.city} onChange={(e) => set("city", e.target.value)} placeholder="Your city" /></div>
            <div><Label>Area (shown in the customer feed)</Label><Input value={f.area} onChange={(e) => set("area", e.target.value)} placeholder="e.g. Downtown, Soho" /></div>
            <div className="md:col-span-2"><Label>Your customer page address</Label><div className="flex items-center gap-2"><span className="text-sm text-muted-foreground">askbookie.xyz/store/</span><Input aria-label="Customer page name" value={f.slug} onChange={(e) => set("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))} /></div><p className="mt-1 text-xs text-muted-foreground">Your actual share link uses this name on Bookie’s live website.</p></div>
            <div className="md:col-span-2"><Label>Anything customers usually ask (products you use, parking, what to bring…)</Label><Textarea value={f.description} onChange={(e) => set("description", e.target.value)} /></div>
          </div>
        </Section>
        )}

        {stage === 1 && (
        <Section title="Services & pricing" hint="Listed = what you quote. Preferred = where you're happy to close. Floor = the absolute lowest. Add-ons get suggested naturally during booking.">
          {f.services.map((s, i) => (
            <div key={i} className="rounded-md border border-border p-4">
               <div className="grid min-w-0 gap-3 sm:grid-cols-2 md:grid-cols-6 [&>div]:min-w-0">
                <div className="md:col-span-2"><Label>Name</Label><Input value={s.name} onChange={(e) => setSvc(i, { name: e.target.value })} /></div>
                <div><Label>Minutes</Label><Input type="number" value={s.duration_minutes} onChange={(e) => setSvc(i, { duration_minutes: num(e.target.value) })} /></div>
                <div><Label>Listed ({cur})</Label><Input type="number" value={s.list_price} onChange={(e) => setSvc(i, { list_price: num(e.target.value) })} /></div>
                <div><Label>Preferred ({cur})</Label><Input type="number" value={s.preferred_price} onChange={(e) => setSvc(i, { preferred_price: num(e.target.value) })} /></div>
                <div><Label>Floor ({cur})</Label><Input type="number" value={s.floor_price} onChange={(e) => setSvc(i, { floor_price: num(e.target.value) })} /></div>
                <div className="md:col-span-3"><Label>Description</Label><Input value={s.description} onChange={(e) => setSvc(i, { description: e.target.value })} /></div>
                <div className="md:col-span-2"><Label>Each extra person ({cur}, groups)</Label><Input type="number" value={s.group_price_per_person ?? ""} onChange={(e) => setSvc(i, { group_price_per_person: e.target.value === "" ? null : num(e.target.value) })} placeholder="Leave empty = full price each" /></div>
                <div className="flex items-end justify-between gap-2">
                  <label className="flex items-center gap-2 text-sm"><Checkbox checked={s.is_addon} onCheckedChange={(v) => setSvc(i, { is_addon: !!v })} />Add-on</label>
                  <Button variant="ghost" size="sm" onClick={() => set("services", f.services.filter((_, j) => j !== i))}>Remove</Button>
                </div>
              </div>
            </div>
          ))}
          <Button variant="outline" onClick={() => set("services", [...f.services, { name: "", description: "", duration_minutes: 60, list_price: 10000, preferred_price: 9000, floor_price: 8000, group_price_per_person: null, is_addon: false }])}>+ Add service</Button>

          <div className="grid gap-4 border-t border-border pt-4 md:grid-cols-2">
            <label className="flex items-center justify-between gap-3 text-sm">Let the desk negotiate<Switch checked={f.negotiation.enabled} onCheckedChange={(v) => setNeg("enabled", v)} /></label>
            <div className="flex items-center justify-between gap-3 text-sm">Max rounds<Input className="w-24" type="number" value={f.negotiation.max_rounds} onChange={(e) => setNeg("max_rounds", num(e.target.value))} /></div>
            <label className="flex items-center justify-between gap-3 text-sm">Protect weekends (stay near preferred)<Switch checked={f.negotiation.protect_weekends} onCheckedChange={(v) => setNeg("protect_weekends", v)} /></label>
          </div>
          <p className="text-sm font-medium">Trades the desk may offer instead of just dropping the price</p>
          <div className="grid gap-4 md:grid-cols-3">
            <div><Label>Off for moving to a weekday ({cur})</Label><Input type="number" value={f.negotiation.weekday_discount} onChange={(e) => setNeg("weekday_discount", num(e.target.value))} /></div>
            <div><Label>Off for studio instead of home ({cur})</Label><Input type="number" value={f.negotiation.studio_discount} onChange={(e) => setNeg("studio_discount", num(e.target.value))} /></div>
             <div><Label>Off for arranging deposit promptly ({cur})</Label><Input type="number" value={f.negotiation.pay_now_discount} onChange={(e) => setNeg("pay_now_discount", num(e.target.value))} /></div>
          </div>
        </Section>
        )}

        {stage === 2 && (
        <Section title="Where you work">
          <div className="flex flex-wrap gap-4">
            {(["studio", "home", "virtual"] as const).map((m) => (
              <label key={m} className="flex items-center gap-2 text-sm capitalize">
                <Checkbox checked={f.service_modes.includes(m)} onCheckedChange={(v) => set("service_modes", v ? [...f.service_modes, m] : f.service_modes.filter((x) => x !== m))} />
                {m === "home" ? "Home service" : m}
              </label>
            ))}
          </div>
          <div><Label>Studio address</Label><Input value={f.studio_address} onChange={(e) => set("studio_address", e.target.value)} /></div>
          <Label>Home service travel fees</Label>
          {f.location_fees.map((l, i) => (
            <div key={i} className="flex gap-2">
              <Input value={l.area} placeholder="Area" onChange={(e) => set("location_fees", f.location_fees.map((x, j) => (j === i ? { ...x, area: e.target.value } : x)))} />
              <Input type="number" className="w-36" value={l.fee} onChange={(e) => set("location_fees", f.location_fees.map((x, j) => (j === i ? { ...x, fee: num(e.target.value) } : x)))} />
              <Button variant="ghost" onClick={() => set("location_fees", f.location_fees.filter((_, j) => j !== i))}>✕</Button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={() => set("location_fees", [...f.location_fees, { area: "", fee: 0 }])}>+ Add area</Button>
          <div><Label>Any other area</Label><Input value={f.outside_area_rule} onChange={(e) => set("outside_area_rule", e.target.value)} /></div>
        </Section>
        )}

        {stage === 3 && (
        <Section title="Hours & slots">
          <div className="grid gap-2">
            {DAYS.map((d) => {
              const h = f.working_hours[d];
              return (
                <div key={d} className="flex flex-wrap items-center gap-3">
                  <span className="w-12 text-sm font-medium uppercase">{d}</span>
                  <Switch checked={!!h} onCheckedChange={(v) => set("working_hours", { ...f.working_hours, [d]: v ? { open: "09:00", close: "18:00" } : null })} />
                  {h ? (
                    <>
                      <Input type="time" className="w-32" value={h.open} onChange={(e) => set("working_hours", { ...f.working_hours, [d]: { ...h, open: e.target.value } })} />
                      <span className="text-sm">to</span>
                      <Input type="time" className="w-32" value={h.close} onChange={(e) => set("working_hours", { ...f.working_hours, [d]: { ...h, close: e.target.value } })} />
                    </>
                  ) : <span className="text-sm text-muted-foreground">Closed</span>}
                </div>
              );
            })}
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <div><Label>Buffer between bookings (min)</Label><Input type="number" value={f.buffer_minutes} onChange={(e) => set("buffer_minutes", num(e.target.value))} /></div>
            <div><Label>Minimum notice (hours)</Label><Input type="number" value={f.min_notice_hours} onChange={(e) => set("min_notice_hours", num(e.target.value))} /></div>
            <div><Label>Max bookings per day</Label><Input type="number" value={f.max_bookings_per_day} onChange={(e) => set("max_bookings_per_day", num(e.target.value))} /></div>
          </div>
        </Section>
        )}

        {stage === 4 && (
        <Section title="Deposits & policy" hint="If you require a deposit, you arrange payment directly and confirm it in your dashboard after checking your own records.">
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <Label>Deposit type</Label>
              <select className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value={f.deposit_type} onChange={(e) => set("deposit_type", e.target.value as Form["deposit_type"])}>
                <option value="percent">Percentage</option><option value="fixed">Fixed amount</option><option value="full">Full payment</option><option value="none">No deposit</option>
              </select>
            </div>
            {(f.deposit_type === "percent" || f.deposit_type === "fixed") && (
              <div><Label>{f.deposit_type === "percent" ? "Percent %" : `Amount (${cur})`}</Label><Input type="number" value={f.deposit_value} onChange={(e) => set("deposit_value", num(e.target.value))} /></div>
            )}
            <div><Label>Hold slot for (minutes)</Label><Input type="number" value={f.hold_minutes} onChange={(e) => set("hold_minutes", num(e.target.value))} /></div>
          </div>
          <div><Label>Cancellation policy</Label><Textarea value={f.cancellation_policy} onChange={(e) => set("cancellation_policy", e.target.value)} /></div>
          <div className="max-w-xs"><Label>Ask me when a group is bigger than</Label><Input type="number" value={f.escalate_group_over} onChange={(e) => set("escalate_group_over", num(e.target.value))} /></div>
        </Section>
        )}
          </div>
          <div className="sticky bottom-0 mt-8 flex items-center justify-between gap-3 border-t border-border bg-background/95 py-4 backdrop-blur">
            <Button variant="ghost" disabled={stage === 0} onClick={() => setStage(stage - 1)}><ArrowLeft /> Back</Button>
            <Button size="lg" onClick={continueStage} disabled={busy} className="min-w-36">{busy ? "Saving…" : stage === steps.length - 1 ? "Save & go live" : "Continue"} {!busy && <ArrowRight />}</Button>
          </div>
        </div>
      </div>
    </>
  );
}
