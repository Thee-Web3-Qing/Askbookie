import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { RESERVED_SLUGS } from "./reserved";

async function vendorBySlug(db: Db, userId: string, slug: string) {
  const { data } = await db.from("vendors").select("*").eq("owner_id", userId).eq("slug", slug).maybeSingle();
  if (!data) throw new Error("Business not found");
  return data;
}
type Db = SupabaseClient<Database>;
const Slug = z.object({ slug: z.string().min(1).max(80) });

export const listMyBusinesses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [{ data: vendors }, { data: plan }] = await Promise.all([
      context.supabase.from("vendors").select("id, slug, business_name, category, city").eq("owner_id", context.userId).order("created_at"),
      context.supabase.from("account_plans").select("plan").eq("user_id", context.userId).maybeSingle(),
    ]);
    const ids = (vendors ?? []).map((v) => v.id);
    const { data: needs } = ids.length ? await context.supabase.from("conversations").select("vendor_id").in("vendor_id", ids).eq("bucket", "needs_you") : { data: [] };
    const p = plan?.plan ?? "free";
    return { plan: p, limit: p === "pro" ? 3 : 1, businesses: (vendors ?? []).map((v) => ({ ...v, needsYou: (needs ?? []).filter((n) => n.vendor_id === v.id).length })) };
  });

export const getMyVendor = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((d) => Slug.parse(d))
  .handler(async ({ data, context }) => {
    const vendor = await vendorBySlug(context.supabase, context.userId, data.slug);
    const { data: services } = await context.supabase.from("services").select("*").eq("vendor_id", vendor.id).order("created_at");
    return { vendor, services: services ?? [] };
  });

const ServiceIn = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  description: z.string().default(""),
  duration_minutes: z.number().int().min(10),
  list_price: z.number().int().min(0),
  preferred_price: z.number().int().min(0),
  floor_price: z.number().int().min(0),
  group_price_per_person: z.number().int().nullable().default(null),
  is_addon: z.boolean().default(false),
});

const VendorIn = z.object({
  slug: z.string().min(2).max(60).regex(/^[a-z0-9-]+$/),
  business_name: z.string().min(1),
  owner_name: z.string().default(""),
  category: z.string().default(""),
  description: z.string().default(""),
  city: z.string().default(""),
  country: z.string().length(2),
  currency: z.string().length(3),
  timezone: z.string().min(3).max(60),
  service_modes: z.array(z.enum(["studio", "home", "virtual"])).min(1),
  studio_address: z.string().default(""),
  location_fees: z.array(z.object({ area: z.string(), fee: z.number().int() })),
  outside_area_rule: z.string(),
  working_hours: z.record(z.string(), z.object({ open: z.string(), close: z.string() }).nullable()),
  buffer_minutes: z.number().int(),
  min_notice_hours: z.number().int(),
  max_bookings_per_day: z.number().int().min(1),
  deposit_type: z.enum(["none", "fixed", "percent", "full"]),
  deposit_value: z.number().int(),
  hold_minutes: z.number().int().min(5),
  negotiation: z.object({
    enabled: z.boolean(), max_rounds: z.number().int().min(1), protect_weekends: z.boolean(), below_preferred_needs_deposit_now: z.boolean(),
    weekday_discount: z.number().int(), studio_discount: z.number().int(), pay_now_discount: z.number().int(),
  }),
  escalate_group_over: z.number().int(),
  cancellation_policy: z.string(),
  area: z.string().max(80).default(""),
  is_listed: z.boolean().default(true),
  vendorId: z.string().uuid().nullable().default(null),
  services: z.array(ServiceIn).min(1),
});


export const saveVendor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) => VendorIn.parse(d))
  .handler(async ({ data, context }) => {
    if (RESERVED_SLUGS.has(data.slug)) throw new Error("That booking address is reserved. Choose another name.");
    const { services, vendorId, ...v } = data;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.rpc("ensure_wallet", { _user: context.userId });
    for (const s of services) {
      if (!(s.floor_price <= s.preferred_price && s.preferred_price <= s.list_price)) throw new Error(`${s.name}: floor ≤ preferred ≤ listed price`);
    }
    const { data: existing } = vendorId ? await context.supabase.from("vendors").select("id").eq("owner_id", context.userId).eq("id", vendorId).maybeSingle() : { data: null };
    if (vendorId && !existing) throw new Error("Business not found");
    const { data: saved, error } = existing
      ? await context.supabase.from("vendors").update(v).eq("id", existing.id).select("id").single()
      : await context.supabase.from("vendors").insert({ ...v, owner_id: context.userId }).select("id").single();
    if (error) throw new Error(error.code === "23505" ? "That booking link is taken — try another." : error.message.includes("BUSINESS_LIMIT") ? "You've reached your plan's business limit. Upgrade to Pro for up to 3 businesses." : error.message);
    const { error: roleError } = await supabaseAdmin.from("user_roles").upsert({ user_id: context.userId, role: "vendor" }, { onConflict: "user_id,role" });
    if (roleError) throw new Error(roleError.message);
    const savedId = saved.id;
    const { data: current } = await context.supabase.from("services").select("id").eq("vendor_id", savedId);
    const keep = new Set(services.map((s) => s.id).filter(Boolean));
    const remove = (current ?? []).filter((c) => !keep.has(c.id)).map((c) => c.id);
    if (remove.length) await context.supabase.from("services").update({ active: false }).in("id", remove);
    for (const s of services) {
      const { id, ...rest } = s;
      const res = id
        ? await context.supabase.from("services").update({ ...rest, active: true }).eq("id", id).eq("vendor_id", savedId)
        : await context.supabase.from("services").insert({ ...rest, vendor_id: savedId });
      if (res.error) throw new Error(res.error.message);
    }
    return { ok: true, slug: v.slug };
  });

export const getDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((d) => Slug.parse(d))
  .handler(async ({ data, context }) => {
    const db = context.supabase;
    const vendor = await vendorBySlug(db, context.userId, data.slug);
    const since = new Date(Date.now() - 24 * 3600000).toISOString();
    const [{ data: events }, { data: convos }] = await Promise.all([
      db.from("events").select("kind, amount, conversation_id, created_at").eq("vendor_id", vendor.id).gte("created_at", since),
      db.from("conversations").select("id, customer_name, customer_phone, status, bucket, total_price, deposit_amount, start_at, hold_expires_at, escalation_reason, updated_at, ai_paused").eq("vendor_id", vendor.id).order("updated_at", { ascending: false }).limit(200),
    ]);
    const ev = events ?? [];
    const ids = (k: string) => [...new Set(ev.filter((e) => e.kind === k).map((e) => e.conversation_id).filter(Boolean))] as string[];
    const now = Date.now();
    const list = (convos ?? []).map((c) => ({
      ...c,
      status: c.status === "awaiting_deposit" && c.hold_expires_at && new Date(c.hold_expires_at).getTime() < now ? "expired" : c.status,
    }));
    return {
      vendor: { id: vendor.id, slug: vendor.slug, business_name: vendor.business_name, owner_name: vendor.owner_name, currency: vendor.currency, timezone: vendor.timezone },
      stats: {
        inquiries: { count: ids("inquiry_answered").length, ids: ids("inquiry_answered") },
        confirmed: { count: ids("confirmed").length, ids: ids("confirmed") },
        deposits: { amount: ev.filter((e) => e.kind === "deposit_paid").reduce((n, e) => n + (e.amount ?? 0), 0), ids: ids("deposit_paid") },
        negotiated: { count: ids("negotiated").length, ids: ids("negotiated") },
        held: { count: ids("slot_held").length, ids: ids("slot_held") },
        needsYou: { count: list.filter((c) => c.bucket === "needs_you").length, ids: list.filter((c) => c.bucket === "needs_you").map((c) => c.id) },
      },
      conversations: list.filter((c) => c.status !== "inquiry" || c.customer_name || c.bucket === "needs_you" || ev.some((e) => e.conversation_id === c.id)),
    };
  });

export const getOwnerConversation = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((d) => z.object({ slug: z.string().min(1).max(80), id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const vendor = await vendorBySlug(context.supabase, context.userId, data.slug);
    const { data: c, error } = await context.supabase.from("conversations").select("*, services(name)").eq("id", data.id).eq("vendor_id", vendor.id).single();
    if (error || !c) throw new Error("Not found");
    const { data: msgs } = await context.supabase.from("messages").select("id, role, ui_message, created_at").eq("conversation_id", data.id).order("created_at");
    return { convo: c, messages: msgs ?? [], currency: vendor.currency, timezone: vendor.timezone };
  });

export const ownerReply = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) => z.object({ slug: z.string().min(1).max(80), id: z.string().uuid(), text: z.string().min(1).max(2000) }).parse(d))
  .handler(async ({ data, context }) => {
    const vendor = await vendorBySlug(context.supabase, context.userId, data.slug);
    const { data: owned } = await context.supabase.from("conversations").select("id").eq("id", data.id).eq("vendor_id", vendor.id).maybeSingle();
    if (!owned) throw new Error("Not found");
    const { error } = await context.supabase.from("messages").insert({
      conversation_id: data.id, role: "owner",
      ui_message: { id: `own_${Date.now()}`, role: "assistant", metadata: { by: "owner" }, parts: [{ type: "text", text: data.text }] } as never,
    });
    if (error) throw new Error(error.message);
    await context.supabase.from("conversations").update({ ai_paused: true, updated_at: new Date().toISOString() }).eq("id", data.id).eq("vendor_id", vendor.id);
    return { ok: true };
  });

export const updateConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) =>
    z.object({
      slug: z.string().min(1).max(80),
      id: z.string().uuid(),
      action: z.enum(["pause_ai", "resume_ai", "resolve", "mark_paid", "waive_deposit", "cancel", "complete"]),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const db = context.supabase;
    const vendor = await vendorBySlug(db, context.userId, data.slug);
    const { data: c } = await db.from("conversations").select("*").eq("id", data.id).eq("vendor_id", vendor.id).single();
    if (!c) throw new Error("Not found");
    const patch: Database["public"]["Tables"]["conversations"]["Update"] = { updated_at: new Date().toISOString() };
    const events: { kind: string; amount?: number | null }[] = [];
    switch (data.action) {
      case "pause_ai": patch.ai_paused = true; break;
      case "resume_ai": patch.ai_paused = false; break;
      case "resolve": patch.bucket = c.status === "confirmed" ? "handled" : "in_progress"; patch.escalation_reason = null; patch.ai_paused = false; break;
      case "mark_paid":
        if (c.status !== "awaiting_deposit" || !c.deposit_amount || !c.start_at || !c.hold_expires_at || new Date(c.hold_expires_at) <= new Date()) throw new Error("This deposit hold is no longer active. Ask the customer to book a new time.");
        Object.assign(patch, { deposit_paid_at: new Date().toISOString(), status: "confirmed", bucket: "handled", hold_expires_at: null });
        events.push({ kind: "deposit_paid", amount: c.deposit_amount }, { kind: "confirmed", amount: c.total_price });
        break;
      case "waive_deposit":
        if (c.status !== "awaiting_deposit" || !c.start_at || !c.hold_expires_at || new Date(c.hold_expires_at) <= new Date()) throw new Error("This deposit hold is no longer active. Ask the customer to book a new time.");
        Object.assign(patch, { deposit_amount: 0, status: "confirmed", bucket: "handled", hold_expires_at: null });
        events.push({ kind: "confirmed", amount: c.total_price });
        break;
      case "cancel": Object.assign(patch, { status: "cancelled", bucket: "handled" }); break;
      case "complete": Object.assign(patch, { status: "completed", bucket: "handled" }); break;
    }
    let write = db.from("conversations").update(patch).eq("id", data.id).eq("vendor_id", vendor.id);
    if (data.action === "mark_paid" || data.action === "waive_deposit") write = write.eq("status", "awaiting_deposit").gt("hold_expires_at", new Date().toISOString());
    const { data: updated, error } = await write.select("id").maybeSingle();
    if (error) throw new Error(error.message);
    if (!updated) throw new Error("This booking has changed. Refresh it before confirming.");
    if (events.length) await db.from("events").insert(events.map((e) => ({ ...e, vendor_id: c.vendor_id, conversation_id: c.id })));
    if (data.action === "mark_paid" || data.action === "waive_deposit") {
      const text = data.action === "mark_paid" ? "The business has confirmed your deposit. Your appointment is booked!" : "The business has waived the deposit. Your appointment is booked!";
      await db.from("messages").insert({ conversation_id: c.id, role: "owner", ui_message: { id: `own_${crypto.randomUUID()}`, role: "assistant", metadata: { by: "owner" }, parts: [{ type: "text", text }] } as never });
    }
    return { ok: true };
  });

export const getAnalytics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((d) => z.object({ slug: z.string().min(1).max(80), days: z.number().int().min(1).max(90) }).parse(d))
  .handler(async ({ data, context }) => {
    const db = context.supabase;
    const vendor = await vendorBySlug(db, context.userId, data.slug);
    const since = new Date(Date.now() - data.days * 86400000).toISOString();
    const [{ data: convos }, { data: events }, { data: services }] = await Promise.all([
      db.from("conversations").select("id, status, total_price, agreed_price, service_id, start_at, created_at").eq("vendor_id", vendor.id).gte("created_at", since),
      db.from("events").select("kind, amount, created_at").eq("vendor_id", vendor.id).gte("created_at", since),
      db.from("services").select("id, list_price").eq("vendor_id", vendor.id),
    ]);
    const cs = convos ?? [];
    const booked = cs.filter((c) => ["confirmed", "completed"].includes(c.status));
    const revenue = (events ?? []).filter((e) => e.kind === "deposit_paid").reduce((n, e) => n + (e.amount ?? 0), 0);
    const bookedValue = booked.reduce((n, c) => n + (c.total_price ?? 0), 0);
    const discounts = booked.map((c) => { const s = (services ?? []).find((x) => x.id === c.service_id); return s && c.agreed_price ? Math.max(0, s.list_price - c.agreed_price) : null; }).filter((x): x is number => x != null);
    const dayKey = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: vendor.timezone });
    const series: { day: string; chats: number; bookings: number }[] = [];
    for (let i = data.days - 1; i >= 0; i--) {
      const day = dayKey(new Date(Date.now() - i * 86400000).toISOString());
      series.push({ day, chats: cs.filter((c) => dayKey(c.created_at) === day).length, bookings: booked.filter((c) => dayKey(c.created_at) === day).length });
    }
    const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => ({ day: d, bookings: 0 }));
    booked.forEach((c) => { if (c.start_at) { const w = new Date(new Date(c.start_at).toLocaleString("en-US", { timeZone: vendor.timezone })).getDay(); weekdays[w]!.bookings++; } });
    return {
      chats: cs.length, bookings: booked.length, conversion: cs.length ? Math.round((booked.length / cs.length) * 100) : 0,
      revenue, bookedValue, avgDiscount: discounts.length ? Math.round(discounts.reduce((a, b) => a + b, 0) / discounts.length) : 0,
      series, weekdays, currency: vendor.currency,
    };
  });

export const setServiceActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) => z.object({ slug: z.string().min(1).max(80), id: z.string().uuid(), active: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const vendor = await vendorBySlug(context.supabase, context.userId, data.slug);
    const { error } = await context.supabase.from("services").update({ active: data.active }).eq("id", data.id).eq("vendor_id", vendor.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setListed = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) => z.object({ slug: z.string().min(1).max(80), listed: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const vendor = await vendorBySlug(context.supabase, context.userId, data.slug);
    const { error } = await context.supabase.from("vendors").update({ is_listed: data.listed }).eq("id", vendor.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getBilling = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = context.supabase;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.rpc("ensure_wallet", { _user: context.userId });
    const since = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const [{ data: wallet }, { data: plan }, { data: ledger }, { data: vendors }] = await Promise.all([
      db.from("wallets").select("balance").eq("user_id", context.userId).maybeSingle(),
      db.from("account_plans").select("plan").eq("user_id", context.userId).maybeSingle(),
      db.from("wallet_ledger").select("id, kind, amount, day, note, created_at").eq("user_id", context.userId).order("created_at", { ascending: false }).limit(30),
      db.from("vendors").select("id, business_name").eq("owner_id", context.userId),
    ]);
    const ids = (vendors ?? []).map((v) => v.id);
    const { data: usage } = ids.length ? await db.from("ai_usage").select("vendor_id, day, replies, cost, charged_at").in("vendor_id", ids).gte("day", since).order("day") : { data: [] };
    const u = usage ?? [];
    const pending = u.filter((x) => !x.charged_at).reduce((n, x) => n + x.cost, 0);
    const today = new Date().toISOString().slice(0, 10);
    return {
      balance: wallet?.balance ?? 0, pending, available: (wallet?.balance ?? 0) - pending,
      plan: plan?.plan ?? "free", ledger: ledger ?? [],
      today: u.filter((x) => x.day === today).reduce((a, x) => ({ replies: a.replies + x.replies, cost: a.cost + x.cost }), { replies: 0, cost: 0 }),
      usage: u, businesses: vendors ?? [],
    };
  });

export const deleteBusiness = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) => z.object({ slug: z.string().min(1).max(80), confirm: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    const vendor = await vendorBySlug(context.supabase, context.userId, data.slug);
    if (data.confirm !== vendor.slug) throw new Error("Type the business address exactly to confirm.");
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { data: convos } = await db.from("conversations").select("id").eq("vendor_id", vendor.id);
    const ids = (convos ?? []).map((c) => c.id);
    if (ids.length) await db.from("messages").delete().in("conversation_id", ids);
    await db.from("events").delete().eq("vendor_id", vendor.id);
    await db.from("conversations").delete().eq("vendor_id", vendor.id);
    await db.from("services").delete().eq("vendor_id", vendor.id);
    const { error } = await db.from("vendors").delete().eq("id", vendor.id).eq("owner_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
