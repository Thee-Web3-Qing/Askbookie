import { Link } from "@tanstack/react-router";
import logo from "@/assets/bookie-logo.png.asset.json";

export function Brand({ tone = "dark" }: { tone?: "dark" | "light" }) {
  return (
    <Link to="/" aria-label="Bookie home" className={`inline-flex items-center ${tone === "light" ? "" : "rounded-sm bg-ink px-2 py-1"}`}>
      <img src={logo.url} alt="Bookie" width={1920} height={640} className="h-9 w-auto max-w-[140px] object-contain" />
    </Link>
  );
}
