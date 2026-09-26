// Countries Bookie supports, with the currency and main time zone used for each.
export type Country = { code: string; name: string; currency: string; timezone: string };

export const COUNTRIES: Country[] = [
  { code: "US", name: "United States", currency: "USD", timezone: "America/New_York" },
  { code: "GB", name: "United Kingdom", currency: "GBP", timezone: "Europe/London" },
  { code: "CA", name: "Canada", currency: "CAD", timezone: "America/Toronto" },
  { code: "AU", name: "Australia", currency: "AUD", timezone: "Australia/Sydney" },
  { code: "IE", name: "Ireland", currency: "EUR", timezone: "Europe/Dublin" },
  { code: "DE", name: "Germany", currency: "EUR", timezone: "Europe/Berlin" },
  { code: "FR", name: "France", currency: "EUR", timezone: "Europe/Paris" },
  { code: "ES", name: "Spain", currency: "EUR", timezone: "Europe/Madrid" },
  { code: "IT", name: "Italy", currency: "EUR", timezone: "Europe/Rome" },
  { code: "NL", name: "Netherlands", currency: "EUR", timezone: "Europe/Amsterdam" },
  { code: "NG", name: "Nigeria", currency: "NGN", timezone: "Africa/Lagos" },
  { code: "GH", name: "Ghana", currency: "GHS", timezone: "Africa/Accra" },
  { code: "KE", name: "Kenya", currency: "KES", timezone: "Africa/Nairobi" },
  { code: "ZA", name: "South Africa", currency: "ZAR", timezone: "Africa/Johannesburg" },
  { code: "EG", name: "Egypt", currency: "EGP", timezone: "Africa/Cairo" },
  { code: "AE", name: "United Arab Emirates", currency: "AED", timezone: "Asia/Dubai" },
  { code: "SA", name: "Saudi Arabia", currency: "SAR", timezone: "Asia/Riyadh" },
  { code: "IN", name: "India", currency: "INR", timezone: "Asia/Kolkata" },
  { code: "PK", name: "Pakistan", currency: "PKR", timezone: "Asia/Karachi" },
  { code: "SG", name: "Singapore", currency: "SGD", timezone: "Asia/Singapore" },
  { code: "PH", name: "Philippines", currency: "PHP", timezone: "Asia/Manila" },
  { code: "JP", name: "Japan", currency: "JPY", timezone: "Asia/Tokyo" },
  { code: "BR", name: "Brazil", currency: "BRL", timezone: "America/Sao_Paulo" },
  { code: "MX", name: "Mexico", currency: "MXN", timezone: "America/Mexico_City" },
];

export const countryByCode = (code: string | null | undefined) => COUNTRIES.find((c) => c.code === code);

export function money(n: number | null | undefined, currency: string) {
  if (n == null) return "—";
  try { return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 0 }).format(n); }
  catch { return `${currency} ${n.toLocaleString()}`; }
}

export const currencySymbol = (currency: string) => {
  try { return new Intl.NumberFormat(undefined, { style: "currency", currency, currencyDisplay: "narrowSymbol" }).formatToParts(0).find((p) => p.type === "currency")?.value ?? currency; }
  catch { return currency; }
};

// Bookie's own AI charges are kept in US cents.
export const cents = (n: number) => new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(n / 100);

export function guessCountry() {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return COUNTRIES.find((c) => c.timezone === tz)?.code ?? "";
  } catch { return ""; }
}
