import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { UIMessage } from "ai";
import { ArrowLeft, Store } from "lucide-react";
import { getConversation } from "@/lib/public.functions";
import { ReceptionChat, type Service } from "@/components/ReceptionChat";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/chat/$id")({
  validateSearch: (s) => z.object({ ask: z.string().max(300).optional() }).parse(s),
  head: () => ({ meta: [{ title: "Chat — Bookie" }, { name: "description", content: "Chat with a business receptionist to book." }, { property: "og:title", content: "Chat — Bookie" }, { property: "og:description", content: "Book by chat on Bookie." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: ChatPage,
});

function ChatPage() {
  const { id } = Route.useParams();
  const { ask } = Route.useSearch();
  const load = useServerFn(getConversation);
  const { data, isLoading } = useQuery({ queryKey: ["chat", id], queryFn: () => load({ data: { id } }), staleTime: Infinity, refetchOnWindowFocus: false });

  if (isLoading) return <div className="grid h-dvh place-items-center text-sm text-muted-foreground">Opening chat…</div>;
  if (!data || !data.vendor) return <div className="grid h-dvh place-items-center p-6 text-center"><div><p className="font-display text-2xl">This chat isn't available.</p><Button asChild className="mt-4"><Link to="/messages">Back to messages</Link></Button></div></div>;
  const v = data.vendor;

  return (
    <div className="flex h-dvh min-w-0 flex-col overflow-hidden bg-card">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-3xl items-center gap-2 px-2 py-2 sm:px-4">
          <Button asChild variant="ghost" size="icon" aria-label="Back to messages"><Link to="/messages"><ArrowLeft className="size-5" /></Link></Button>
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary font-display text-primary-foreground">{v.business_name.charAt(0)}</span>
          <div className="min-w-0 flex-1"><p className="truncate font-semibold leading-tight">{v.business_name}</p><p className="truncate text-xs text-muted-foreground">Receptionist · {v.city}</p></div>
          <Button asChild variant="ghost" size="sm"><Link to="/store/$slug" params={{ slug: v.slug }}><Store className="size-4" /><span className="hidden sm:inline">View store</span></Link></Button>
        </div>
      </header>
      <main className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col">
        <ReceptionChat id={id} ask={ask} initial={data.messages as unknown as UIMessage[]} initialBooking={data.booking} vendorName={v.business_name} currency={v.currency} timeZone={v.timezone} services={data.services as Service[]} />
      </main>
    </div>
  );
}
