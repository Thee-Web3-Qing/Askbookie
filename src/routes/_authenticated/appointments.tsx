import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/appointments")({ beforeLoad: () => { throw redirect({ to: "/business", replace: true }); } });
