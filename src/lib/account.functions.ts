import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Every signed-in person can book. Owning a business does not remove that.
export const enterCustomerAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: roleError } = await supabaseAdmin.from("user_roles").upsert({ user_id: context.userId, role: "customer" }, { onConflict: "user_id,role" });
    if (roleError) throw new Error(roleError.message);
    const { error: profileError } = await context.supabase.from("profiles").upsert({ id: context.userId }, { onConflict: "id", ignoreDuplicates: true });
    if (profileError) throw new Error(profileError.message);
    return { ok: true };
  });

export const getMe = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [{ data: profile }, { data: businesses }] = await Promise.all([
      context.supabase.from("profiles").select("display_name, phone, city, country").eq("id", context.userId).maybeSingle(),
      context.supabase.from("vendors").select("id, slug, business_name").eq("owner_id", context.userId).order("created_at"),
    ]);
    return { profile: profile ?? { display_name: "", phone: "", city: "", country: "" }, businesses: businesses ?? [] };
  });

export const saveProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) => z.object({ display_name: z.string().max(100), phone: z.string().max(30), city: z.string().max(60), country: z.string().max(2) }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("profiles").upsert({ id: context.userId, ...data });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
