"use client";

import { useEffect, useState } from "react";

const PROJECT_TYPES = [
  "Custom furniture",
  "Dining table",
  "Wall library",
  "Built-in storage",
  "Kitchen",
  "Restoration",
  "Timber supply",
  "Trade / contract",
  "Something else",
];

const BUDGETS = [
  "Under $2,000",
  "$2,000 - $8,000",
  "$8,000 - $25,000",
  "$25,000 +",
  "Not sure yet",
];

const TIMELINES = ["ASAP", "1-3 months", "3-6 months", "6+ months", "Just planning"];

const field =
  "w-full rounded-2xl border border-espresso/15 bg-cream/60 px-5 py-3.5 text-sm text-espresso outline-none transition-colors placeholder:text-espresso/35 focus:border-terracotta focus:bg-white";

const label = "block text-[11px] font-semibold uppercase tracking-[0.16em] text-espresso/50";

/** The "Get a Quote" enquiry form. Posts to /api/quotes. */
export default function QuoteForm({ productName }: { productName?: string }) {
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  // ?product=slug deep links from a product card's "Get Quote" button.
  useEffect(() => {
    const slug = new URLSearchParams(window.location.search).get("product");
    if (!slug || !productName) return;
    const select = document.getElementById("quote-product") as HTMLInputElement | null;
    if (select) select.value = slug;
  }, [productName]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("sending");
    setError(null);

    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries()) as Record<string, string>;

    try {
      const res = await fetch("/api/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setError(json?.error ?? "Could not send your enquiry");
        setStatus("error");
        return;
      }
      setStatus("sent");
      form.reset();
    } catch {
      setError("Network error - please try again, or email us directly.");
      setStatus("error");
    }
  }

  if (status === "sent") {
    return (
      <div className="rounded-[2.5rem] bg-sage p-10 text-center">
        <span className="mx-auto flex size-16 items-center justify-center rounded-full bg-cream/20">
          <svg viewBox="0 0 24 24" className="size-8 text-cream" fill="none" aria-hidden="true">
            <path
              d="M5 12.5l4.5 4.5L19 7.5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <h3 className="mt-6 text-display text-2xl text-cream">Enquiry received</h3>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-cream/75">
          Thank you. We read every enquiry ourselves and reply within two working
          days - usually with a question, or a rough idea of cost.
        </p>
        <button
          type="button"
          onClick={() => setStatus("idle")}
          className="mt-7 rounded-full bg-cream px-6 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-espresso transition-colors hover:bg-terracotta hover:text-cream"
        >
          Send another
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="rounded-[2.5rem] bg-white p-6 shadow-soft sm:p-9">
      {productName && (
        <input type="hidden" name="product_slug" id="quote-product" defaultValue="" />
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="q-name" className={label}>
            Name <span className="text-terracotta">*</span>
          </label>
          <input id="q-name" name="name" required maxLength={150} className={`mt-2 ${field}`} placeholder="Marta Lindqvist" />
        </div>

        <div>
          <label htmlFor="q-email" className={label}>
            Email <span className="text-terracotta">*</span>
          </label>
          <input
            id="q-email"
            name="email"
            type="email"
            required
            maxLength={255}
            className={`mt-2 ${field}`}
            placeholder="you@example.com"
          />
        </div>

        <div>
          <label htmlFor="q-phone" className={label}>
            Phone
          </label>
          <input id="q-phone" name="phone" maxLength={50} className={`mt-2 ${field}`} placeholder="Optional" />
        </div>

        <div>
          <label htmlFor="q-company" className={label}>
            Company
          </label>
          <input id="q-company" name="company" maxLength={150} className={`mt-2 ${field}`} placeholder="Optional" />
        </div>

        <div>
          <label htmlFor="q-type" className={label}>
            What do you need?
          </label>
          <select id="q-type" name="project_type" defaultValue={productName ? "Custom furniture" : ""} className={`mt-2 ${field} cursor-pointer`}>
            <option value="">Not sure yet</option>
            {PROJECT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="q-budget" className={label}>
            Budget
          </label>
          <select id="q-budget" name="budget" defaultValue="" className={`mt-2 ${field} cursor-pointer`}>
            <option value="">Not sure yet</option>
            {BUDGETS.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="q-timeline" className={label}>
            Timeline
          </label>
          <select id="q-timeline" name="timeline" defaultValue="" className={`mt-2 ${field} cursor-pointer`}>
            <option value="">Not sure yet</option>
            {TIMELINES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="q-message" className={label}>
            About the project <span className="text-terracotta">*</span>
          </label>
          <textarea
            id="q-message"
            name="message"
            required
            rows={6}
            maxLength={4000}
            className={`mt-2 resize-y ${field}`}
            placeholder="Room dimensions, timber you have in mind, what is not working about the current setup…"
          />
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-6 rounded-2xl bg-terracotta/10 px-5 py-4 text-sm text-espresso">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={status === "sending"}
        className="mt-8 w-full rounded-full bg-espresso px-8 py-4 text-xs font-semibold uppercase tracking-[0.14em] text-cream transition-all duration-300 hover:scale-[1.02] hover:bg-terracotta active:scale-[0.98] disabled:pointer-events-none disabled:opacity-60 sm:w-auto"
      >
        {status === "sending" ? "Sending…" : "Send enquiry"}
      </button>

      <p className="mt-5 text-xs text-espresso/45">
        We use your details only to reply to this enquiry. No lists, no forwarding.
      </p>
    </form>
  );
}
