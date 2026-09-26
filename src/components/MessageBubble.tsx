import ReactMarkdown from "react-markdown";

type Part = { type: string; text?: string; state?: string; output?: unknown };
type Msg = { id?: string; role: string; parts?: Part[]; metadata?: { by?: string } };

const TOOL_LABEL: Record<string, string> = {
  "tool-quote": "Calculated a quote",
  "tool-check_availability": "Checked the calendar",
  "tool-negotiate": "Negotiated",
  "tool-hold_slot": "Held a slot",
  "tool-recall_customer": "Looked up past bookings",
  "tool-escalate_to_owner": "Asked the owner",
};

export function MessageBubble({ m, view }: { m: Msg; view: "customer" | "owner" }) {
  const mine = view === "customer" ? m.role === "user" : m.role !== "user";
  const byOwner = m.metadata?.by === "owner";
  const text = (m.parts ?? []).filter((p) => p.type === "text").map((p) => p.text).join("\n");
  const tools = view === "owner" ? (m.parts ?? []).filter((p) => p.type.startsWith("tool-")) : [];
  if (!text && tools.length === 0) return null;
  return (
    <div className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
      {tools.length > 0 && (
        <div className="mb-1 flex flex-wrap gap-1">
          {tools.map((t, i) => (
            <span key={i} className="rounded-full bg-secondary px-2 py-0.5 text-[11px] text-secondary-foreground">{TOOL_LABEL[t.type] ?? t.type}</span>
          ))}
        </div>
      )}
      {text && (
        <div
          className={`prose prose-sm max-w-[85%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed [&_p]:my-1 ${
            mine ? "bg-primary text-primary-foreground" : "bg-card text-card-foreground border border-border"
          }`}
        >
          {view === "owner" && m.role !== "user" && <p className="!mb-0.5 text-[10px] uppercase tracking-wider opacity-60">{byOwner ? "You" : "Front desk"}</p>}
          <ReactMarkdown>{text}</ReactMarkdown>
        </div>
      )}
    </div>
  );
}
