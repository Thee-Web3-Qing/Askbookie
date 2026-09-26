import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Brand } from "@/components/Brand";
import { ReceptionistSetup } from "@/components/ReceptionistSetup";

export const Route = createFileRoute("/_authenticated/business/new")({
  head: () => ({ meta: [{ title: "Set up your business — Bookie" }, { name: "description", content: "Add your services, prices and rules so your receptionist can start booking." }, { property: "og:title", content: "Set up your business — Bookie" }, { property: "og:description", content: "Give your business an AI receptionist." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: NewBusiness,
});

function NewBusiness() {
  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b border-border bg-card"><div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2.5"><Brand /><Link to="/business" className="inline-flex items-center gap-1 text-sm text-muted-foreground"><ArrowLeft className="size-4" />Your businesses</Link></div></header>
      <main className="mx-auto max-w-6xl px-4 py-6 md:py-10"><ReceptionistSetup /></main>
    </div>
  );
}
