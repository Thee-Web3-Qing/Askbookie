import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function admin() {
  return (await import("@/integrations/supabase/client.server")).supabaseAdmin;
}

const PUBLIC_VENDOR = "id, slug, business_name, owner_name, category, description, city, area, country, currency, timezone, service_modes, studio_address, working_hours";

export const getPublicVendor = createServerFn({ method: "GET" })
  .validator((d) => z.object({ slug: z.string().min(1).max(80) }).parse(d))
  .handler(async ({ data }) => {
    const db = await admin();
    const { data: v } = await db.from("vendors").select(PUBLIC_VENDOR).eq("slug", data.slug).maybeSingle();
    if (!v) return null;
    const { data: services } = await db.from("services").select("id, name, description, list_price, duration_minutes, is_addon").eq("vendor_id", v.id).eq("active", true).order("list_price", { ascending: false });
    return { vendor: v, services: services ?? [] };
  });

// Public directory for the customer feed and search. Only listed businesses, only public fields.
export const listBusinesses = createServerFn({ method: "GET" })
  .validator((d) => z.object({ country: z.string().max(2).optional(), city: z.string().max(60).optional(), q: z.string().max(80).optional() }).parse(d))
  .handler(async ({ data }) => {
    const db = await admin();
    let query = db.from("vendors").select("id, slug, business_name, category, description, city, area, country, currency, service_modes").eq("is_listed", true).order("created_at", { ascending: false }).limit(200);
    if (data.country) query = query.eq("country", data.country);
    if (data.city) query = query.ilike("city", data.city);
    const { data: vendors } = await query;
    const list = vendors ?? [];
    const { data: services } = list.length ? await db.from("services").select("vendor_id, name, list_price, is_addon").in("vendor_id", list.map((v) => v.id)).eq("active", true) : { data: [] };
    const rows = list.map((v) => {
      const own = (services ?? []).filter((s) => s.vendor_id === v.id);
      const main = own.filter((s) => !s.is_addon);
      return { ...v, services: main.map((s) => s.name).slice(0, 4), from: main.length ? Math.min(...main.map((s) => s.list_price)) : null, _text: [v.business_name, v.category, v.description, v.area, ...own.map((s) => s.name)].join(" ").toLowerCase() };
    }).filter((v) => v.services.length > 0);
    const q = data.q?.trim().toLowerCase();
    const filtered = q ? rows.filter((r) => q.split(/\s+/).every((w) => r._text.includes(w))) : rows;
    return filtered.map(({ _text, ...r }) => r);
  });

export const startConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) => z.object({ slug: z.string().min(1).max(80), fresh: z.boolean().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const db = await admin();
    await db.from("user_roles").upsert({ user_id: context.userId, role: "customer" }, { onConflict: "user_id,role" });
    await db.from("profiles").upsert({ id: context.userId }, { onConflict: "id", ignoreDuplicates: true });
    const { data: v } = await db.from("vendors").select("id").eq("slug", data.slug).maybeSingle();
    if (!v) throw new Error("Business not found");
    if (!data.fresh) {
      const { data: existing } = await context.supabase.from("conversations").select("id").eq("vendor_id", v.id).eq("customer_id", context.userId).not("status", "in", "(cancelled,completed)").order("updated_at", { ascending: false }).limit(1).maybeSingle();
      if (existing) return { id: existing.id };
    }
    const { data: c, error } = await db.from("conversations").insert({ vendor_id: v.id, customer_id: context.userId }).select("id").single();
    if (error) throw new Error(error.message);
    return { id: c.id };
  });

export const getConversation = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: c } = await context.supabase.from("conversations").select("id, vendor_id, status, deposit_amount, total_price, hold_expires_at, start_at, deposit_paid_at, customer_name, ai_paused").eq("id", data.id).eq("customer_id", context.userId).maybeSingle();
    if (!c) return null;
    const db = await admin();
    if (c.status === "awaiting_deposit" && c.hold_expires_at && new Date(c.hold_expires_at) < new Date()) {
      await db.from("conversations").update({ status: "expired", bucket: "in_progress" }).eq("id", c.id);
      await db.from("events").insert({ vendor_id: c.vendor_id, conversation_id: c.id, kind: "hold_expired" });
      c.status = "expired";
    }
    const { data: vendor } = await db.from("vendors").select("slug, business_name, city, category, currency, timezone").eq("id", c.vendor_id).single();
    const { data: services } = await db.from("services").select("id, name, description, list_price, duration_minutes, is_addon").eq("vendor_id", c.vendor_id).eq("active", true);
    const { data: msgs } = await context.supabase.from("messages").select("ui_message").eq("conversation_id", c.id).order("created_at");
    return { booking: c, vendor, services: services ?? [], messages: (msgs ?? []).map((m) => m.ui_message) };
  });

export const getMyBookings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.from("conversations")
      .select("id, vendor_id, status, customer_name, start_at, total_price, updated_at")
      .eq("customer_id", context.userId).order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    const db = await admin();
    const ids = (data ?? []).map((c) => c.id);
    const vendorIds = [...new Set((data ?? []).map((c) => c.vendor_id))];
    const [{ data: vendors }, { data: msgs }] = await Promise.all([
      vendorIds.length ? db.from("vendors").select("id, slug, business_name, currency, timezone").in("id", vendorIds) : Promise.resolve({ data: [] as { id: string; slug: string; business_name: string; currency: string; timezone: string }[] }),
      ids.length ? context.supabase.from("messages").select("conversation_id, ui_message, created_at").in("conversation_id", ids).order("created_at", { ascending: false }).limit(500) : Promise.resolve({ data: [] as { conversation_id: string; ui_message: unknown; created_at: string }[] }),
    ]);
    return (data ?? []).map((c) => {
      const last = (msgs ?? []).find((m) => m.conversation_id === c.id)?.ui_message as { role?: string; parts?: { type: string; text?: string }[] } | undefined;
      const preview = last?.parts?.filter((p) => p.type === "text").map((p) => p.text).join(" ").slice(0, 120) ?? "";
      return { ...c, preview, fromMe: last?.role === "user", vendor: vendors?.find((v) => v.id === c.vendor_id) ?? null };
    });
  });
