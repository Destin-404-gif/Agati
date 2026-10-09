"use client";

import { useState, useTransition } from "react";
import { QUOTE_STATUSES, type QuoteStatus } from "@/lib/types";

const TONE: Record<QuoteStatus, string> = {
  new: "bg-terracotta/15 text-terracotta",
  replied: "bg-sage/20 text-sage",
  closed: "bg-fill-faint text-fg-soft",
};

type Props = {
  id: number;
  initial: QuoteStatus;
};

/**
 * Optimistic status dropdown. Reverts to the server's value if the PATCH fails,
 * so the inbox never shows a status the database did not accept.
 */
export default function QuoteStatusSelect({ id, initial }: Props) {
  const [status, setStatus] = useState<QuoteStatus>(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onChange(next: QuoteStatus) {
    const previous = status;
    setStatus(next);
    setError(null);

    startTransition(async () => {
      try {
        const res = await fetch(`/api/quotes/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: next }),
        });

        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as { error?: string } | null;
          setStatus(previous);
          setError(body?.error ?? "Could not save");
        }
      } catch {
        setStatus(previous);
        setError("Network error");
      }
    });
  }

  return (
    <div className="flex items-center gap-2">
      <span
        className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] ${TONE[status]}`}
      >
        {status}
      </span>
      <label className="sr-only" htmlFor={`status-${id}`}>
        Change status for enquiry {id}
      </label>
      <select
        id={`status-${id}`}
        value={status}
        disabled={pending}
        onChange={(e) => onChange(e.target.value as QuoteStatus)}
        className="cursor-pointer rounded-full border border-outline bg-surface px-3 py-1.5 text-[11px] font-medium text-fg outline-none transition-colors hover:border-outline-strong focus-visible:border-outline-strong disabled:opacity-50"
      >
        {QUOTE_STATUSES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      {error && (
        <span role="alert" className="text-[11px] font-medium text-terracotta">
          {error}
        </span>
      )}
    </div>
  );
}
