import { createFileRoute } from "@tanstack/react-router";
import { ReceptionistSetup } from "@/components/ReceptionistSetup";

export const Route = createFileRoute("/_authenticated/business/$slug/receptionist")({
  head: () => ({ meta: [{ title: "Receptionist setup — Bookie for business" }, { name: "description", content: "Configure your AI receptionist's services, prices, hours and rules." }, { property: "og:title", content: "Receptionist setup — Bookie for business" }, { property: "og:description", content: "Configure your AI receptionist." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: () => <ReceptionistSetup slug={Route.useParams().slug} />,
});
