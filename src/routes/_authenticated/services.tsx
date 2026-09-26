import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/services")({ beforeLoad: () => { throw redirect({ to: "/business", replace: true }); } });
