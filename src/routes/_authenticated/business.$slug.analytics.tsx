import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";
import { getAnalytics } from "@/lib/owner.functions";
import { Button } from "@/components/ui/button";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { money } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/business/$slug/analytics")({
  head: () => ({ meta: [{ title: "Analytics — Bookie for business" }, { name: "description", content: "Bookings, revenue and conversion from your receptionist." }, { property: "og:title", content: "Analytics — Bookie for business" }, { property: "og:description", content: "See how your receptionist is performing." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: Analytics,
});

const config = { chats: { label: "Chats", color: "var(--color-muted-foreground)" }, bookings: { label: "Bookings", color: "var(--color-primary)" } } satisfies ChartConfig;

function Analytics() {
  const { slug } = Route.useParams();
  const [days, setDays] = useState(7);
  const fetchA = useServerFn(getAnalytics);
  const { data, isLoading } = useQuery({ queryKey: ["analytics", slug, days], queryFn: () => fetchA({ data: { slug, days } }) });
  const tiles = data ? [
    ["Chats", String(data.chats)], ["Bookings", String(data.bookings)], ["Chat → booking", `${data.conversion}%`],
    ["Deposits confirmed", money(data.revenue, data.currency)], ["Booked value", money(data.bookedValue, data.currency)], ["Avg. discount given", money(data.avgDiscount, data.currency)],
  ] : [];
  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-semibold sm:text-3xl">Analytics</h1>
        <div className="flex gap-1">{[7, 30].map((d) => <Button key={d} size="sm" variant={days === d ? "default" : "ghost"} className="rounded-full" onClick={() => setDays(d)}>{d} days</Button>)}</div>
      </div>
      {isLoading && <p className="mt-6 text-sm text-muted-foreground">Loading…</p>}
      {data && <>
        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3">{tiles.map(([l, n]) => <div key={l} className="min-w-0 rounded-lg border border-border bg-card p-3"><p className="truncate font-display text-xl font-semibold sm:text-2xl">{n}</p><p className="text-xs text-muted-foreground">{l}</p></div>)}</div>
        <section className="mt-6 rounded-lg border border-border bg-card p-3 sm:p-4">
          <h2 className="font-semibold">Chats and bookings</h2>
          <ChartContainer config={config} className="mt-3 h-52 w-full">
            <BarChart data={data.series.map((s) => ({ ...s, label: s.day.slice(5) }))}><CartesianGrid vertical={false} /><XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} /><ChartTooltip content={<ChartTooltipContent />} /><Bar dataKey="chats" fill="var(--color-chats)" radius={3} /><Bar dataKey="bookings" fill="var(--color-bookings)" radius={3} /></BarChart>
          </ChartContainer>
        </section>
        <section className="mt-4 rounded-lg border border-border bg-card p-3 sm:p-4">
          <h2 className="font-semibold">Busiest days</h2>
          <ChartContainer config={config} className="mt-3 h-40 w-full">
            <BarChart data={data.weekdays}><XAxis dataKey="day" tickLine={false} axisLine={false} fontSize={11} /><ChartTooltip content={<ChartTooltipContent />} /><Bar dataKey="bookings" fill="var(--color-bookings)" radius={3} /></BarChart>
          </ChartContainer>
        </section>
      </>}
    </>
  );
}
