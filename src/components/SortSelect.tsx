"use client";

import { useRouter, useSearchParams } from "next/navigation";

const SORTS = [
  { value: "newest", label: "Newest" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
  { value: "name", label: "A-Z" },
];

/** Sort dropdown that writes back to the URL so the server re-queries. */
export default function SortSelect() {
  const router = useRouter();
  const params = useSearchParams();
  const current = params.get("sort") ?? "newest";

  return (
    <label className="flex items-center gap-3">
      <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-espresso/40">
        Sort
      </span>
      <select
        value={current}
        onChange={(e) => {
          const next = new URLSearchParams(params.toString());
          next.set("sort", e.target.value);
          router.push(`/furniture?${next.toString()}`);
        }}
        className="cursor-pointer rounded-full border border-espresso/15 bg-white px-5 py-3 text-xs font-medium text-espresso outline-none transition-colors hover:border-espresso/35"
      >
        {SORTS.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>
    </label>
  );
}
