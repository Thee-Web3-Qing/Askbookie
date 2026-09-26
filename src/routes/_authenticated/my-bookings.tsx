import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/my-bookings")({ beforeLoad: () => { throw redirect({ to: "/messages", replace: true }); } });
