// Deterministic booking + negotiation engine. The AI only relays numbers this returns.
import type { Database } from "@/integrations/supabase/types";

export type Vendor = Database["public"]["Tables"]["vendors"]["Row"];
export type Service = Database["public"]["Tables"]["services"]["Row"];
export type Conversation = Database["public"]["Tables"]["conversations"]["Row"];

type Hours = Record<string, { open: string; close: string } | null>;
type Negotiation = {
  enabled: boolean;
  max_rounds: number;
  protect_weekends: boolean;
  below_preferred_needs_deposit_now: boolean;
  weekday_discount: number;
  studio_discount: number;
  pay_now_discount: number;
};

const DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

// Offset (minutes) of a time zone from UTC at a given instant, via Intl — handles DST.
function offsetMin(tz: string, at: Date) {
  const parts: Record<string, string> = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(at).map((p) => [p.type, p.value]));
  const asUtc = Date.UTC(Number(parts["year"]), Number(parts["month"]) - 1, Number(parts["day"]), Number(parts["hour"]), Number(parts["minute"]), Number(parts["second"]));
  return Math.round((asUtc - at.getTime()) / 60000);
}
export function zoneDate(d: Date, tz: string) {
  const l = new Date(d.getTime() + offsetMin(tz, d) * 60000);
  return { y: l.getUTCFullYear(), m: l.getUTCMonth(), d: l.getUTCDate(), dow: l.getUTCDay(), h: l.getUTCHours(), min: l.getUTCMinutes() };
}
export function zoneToUtc(dateStr: string, hhmm: string, tz: string) {
  const [y = 0, m = 1, d = 1] = dateStr.split("-").map(Number);
  const [h = 0, mi = 0] = hhmm.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, h, mi);
  const first = guess - offsetMin(tz, new Date(guess)) * 60000;
  return new Date(guess - offsetMin(tz, new Date(first)) * 60000);
}
export function fmtTime(d: Date, tz: string) {
  const l = zoneDate(d, tz);
  const h12 = ((l.h + 11) % 12) + 1;
  return `${h12}:${String(l.min).padStart(2, "0")} ${l.h < 12 ? "AM" : "PM"}`;
}
export function todayIn(tz: string) {
  const l = zoneDate(new Date(), tz);
  return `${l.y}-${String(l.m + 1).padStart(2, "0")}-${String(l.d).padStart(2, "0")}`;
}
export function money(n: number, currency: string) {
  try { return new Intl.NumberFormat("en", { style: "currency", currency, maximumFractionDigits: 0 }).format(n); } catch { return `${currency} ${n}`; }
}
// Round to a "nice" step for the price's size (e.g. 500 for 20,000; 1 for 45).
const roundNice = (n: number) => { const step = Math.max(1, Math.pow(10, Math.floor(Math.log10(Math.max(1, Math.abs(n)))) - 1) / 2); return Math.round(n / step) * step; };

export function isActiveHold(c: Conversation, now = new Date()) {
  if (c.status === "confirmed" || c.status === "completed") return true;
  if ((c.status === "slot_held" || c.status === "awaiting_deposit") && c.hold_expires_at) return new Date(c.hold_expires_at) > now;
  return false;
}

export function dayInfo(vendor: Vendor, dateStr: string) {
  const [y = 0, m = 1, d = 1] = dateStr.split("-").map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  const hours = (vendor.working_hours as Hours)[DAYS[dow] ?? "sun"] ?? null;
  const blocked = (vendor.blocked_dates ?? []).includes(dateStr);
  return { dow, weekend: dow === 0 || dow === 6, hours: blocked ? null : hours, dayName: DAYS[dow] };
}

export function freeSlots(vendor: Vendor, dateStr: string, durationMin: number, bookings: Conversation[], excludeId?: string) {
  const { hours } = dayInfo(vendor, dateStr);
  if (!hours) return { slots: [] as Date[], bookedCount: 0, closed: true };
  const open = zoneToUtc(dateStr, hours.open, vendor.timezone).getTime();
  const close = zoneToUtc(dateStr, hours.close, vendor.timezone).getTime();
  const now = Date.now();
  const earliest = now + vendor.min_notice_hours * 3600000;
  const buf = vendor.buffer_minutes * 60000;
  const dayBookings = bookings.filter(
    (b) => b.id !== excludeId && b.start_at && b.end_at && isActiveHold(b) && new Date(b.start_at).getTime() < close && new Date(b.end_at).getTime() > open,
  );
  const bookedCount = dayBookings.length;
  if (bookedCount >= vendor.max_bookings_per_day) return { slots: [], bookedCount, closed: false };
  const slots: Date[] = [];
  const dur = durationMin * 60000;
  for (let t = open; t + dur <= close; t += 30 * 60000) {
    if (t < earliest) continue;
    const clash = dayBookings.some((b) => {
      const s = new Date(b.start_at!).getTime() - buf;
      const e = new Date(b.end_at!).getTime() + buf;
      return t < e && t + dur > s;
    });
    if (!clash) slots.push(new Date(t));
  }
  return { slots, bookedCount, closed: false };
}

export function demandLevel(vendor: Vendor, dateStr: string, bookedCount: number, slotsLeft: number) {
  const { weekend } = dayInfo(vendor, dateStr);
  const neg = vendor.negotiation as Negotiation;
  if ((weekend && neg.protect_weekends) || slotsLeft <= 2 || bookedCount >= Math.ceil(vendor.max_bookings_per_day / 2)) return "busy";
  if (bookedCount === 0) return "quiet";
  return "normal";
}

export function travelFee(vendor: Vendor, mode: string, area: string) {
  if (mode !== "home") return { fee: 0, known: true };
  const fees = (vendor.location_fees as { area: string; fee: number }[]) ?? [];
  const hit = fees.find((f) => area.toLowerCase().includes(f.area.toLowerCase()) || f.area.toLowerCase().includes(area.toLowerCase()));
  return hit ? { fee: hit.fee, known: true } : { fee: 0, known: false };
}

export function basePrice(service: Service, partySize: number) {
  if (partySize > 1 && service.group_price_per_person) return service.list_price + service.group_price_per_person * (partySize - 1);
  return service.list_price * partySize;
}

export function depositFor(vendor: Vendor, total: number) {
  switch (vendor.deposit_type) {
    case "none": return 0;
    case "fixed": return Math.min(total, vendor.deposit_value);
    case "full": return total;
    default: return roundNice((total * vendor.deposit_value) / 100);
  }
}

/** Core haggling step. Returns what the agent must say, never below the effective floor. */
export function negotiate(args: {
  vendor: Vendor; service: Service; partySize: number; offer: number; round: number; lastCounter: number | null; demand: "busy" | "normal" | "quiet"; mode: string;
}) {
  const { vendor, service, partySize, offer, round, lastCounter, demand, mode } = args;
  const neg = vendor.negotiation as Negotiation;
  const scale = basePrice(service, partySize) / service.list_price;
  const list = roundNice(service.list_price * scale);
  const preferred = roundNice(service.preferred_price * scale);
  const floor = roundNice(service.floor_price * scale);

  if (!neg.enabled) return { decision: "firm" as const, price: list, say: `The price is fixed at ${money(list, vendor.currency)}.`, trades: [] };

  const effFloor = demand === "busy" ? preferred : demand === "normal" ? roundNice((preferred + floor) / 2) : floor;
  const prev = lastCounter ?? list;
  const finalRound = round + 1 >= neg.max_rounds;

  const trades: string[] = [];
  if (demand === "busy" && neg.weekday_discount > 0) trades.push(`${money(Math.max(floor, preferred - neg.weekday_discount), vendor.currency)} if they move to a quieter weekday`);
  if (mode === "home" && neg.studio_discount > 0 && vendor.service_modes.includes("studio")) trades.push(`${money(Math.max(effFloor, prev - neg.studio_discount), vendor.currency)} if they come to the studio instead of home service`);
  if (neg.pay_now_discount > 0) trades.push(`${money(Math.max(effFloor, prev - neg.pay_now_discount), vendor.currency)} if they arrange the deposit promptly with the business (owner verifies payment in their own records)`);

  if (offer >= prev) return { decision: "accept" as const, price: offer, say: `Accept ${money(offer, vendor.currency)}.`, trades: [] };
  if (offer >= effFloor && (offer >= preferred || finalRound)) {
    return { decision: "accept" as const, price: offer, needsDepositNow: offer < preferred && neg.below_preferred_needs_deposit_now, say: `Accept ${money(offer, vendor.currency)}.`, trades: [] };
  }
  if (finalRound) {
    return { decision: "final" as const, price: effFloor, say: `Final offer: ${money(effFloor, vendor.currency)}. Cannot go lower.${offer < floor ? " Offer is below the absolute floor." : ""}`, trades };
  }
  // Move toward the customer, but less than halfway, and never below effective floor.
  let counter = roundNice(prev - (prev - Math.max(offer, effFloor)) * 0.45);
  counter = Math.max(effFloor, Math.min(counter, prev - 500));
  return { decision: "counter" as const, price: counter, say: `Counter at ${money(counter, vendor.currency)} and ask them to come up.`, trades };
}


