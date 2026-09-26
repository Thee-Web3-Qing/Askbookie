import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/b/$slug")({ beforeLoad: ({ params }) => { throw redirect({ to: "/store/$slug", params: { slug: params.slug }, replace: true, statusCode: 301 }); } });
