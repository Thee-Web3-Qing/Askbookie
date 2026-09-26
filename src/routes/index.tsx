import { createFileRoute, Link } from "@tanstack/react-router";
import { Briefcase, Compass, Store } from "lucide-react";
import { Brand } from "@/components/Brand";
import { Button } from "@/components/ui/button";
import workspaces from "@/assets/bookie-services.jpg";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [
    { title: "Bookie — book local services by chat" },
    { name: "description", content: "Bookie gives service businesses anywhere an AI receptionist: set your rules, share your own booking page, and see customer conversations and appointments in your dashboard." },
    { property: "og:title", content: "Bookie — book local services by chat" },
    { property: "og:description", content: "Set the rules in your dashboard. Customers book through your own page. Bookie handles the conversation." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: Landing,
});

function Landing() {
  const setUp = <Button asChild size="lg" className="h-12 bg-ink-foreground text-ink hover:bg-ink-foreground/90"><Link to="/business/new"><Briefcase />Set up your business</Link></Button>;
  const see = <Button asChild size="lg" variant="outline" className="h-12 border-ink-foreground/60 bg-transparent text-ink-foreground hover:bg-ink-foreground/10 hover:text-ink-foreground"><Link to="/feed"><Compass />See businesses</Link></Button>;
  return <div className="bg-background">
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-ink text-ink-foreground">
      <img src={workspaces} alt="Tools and workspace for service businesses" width={1536} height={1024} className="absolute inset-0 h-full w-full object-cover object-center opacity-40 md:opacity-100" />
      <div className="absolute inset-0 bg-gradient-to-r from-ink via-ink/85 to-ink/30" />
      <header className="relative z-10 mx-auto flex w-full max-w-7xl items-center justify-between gap-2 px-5 py-5 md:px-9">
        <Brand tone="light" />
        <Button asChild variant="ghost" size="sm" className="text-ink-foreground hover:bg-ink-foreground/10 hover:text-ink-foreground"><Link to="/auth">Sign in</Link></Button>
      </header>
      <main className="relative z-10 mx-auto flex w-full max-w-7xl flex-1 items-center px-5 pb-16 md:px-9">
        <section className="max-w-2xl">
          <h1 className="font-display text-5xl font-medium leading-[1.02] sm:text-6xl lg:text-7xl">Book local services <span className="text-gold">by chat.</span></h1>
          <p className="mt-5 max-w-xl text-base text-ink-foreground/85 md:text-lg">Find barbers, photographers, cleaners, tutors and more near you, and book with their receptionist in minutes. Run a business? Give it a receptionist that answers and books for you.</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">{setUp}{see}</div>
        </section>
      </main>
    </div>
    <section className="mx-auto grid max-w-7xl gap-0 border-b border-border px-5 md:grid-cols-2 md:px-9">
      <div className="border-b border-border py-10 md:border-b-0 md:border-r md:pr-10"><Store className="size-6 text-primary" /><h2 className="mt-4 font-display text-3xl">For businesses</h2><p className="mt-2 text-sm leading-relaxed text-muted-foreground">Set your services, prices and hours once. Your receptionist answers customers, discusses prices within your limits and holds appointments. You step in when needed and pay only for the replies it sends.</p><Button asChild className="mt-5"><Link to="/business/new">Set up your business</Link></Button></div>
      <div className="py-10 md:pl-10"><Compass className="size-6 text-primary" /><h2 className="mt-4 font-display text-3xl">For customers</h2><p className="mt-2 text-sm leading-relaxed text-muted-foreground">Browse services in your city, open a store, and chat to agree a time and price. All your chats and bookings stay in one place.</p><Button asChild variant="outline" className="mt-5"><Link to="/feed">See businesses</Link></Button></div>
    </section>
  </div>;
}
