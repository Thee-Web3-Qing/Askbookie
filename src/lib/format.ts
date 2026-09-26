export { money } from "./locale";

export const STATUS_LABEL: Record<string, string> = {
  inquiry: "Inquiry",
  negotiating: "Negotiating",
  slot_held: "Slot held",
  awaiting_deposit: "Awaiting your confirmation",
  confirmed: "Confirmed",
  completed: "Completed",
  cancelled: "Cancelled",
  expired: "Hold expired",
};

// Times are shown in the business's own time zone.
export function whenIn(iso: string | null | undefined, timeZone?: string) {
  if (!iso) return "";
  return new Date(iso).toLocaleString(undefined, { timeZone, weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

export function timeIn(iso: string | null | undefined, timeZone?: string) {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString(undefined, { timeZone, hour: "numeric", minute: "2-digit" });
}
