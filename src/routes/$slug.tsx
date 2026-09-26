import { createFileRoute, notFound, redirect } from "@tanstack/react-router";
import { RESERVED_SLUGS } from "@/lib/reserved";

// Old shared links (/business-name) now open the store inside the customer app.
export const Route = createFileRoute("/$slug")({
  beforeLoad: ({ params }) => {
    if (RESERVED_SLUGS.has(params.slug)) throw notFound();
    throw redirect({ to: "/store/$slug", params: { slug: params.slug }, replace: true, statusCode: 301 });
  },
  component: () => null,
});
