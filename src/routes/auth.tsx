import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import workspaces from "@/assets/bookie-services.jpg";
import { Brand } from "@/components/Brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { enterCustomerAccount } from "@/lib/account.functions";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Bookie" },
      { name: "description", content: "Sign in to manage your AI front desk, bookings and deposits." },
      { property: "og:title", content: "Sign in — Bookie" },
      { property: "og:description", content: "Manage your AI front desk." },
       { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const enterCustomer = useServerFn(enterCustomerAccount);
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    async function goToAccount() {
      const target = new URLSearchParams(window.location.search).get("redirect") ?? sessionStorage.getItem("bookie_auth_redirect");
      sessionStorage.removeItem("bookie_auth_redirect");
      const safeTarget = target && /^\/[a-z0-9\-/]*$/.test(target) && !target.startsWith("//") && target !== "/auth" ? target : null;
      try { await enterCustomer(); } catch { /* keep going */ }
      if (safeTarget) { window.location.assign(safeTarget); return; }
      navigate({ to: "/feed" });
    }
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) void goToAccount();
    });
    const { data } = supabase.auth.onAuthStateChange((e, s) => {
      if (s && e === "SIGNED_IN") void goToAccount();
    });
    return () => data.subscription.unsubscribe();
  }, [navigate, enterCustomer]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "up") {
        const { error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin + "/auth" + window.location.search } });
        if (error) throw error;
        toast.success("Check your email to confirm your account.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    const intended = new URLSearchParams(window.location.search).get("redirect");
    if (intended && /^\/[a-z0-9-]+\/?$/.test(intended)) sessionStorage.setItem("bookie_auth_redirect", intended);
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/auth" });
    if (r.error) toast.error(r.error.message ?? "Google sign-in failed");
  }

  return (
    <div className="grid min-h-screen md:grid-cols-2">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-ink p-10 text-ink-foreground md:flex">
        <img src={workspaces} alt="" width={1536} height={1024} className="absolute inset-0 h-full w-full object-cover opacity-45" />
        <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/35 to-ink/50" />
        <div className="relative"><Brand tone="light" /></div>
        <blockquote className="relative max-w-lg font-display text-3xl leading-snug">
          Your business stays yours. Bookie handles the conversations that bring customers in.
        </blockquote>
      </div>
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 md:hidden"><Brand /></div>
          <h1 className="font-display text-3xl">{mode === "in" ? "Welcome back" : "Open your front desk"}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{mode === "in" ? "Sign in to see what was handled." : "Takes about five minutes to set up."}</p>
          <Button variant="outline" className="mt-6 w-full" onClick={google}>Continue with Google</Button>
          <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border" />or<span className="h-px flex-1 bg-border" /></div>
          <form onSubmit={submit} className="space-y-4">
            <div><Label htmlFor="email">Email</Label><Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            <div><Label htmlFor="pw">Password</Label><Input id="pw" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} /></div>
            <Button type="submit" className="w-full" disabled={busy}>{busy ? "Please wait…" : mode === "in" ? "Sign in" : "Create account"}</Button>
          </form>
          <Button variant="link" className="mt-4 px-0 text-sm text-muted-foreground" onClick={() => setMode(mode === "in" ? "up" : "in")}>
            {mode === "in" ? "New here? Create an account" : "Already have an account? Sign in"}
          </Button>
        </div>
      </div>
    </div>
  );
}
