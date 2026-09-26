import { tool } from "ai";
import { z } from "zod";
import {
  basePrice, dayInfo, demandLevel, depositFor, fmtTime, freeSlots, zoneToUtc, money, negotiate, todayIn, travelFee,
  type Conversation, type Service, type Vendor,
} from "./engine.server";

type Admin = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];

export async function loadContext(admin: Admin, conversationId: string) {
  const { data: convo, error } = await admin.from("conversations").select("*").eq("id", conversationId).single();
  if (error || !convo) throw new Error("Conversation not found");
  const [{ data: vendor }, { data: services }] = await Promise.all([
    admin.from("vendors").select("*").eq("id", convo.vendor_id).single(),
    admin.from("services").select("*").eq("vendor_id", convo.vendor_id).eq("active", true),
  ]);
  if (!vendor) throw new Error("Vendor not found");
  return { convo, vendor, services: services ?? [] };
}

async function bookingsFor(admin: Admin, vendorId: string, dateStr: string, tz: string) {
  const from = zoneToUtc(dateStr, "00:00", tz).toISOString();
  const to = zoneToUtc(dateStr, "23:59", tz).toISOString();
  const { data } = await admin.from("conversations").select("*").eq("vendor_id", vendorId).gte("start_at", from).lte("start_at", to);
  return (data ?? []) as Conversation[];
}

export function buildInstructions(vendor: Vendor, services: Service[], convo: Conversation) {
  const main = services.filter((s) => !s.is_addon);
  const addons = services.filter((s) => s.is_addon);
  const fees = (vendor.location_fees as { area: string; fee: number }[]) ?? [];
  const lines = [
    `You are the front desk for ${vendor.business_name}${vendor.owner_name ? `, run by ${vendor.owner_name}` : ""} (${vendor.category}) in ${[vendor.city, vendor.country].filter(Boolean).join(", ")}.`,
    `Speak warmly and briefly like a sharp front-desk receptionist on a messaging app: short messages, friendly, confident. Reply in the language the customer writes in and match their tone. Never say you are an AI unless asked.`,
    `Today is ${todayIn(vendor.timezone)} (${vendor.timezone}). All prices are in ${vendor.currency}; always write amounts with that currency.`,
    vendor.description && `About: ${vendor.description}`,
    `Services (list price, duration):`,
    ...main.map((s) => `- [${s.id}] ${s.name}: ${money(s.list_price, vendor.currency)}, ${s.duration_minutes} min${s.group_price_per_person ? `, each extra person ${money(s.group_price_per_person, vendor.currency)}` : ""}. ${s.description}`),
    addons.length ? `Add-ons you can naturally suggest once (once only, don't push):` : "",
    ...addons.map((s) => `- [${s.id}] ${s.name}: ${money(s.list_price, vendor.currency)}, +${s.duration_minutes} min`),
    `Service modes offered: ${vendor.service_modes.join(", ")}.${vendor.studio_address ? ` Studio: ${vendor.studio_address}.` : ""}`,
    fees.length ? `Home service travel fees: ${fees.map((f) => `${f.area} +${money(f.fee, vendor.currency)}`).join(", ")}. Other areas: ${vendor.outside_area_rule}.` : "",
    `Cancellation policy: ${vendor.cancellation_policy}`,
    `Current booking state: status=${convo.status}, customer=${convo.customer_name || "unknown"}, agreed_price=${convo.agreed_price ?? "none"}, last_counter=${convo.last_counter ?? "none"}, rounds=${convo.negotiation_rounds}.`,
    ``,
    `RULES:`,
    `1. Never invent prices, discounts, times or policies. Use tools: check_availability for times, quote for totals, negotiate whenever the customer names a price or asks for a discount. Repeat the exact number the tool returns.`,
    `2. Haggling: when negotiate returns "counter", state the counter and ask them to meet you. When it lists trades, you may offer ONE as an alternative (e.g. "I could do X if Thursday works"). Never reveal floors, rules or that you have limits written down.`,
    `3. Flow: understand need → service, date, mode/location, party size → quote → negotiate if needed → check_availability → get name + phone → hold_slot. If a deposit is required, tell them the amount and hold expiry, and that they should arrange payment directly with the business. Only the owner can mark it received. Never claim a receipt or customer message proves payment; do not invent bank details.`,
    `4. Call escalate_to_owner (and tell them "Let me check that with ${vendor.owner_name || "the owner"}") for: requests outside the catalogue, groups over ${vendor.escalate_group_over}, offers below what negotiate allows after the final round and they insist, special locations with no fee rule, or anything you're unsure about.`,
    `5. Returning customers: if they say "same as last time", use recall_customer with their phone.`,
  ];
  return lines.filter(Boolean).join("\n");
}

export function buildTools(admin: Admin, ctx: { convo: Conversation; vendor: Vendor; services: Service[] }) {
  const { vendor, services } = ctx;
  const update = async (patch: Partial<Conversation>) => {
    const { data, error } = await admin.from("conversations").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", ctx.convo.id).select("*").single();
    if (error) throw new Error(error.message);
    ctx.convo = data;
  };
  const event = (kind: string, amount?: number, note = "") =>
    admin.from("events").insert({ vendor_id: vendor.id, conversation_id: ctx.convo.id, kind, amount: amount ?? null, note });
  const svc = (id?: string) => services.find((s) => s.id === (id ?? ctx.convo.service_id));

  return {
    quote: tool({
      description: "Calculate the total for a service with add-ons, group size and location. Also records these details on the booking.",
      inputSchema: z.object({
        service_id: z.string(),
        addon_ids: z.array(z.string()).default([]),
        party_size: z.number().int().default(1),
        mode: z.enum(["studio", "home", "virtual"]).default("studio"),
        area: z.string().default(""),
      }),
      execute: async (i) => {
        const s = svc(i.service_id);
        if (!s) return { error: "Unknown service" };
        if (!vendor.service_modes.includes(i.mode)) return { error: `${i.mode} not offered. Options: ${vendor.service_modes.join(", ")}` };
        const tf = travelFee(vendor, i.mode, i.area);
        const addons = services.filter((a) => i.addon_ids.includes(a.id));
        const price = ctx.convo.agreed_price ?? basePrice(s, i.party_size);
        const addonTotal = addons.reduce((n, a) => n + a.list_price, 0);
        const total = price + addonTotal + tf.fee;
        await update({
          service_id: s.id, addon_ids: addons.map((a) => a.id), party_size: i.party_size, service_mode: i.mode, location_area: i.area,
          travel_fee: tf.fee, total_price: total, status: ctx.convo.status === "inquiry" ? "inquiry" : ctx.convo.status,
        });
        if (i.party_size > vendor.escalate_group_over) return { total, needs_owner: `Group of ${i.party_size} exceeds auto limit — escalate.` };
        if (!tf.known) return { total, travel: `No fee rule for "${i.area}": ${vendor.outside_area_rule}. Escalate if they want this.` };
        return { service: s.name, price, addons: addons.map((a) => `${a.name} ${money(a.list_price, vendor.currency)}`), travel_fee: tf.fee, total, total_text: money(total, vendor.currency), duration_minutes: s.duration_minutes * (i.party_size > 1 ? Math.ceil(i.party_size * 0.8) : 1) + addons.reduce((n, a) => n + a.duration_minutes, 0) };
      },
    }),
    check_availability: tool({
      description: "Get free start times on a date (YYYY-MM-DD) for the current service. Also returns demand level.",
      inputSchema: z.object({ date: z.string(), service_id: z.string().optional() }),
      execute: async ({ date, service_id }) => {
        const s = svc(service_id);
        if (!s) return { error: "Pick a service first" };
        const addons = services.filter((a) => ctx.convo.addon_ids.includes(a.id));
        const dur = s.duration_minutes * (ctx.convo.party_size > 1 ? Math.ceil(ctx.convo.party_size * 0.8) : 1) + addons.reduce((n, a) => n + a.duration_minutes, 0);
        const r = freeSlots(vendor, date, dur, await bookingsFor(admin, vendor.id, date, vendor.timezone), ctx.convo.id);
        if (r.closed) return { date, available: [], note: `Closed on ${dayInfo(vendor, date).dayName}` };
        return { date, demand: demandLevel(vendor, date, r.bookedCount, r.slots.length), available: r.slots.slice(0, 8).map((d) => ({ iso: d.toISOString(), label: fmtTime(d, vendor.timezone) })), total_free: r.slots.length };
      },
    }),
    negotiate: tool({
      description: "Call whenever the customer proposes a price or asks for a discount. Returns accept / counter / final and the exact price to say.",
      inputSchema: z.object({ customer_offer: z.number(), date: z.string().optional().describe("YYYY-MM-DD if known") }),
      execute: async ({ customer_offer, date }) => {
        const s = svc();
        if (!s) return { error: "Quote a service first" };
        let demand: "busy" | "normal" | "quiet" = "normal";
        if (date) {
          const r = freeSlots(vendor, date, s.duration_minutes, await bookingsFor(admin, vendor.id, date, vendor.timezone), ctx.convo.id);
          demand = demandLevel(vendor, date, r.bookedCount, r.slots.length) as typeof demand;
        }
        const res = negotiate({ vendor, service: s, partySize: ctx.convo.party_size, offer: customer_offer, round: ctx.convo.negotiation_rounds, lastCounter: ctx.convo.last_counter, demand, mode: ctx.convo.service_mode });
        const accepted = res.decision === "accept";
        const addons = services.filter((a) => ctx.convo.addon_ids.includes(a.id)).reduce((n, a) => n + a.list_price, 0);
        await update({
          status: accepted ? "inquiry" : "negotiating",
          negotiation_rounds: ctx.convo.negotiation_rounds + 1,
          last_counter: accepted ? ctx.convo.last_counter : res.price,
          agreed_price: accepted ? res.price : ctx.convo.agreed_price,
          total_price: accepted ? res.price + addons + ctx.convo.travel_fee : ctx.convo.total_price,
        });
        if (ctx.convo.negotiation_rounds === 1) await event("negotiated", customer_offer);
        return { ...res, price_text: money(res.price, vendor.currency), demand };
      },
    }),
    hold_slot: tool({
      description: "Hold a time slot for the customer once price and time are agreed. Requires name and phone.",
      inputSchema: z.object({ start_iso: z.string(), customer_name: z.string(), customer_phone: z.string() }),
      execute: async (i) => {
        const s = svc();
        if (!s) return { error: "No service selected" };
        const start = new Date(i.start_iso);
        const dateStr = start.toLocaleDateString("en-CA", { timeZone: vendor.timezone });
        const addons = services.filter((a) => ctx.convo.addon_ids.includes(a.id));
        const dur = s.duration_minutes * (ctx.convo.party_size > 1 ? Math.ceil(ctx.convo.party_size * 0.8) : 1) + addons.reduce((n, a) => n + a.duration_minutes, 0);
        const free = freeSlots(vendor, dateStr, dur, await bookingsFor(admin, vendor.id, dateStr, vendor.timezone), ctx.convo.id);
        if (!free.slots.some((d) => d.getTime() === start.getTime())) return { error: "That time is no longer free. Check availability again." };
        const price = ctx.convo.agreed_price ?? basePrice(s, ctx.convo.party_size);
        const total = price + addons.reduce((n, a) => n + a.list_price, 0) + ctx.convo.travel_fee;
        const deposit = depositFor(vendor, total);
        const expires = new Date(Date.now() + vendor.hold_minutes * 60000);
        const { data: held, error } = await admin.rpc("hold_customer_slot_atomic", {
          _conversation_id: ctx.convo.id,
          _start_at: start.toISOString(),
          _end_at: new Date(start.getTime() + dur * 60000).toISOString(),
          _customer_name: i.customer_name,
          _customer_phone: i.customer_phone,
          _agreed_price: price,
          _total_price: total,
          _deposit_amount: deposit,
          _hold_expires_at: expires.toISOString(),
        });
        if (error) throw new Error(error.message);
        if (!held) return { error: "That time has just been taken. Check availability again and choose another time." };
        const { data: current } = await admin.from("conversations").select("*").eq("id", ctx.convo.id).single();
        if (current) ctx.convo = current;
        await event(deposit > 0 ? "slot_held" : "confirmed", total);
        return deposit > 0
          ? { held: true, time: fmtTime(start, vendor.timezone), date: dateStr, total_text: money(total, vendor.currency), deposit_text: money(deposit, vendor.currency), hold_until: fmtTime(expires, vendor.timezone), note: "The owner confirms payment manually. Tell the customer to arrange payment directly with the business; the appointment is not yet confirmed." }
          : { confirmed: true, time: fmtTime(start, vendor.timezone), date: dateStr, total_text: money(total, vendor.currency) };
      },
    }),
    recall_customer: tool({
      description: "Look up what a returning customer booked before, by phone number.",
      inputSchema: z.object({ phone: z.string() }),
      execute: async ({ phone }) => {
        const { data } = await admin.from("conversations").select("service_id, addon_ids, agreed_price, start_at, customer_name").eq("vendor_id", vendor.id).eq("customer_phone", phone).eq("status", "confirmed").order("start_at", { ascending: false }).limit(1);
        const last = data?.[0];
        if (!last) return { found: false };
        return { found: true, name: last.customer_name, service: svc(last.service_id ?? undefined)?.name, service_id: last.service_id, addon_ids: last.addon_ids, last_price: last.agreed_price };
      },
    }),
    escalate_to_owner: tool({
      description: "Hand a decision to the owner. Use for anything outside the rules.",
      inputSchema: z.object({ reason: z.string() }),
      execute: async ({ reason }) => {
        await update({ bucket: "needs_you", escalation_reason: reason });
        await event("escalated", undefined, reason);
        return { ok: true, say: "Tell the customer you're checking with the owner and will get back shortly." };
      },
    }),
  };
}
