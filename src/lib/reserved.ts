// Paths owned by the app. Business names can never use these.
export const RESERVED_SLUGS = new Set([
  "api", "auth", "dashboard", "setup", "appointments", "conversations", "services", "inbox", "b", "admin",
  "login", "signup", "sign-in", "sign-up", "privacy", "terms", "favicon.ico", "favicon.png", "my-bookings",
  "feed", "search", "store", "messages", "chat", "me", "business", "new", "settings", "analytics", "inventory", "receptionist",
]);

export const AI_REPLY_PRICE = 2; // US cents per receptionist reply — must match public.ai_reply_price()
export const PLAN_LIMITS: Record<string, number> = { free: 1, pro: 3 };
