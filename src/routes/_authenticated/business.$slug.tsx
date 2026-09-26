import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listMyBusinesses } from "@/lib/owner.functions";
import { VendorShell } from "@/components/AppShells";

export const Route = createFileRoute("/_authenticated/business/$slug")({
  component: BusinessLayout,
});

function BusinessLayout() {
  const { slug } = Route.useParams();
  const list = useServerFn(listMyBusinesses);
  const { data } = useQuery({ queryKey: ["my-businesses"], queryFn: () => list() });
  const name = data?.businesses.find((b) => b.slug === slug)?.business_name;
  return <VendorShell slug={slug} name={name}><Outlet /></VendorShell>;
}
