/**
 * Chat constants and rules shared by the storefront widget, the admin inbox and
 * the server routes.
 *
 * Browser-safe by design: no `pg`, no `process.env`, no Node built-ins. The
 * server-only query layer in `./chat.ts` re-exports what the routes need, so a
 * component can import from here without pulling the database into the bundle.
 */

/* ------------------------------------------------------------ lifecycle */

export const CHAT_STATUSES = ["bot", "needs_human", "human", "closed"] as const;
export type ChatStatus = (typeof CHAT_STATUSES)[number];

export const CHAT_SENDERS = ["customer", "bot", "admin"] as const;
export type ChatSender = (typeof CHAT_SENDERS)[number];

/** Statuses the admin inbox still counts as open work. */
export const OPEN_CHAT_STATUSES: ChatStatus[] = ["bot", "needs_human", "human"];

/* --------------------------------------------------------------- limits */

/** Long enough for a real question with dimensions in it, short enough to be a chat. */
export const CHAT_MESSAGE_MAX = 2000;
export const CHAT_NAME_MAX = 150;
export const CHAT_PHONE_MAX = 32;
export const CHAT_EMAIL_MAX = 255;

/** Per-session and per-IP ceilings, applied in the route before any insert. */
export const CHAT_RATE = {
  /** Messages one visitor may send in a minute. */
  perSession: 12,
  perSessionWindowMs: 60_000,
  /** Messages one address may send across sessions, to blunt scripted abuse. */
  perIp: 40,
  perIpWindowMs: 60_000,
} as const;

/** A thread older than this is treated as finished when a visitor returns. */
export const CHAT_SESSION_COOKIE = "agati_chat";
export const CHAT_SESSION_TTL_DAYS = 30;

/* --------------------------------------------------------------- content */

export const CHAT_BUSINESS = {
  name: "Agati Woodworks",
  phone: "0784088929",
  /** International format for wa.me links. */
  whatsapp: "250784088929",
  email: "agatiwoodworks@gmail.com",
  location: "Musanze, Rwanda",
  hours: "Monday to Saturday, 8:00am to 6:00pm. Closed Sundays.",
} as const;

/** The chip row under the welcome message. */
export const CHAT_QUICK_REPLIES = [
  "Pricing",
  "Custom furniture",
  "Delivery",
  "Request a quote",
  "Talk to a person",
] as const;

/** Chips and phrasings that hand off to a human rather than asking the assistant. */
export const HANDOFF_REPLIES = new Set([
  "talk to a person",
  "talk to human",
  "human",
  "agent",
  "real person",
  "speak to someone",
  "whatsapp",
  "call me",
  "call me now",
]);

export const CHAT_WELCOME =
  `Hello, and welcome to ${CHAT_BUSINESS.name}. Ask us about a piece, a price, delivery, or a made-to-measure job and we will answer straight away. If you would rather speak to someone, just say so.`;

export const CHAT_HUMAN_REPLY =
  "Thanks for waiting - I have passed this to the workshop and a team member will reply shortly.";

/** Shown after handoff so the visitor is never left guessing. */
export const CHAT_WHATSAPP_PREFACE = "Prefer WhatsApp? Continue this conversation below.";

/** The ten departments, in the order they appear in the catalogue. */
export const CHAT_CATEGORIES = [
  "Living Room",
  "Bedroom",
  "Office",
  "Dining Room",
  "Kitchen",
  "Outdoor",
  "Chairs & Seating",
  "Storage & Shelving",
  "Kids & Nursery",
  "Custom Furniture",
] as const;

/* ------------------------------------------------------------ sanitising */

/** Tab and newline are legitimate; the rest of the C0 range and DEL are not. */
function isControlChar(ch: string): boolean {
  const code = ch.codePointAt(0) ?? 0;
  if (code === 9 || code === 10) return false;
  return code < 32 || code === 127;
}

/**
 * Clean a customer-supplied string before it is stored.
 *
 * The renderer never uses raw HTML, so this is defence in depth rather than the
 * main defence: control characters go, runs of blank lines collapse, and angle
 * brackets are stripped so nothing reaching an admin's screen can even look like
 * markup. Length is capped here, against the column the caller writes to.
 */
export function sanitizeChatText(input: unknown, max: number): string {
  if (typeof input !== "string") return "";

  let out = "";
  for (const ch of input) {
    if (!isControlChar(ch)) out += ch;
  }

  return out
    .replace(/[<>]/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, max);
}

/** A conversation id the visitor may present, narrowed to something injectable-safe. */
export function isPlausibleSessionId(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{16,64}$/i.test(value);
}

/** A WhatsApp deep link carrying `text`, so the visitor can carry the chat across. */
export function whatsappLink(text: string): string {
  return `https://wa.me/${CHAT_BUSINESS.whatsapp}?text=${encodeURIComponent(text)}`;
}

/** Short time label for message bubbles, in the visitor's own locale. */
export function chatTimeLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}