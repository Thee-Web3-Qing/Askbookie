import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/inbox/$id")({ beforeLoad: () => { throw redirect({ to: "/business", replace: true }); } });
