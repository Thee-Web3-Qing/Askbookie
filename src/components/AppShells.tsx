import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { BarChart3, Briefcase, Compass, Home, MessageCircle, Package, Search, Settings, ShoppingBag, UserRound, Bot, ChevronDown, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Brand } from "./Brand";
import { Button } from "@/components/ui/button";

type Tab = { to: string; params?: Record<string, string>; label: string; icon: typeof Home; exact?: boolean };

function TabBar({ tabs, label }: { tabs: Tab[]; label: string }) {
  return (
    <nav aria-label={label} className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
      <div className="mx-auto grid max-w-lg" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
        {tabs.map((t) => (
          <Link key={t.label} to={t.to as never} params={t.params as never} activeOptions={{ exact: !!t.exact }} className="flex min-w-0 flex-col items-center gap-0.5 px-1 py-2 text-[11px] text-muted-foreground" activeProps={{ className: "!text-primary font-semibold" }}>
            <t.icon className="size-5" aria-hidden />
            <span className="truncate">{t.label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}

function DesktopNav({ tabs, label }: { tabs: Tab[]; label: string }) {
  return (
    <nav aria-label={label} className="hidden items-center gap-1 md:flex">
      {tabs.map((t) => (
        <Link key={t.label} to={t.to as never} params={t.params as never} activeOptions={{ exact: !!t.exact }} className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground" activeProps={{ className: "bg-secondary !text-foreground font-medium" }}>
          <t.icon className="size-4" aria-hidden />{t.label}
        </Link>
      ))}
    </nav>
  );
}

const CUSTOMER_TABS: Tab[] = [
  { to: "/feed", label: "Feed", icon: Compass },
  { to: "/search", label: "Search", icon: Search },
  { to: "/messages", label: "Messages", icon: MessageCircle },
  { to: "/me", label: "Me", icon: UserRound },
];

export function CustomerShell({ children, wide }: { children: ReactNode; wide?: boolean }) {
  return (
    <div className="min-h-dvh bg-background pb-20 md:pb-0">
      <header className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2.5 sm:px-5">
          <Brand />
          <DesktopNav tabs={CUSTOMER_TABS} label="Customer navigation" />
          <Button asChild variant="outline" size="sm" className="shrink-0"><Link to="/business"><Briefcase className="size-4" /><span>For business</span></Link></Button>
        </div>
      </header>
      <main className={`mx-auto w-full px-4 py-5 sm:px-5 md:py-8 ${wide ? "max-w-6xl" : "max-w-3xl"}`}>{children}</main>
      <TabBar tabs={CUSTOMER_TABS} label="Customer tabs" />
    </div>
  );
}

export function VendorShell({ children, slug, name }: { children: ReactNode; slug: string; name?: string | undefined }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const tabs: Tab[] = [
    { to: "/business/$slug", params: { slug }, label: "Home", icon: Home, exact: true },
    { to: "/business/$slug/messages", params: { slug }, label: "Messages", icon: MessageCircle },
    { to: "/business/$slug/analytics", params: { slug }, label: "Analytics", icon: BarChart3 },
    { to: "/business/$slug/inventory", params: { slug }, label: "Inventory", icon: Package },
    { to: "/business/$slug/settings", params: { slug }, label: "Settings", icon: Settings },
  ];
  const desktop: Tab[] = [...tabs.slice(0, 4), { to: "/business/$slug/receptionist", params: { slug }, label: "Receptionist", icon: Bot }, tabs[4]!];
  async function signOut() { await qc.cancelQueries(); qc.clear(); await supabase.auth.signOut(); navigate({ to: "/auth", replace: true }); }
  return (
    <div className="min-h-dvh bg-background pb-20 md:pb-0">
      <header className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-2.5 sm:px-5">
          <Link to="/business" className="flex min-w-0 items-center gap-2 rounded-md px-1 py-1 hover:bg-secondary" title="Switch business">
            <span className="grid size-8 shrink-0 place-items-center rounded-md bg-primary font-display text-sm text-primary-foreground">{(name ?? slug).charAt(0).toUpperCase()}</span>
            <span className="min-w-0"><span className="block truncate text-sm font-semibold leading-tight">{name ?? slug}</span><span className="block text-[11px] leading-tight text-muted-foreground">Bookie for business</span></span>
            <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
          </Link>
          <DesktopNav tabs={desktop} label="Business navigation" />
          <div className="flex shrink-0 items-center gap-1">
            <Button asChild variant="outline" size="sm"><Link to="/feed"><ShoppingBag className="size-4" /><span className="hidden sm:inline">Customer mode</span><span className="sm:hidden">Shop</span></Link></Button>
            <Button variant="ghost" size="icon" onClick={signOut} className="hidden md:inline-flex" title="Sign out" aria-label="Sign out"><LogOut className="size-4" /></Button>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-4 py-5 sm:px-5 md:py-8">{children}</main>
      <TabBar tabs={tabs} label="Business tabs" />
    </div>
  );
}
