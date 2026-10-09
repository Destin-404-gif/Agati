"use client";

import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createElement } from "react";
import { ArrowRight, Loader2, PackageSearch, Search, X } from "lucide-react";
import { money } from "@/lib/format";
import {
  CATEGORIES,
  categoryIcon,
  findSubcategory,
  subcategoryHref,
  type NavMatch,
} from "@/lib/navigation";

/* Local mirror of the API shape - deliberately not imported from lib/search,
   which pulls in `pg`. The client only ever sees what the JSON route returns. */
type SuggestionProduct = {
  id: number;
  name: string;
  slug: string;
  price: string;
  image_url: string | null;
  category_name: string | null;
  is_new: boolean;
};

type SuggestionData = {
  products: SuggestionProduct[];
  categories: NavMatch[];
  total: number;
  totalWithCategories: number;
};

type Row =
  | { kind: "product"; value: SuggestionProduct }
  | { kind: "category"; value: NavMatch };

type SearchBarProps = {
  tone?: "dark" | "light";
  /** Drawer / overlay fields are solid; the header pill is translucent. */
  variant?: "header" | "drawer";
  /** Range a category-scoped dropdown range (desktop only). */
  showCategory?: boolean;
  autoFocus?: boolean;
  /** Called when a navigation actually happens (closes the drawer). */
  onNavigate?: () => void;
};

const MIN_CHARS = 2;
const DEBOUNCE_MS = 300;

/** Wraps the matched substring in a <mark> so the hit is easy to scan. */
function Highlight({ text, term }: { text: string; term: string }) {
  const needle = term.trim().toLowerCase();
  if (needle.length < 2) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(needle);
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="rounded-sm bg-terracotta/25 px-0.5 text-espresso">{text.slice(idx, idx + needle.length)}</mark>
      {text.slice(idx + needle.length)}
    </>
  );
}

/** The nav taxonomy icon for a suggestion row (product rows keep their thumb). */
function RowIcon({ row }: { row: Row }) {
  if (row.kind === "product") {
    return (
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-sage/15 text-sage-dark">
        <PackageSearch className="size-4" aria-hidden="true" />
      </span>
    );
  }
  const icon =
    row.value.kind === "category"
      ? categoryIcon(row.value.categorySlug)
      : findSubcategory(row.value.categorySlug, row.value.slug)?.icon;
  const IconCmp = icon ?? PackageSearch;
  return (
    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-sage/15 text-sage-dark">
      {createElement(IconCmp, { className: "size-4", "aria-hidden": true })}
    </span>
  );
}

export default function SearchBar({
  tone = "light",
  variant = "header",
  showCategory = false,
  autoFocus = false,
  onNavigate,
}: SearchBarProps) {
  const router = useRouter();
  const pathname = usePathname();

  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [scoped, setScoped] = useState("all");
  const [data, setData] = useState<SuggestionData>({ products: [], categories: [], total: 0, totalWithCategories: 0 });
  const [active, setActive] = useState(-1);

  const input = useRef<HTMLInputElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const rows: Row[] = [
    ...data.products.map((value) => ({ kind: "product" as const, value })),
    ...data.categories.map((value) => ({ kind: "category" as const, value })),
  ];
  const hasAllRow = data.products.length > 0 || data.categories.length > 0;

  /* ------------------------------------------------ route changes close it */
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpen(false);
    setStatus("idle");
  }, [pathname]);

  /* ------------------------------------------------- outside click + Esc + Cmd/Ctrl+K */
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
        input.current?.focus();
      }
    }
    function onMouseDown(e: MouseEvent) {
      if (open && wrap.current && !wrap.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onMouseDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onMouseDown);
    };
  }, [open]);

  /* ---------------------------------------------------------- debounced fetch */
  useEffect(() => {
    const term = q.trim();
    if (term.length < MIN_CHARS) {
      abortRef.current?.abort();
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStatus("idle");
      setData({ products: [], categories: [], total: 0, totalWithCategories: 0 });
      setActive(-1);
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    const timer = setTimeout(async () => {
      setStatus("loading");
      const params = new URLSearchParams({ q: term, type: "suggest" });
      if (scoped !== "all") params.set("category", scoped);
      try {
        const res = await fetch(`/api/search?${params}`, { signal: controller.signal });
        if (!res.ok) throw new Error(`search: ${res.status}`);
        const json = (await res.json()) as SuggestionData;
        setData(json);
        setActive(json.products.length + json.categories.length > 0 ? 0 : -1);
        setStatus("ok");
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setStatus("error");
      }
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [q, scoped]);

  /* ---------------------------------------------------------------- helpers */
  const term = q.trim();

  function go(href: string) {
    router.push(href);
    setOpen(false);
    setQ("");
    input.current?.blur();
    onNavigate?.();
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (term.length < MIN_CHARS) return; // acceptance: empty/whitespace Enter does nothing
    const params = new URLSearchParams({ q: term });
    if (scoped !== "all") params.set("category", scoped);
    go(`/search?${params}`);
  }

  function selectRow(index: number) {
    const row = rows[index];
    if (!row) return;
    if (row.kind === "product") go(`/furniture/${row.value.slug}`);
    else go(subcategoryHref(row.value.categorySlug, row.value.slug));
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open && term.length >= MIN_CHARS) {
        setOpen(true);
        setActive(0);
        return;
      }
      const total = rows.length + (hasAllRow ? 1 : 0);
      const delta = e.key === "ArrowDown" ? 1 : -1;
      setActive((prev) => {
        const next = prev + delta;
        if (next < 0) return total - 1;
        if (next >= total) return 0;
        return next;
      });
    } else if (e.key === "Enter") {
      if (open && active >= 0 && active < rows.length) {
        e.preventDefault();
        selectRow(active);
      } else if (e.key === "Enter") {
        submit(e as unknown as React.FormEvent);
      }
    } else if (e.key === "Escape") {
      if (open) {
        e.preventDefault();
        setOpen(false);
        setActive(-1);
      }
    }
  }

  // Keep the highlighted option in view while arrow-keying.
  useEffect(() => {
    if (active < 0 || !listRef.current) return;
    const el = listRef.current.querySelector<HTMLElement>(`[data-opt="${active}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const dark = tone === "dark";
  const isDrawer = variant === "drawer";

  return (
    <div ref={wrap} className="relative w-full">
      <form
        role="search"
        onSubmit={submit}
        className={[
          "flex items-center overflow-hidden rounded-full transition-all duration-300",
          isDrawer
            ? "border border-espresso/15 bg-white shadow-soft"
            : dark
              ? "border border-cream/25 bg-white/10 backdrop-blur-sm focus-within:bg-white focus-within:border-white/60"
              : "border border-espresso/15 bg-white/90 shadow-soft focus-within:border-espresso/30",
        ].join(" ")}
      >
        {showCategory && (
          <select
            aria-label="Search within category"
            value={scoped}
            onChange={(e) => {
              setScoped(e.target.value);
              setOpen(true);
            }}
            className={[
              "hidden h-full cursor-pointer appearance-none truncate border-r bg-transparent pl-4 pr-2 text-[11px] font-semibold uppercase tracking-[0.08em] outline-none sm:block",
              dark ? "border-cream/15 text-cream/80" : "border-espresso/10 text-espresso/60",
            ].join(" ")}
          >
            <option value="all">All</option>
            {CATEGORIES.map((c) => (
              <option key={c.slug} value={c.slug} className="text-espresso">
                {c.name}
              </option>
            ))}
          </select>
        )}

        <button
          type="submit"
          aria-label="Search"
          className={[
            "flex size-11 shrink-0 items-center justify-center rounded-full transition-colors",
            dark ? "text-cream hover:text-terracotta-light" : "text-espresso/70 hover:text-terracotta",
          ].join(" ")}
        >
          <Search className="size-[18px]" aria-hidden="true" />
        </button>

        <input
          ref={input}
          type="text"
          inputMode="search"
          role="combobox"
          aria-expanded={open && (rows.length > 0 || hasAllRow)}
          aria-controls="search-suggestions"
          aria-activedescendant={active >= 0 ? `search-opt-${active}` : undefined}
          aria-autocomplete="list"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(e.target.value.trim().length >= MIN_CHARS);
          }}
          onKeyDown={onKeyDown}
          onFocus={() => setOpen(q.trim().length >= MIN_CHARS)}
          autoFocus={autoFocus}
          placeholder="Search oak, walnut, chairs…"
          className={[
            "min-w-0 flex-1 bg-transparent py-2.5 pr-3 text-sm outline-none",
            dark ? "text-espresso placeholder:text-espresso/40" : "text-espresso placeholder:text-espresso/40",
          ].join(" ")}
        />

        {open && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => {
              setQ("");
              input.current?.focus();
            }}
            className={[
              "mr-1.5 flex size-8 shrink-0 items-center justify-center rounded-full transition-colors",
              dark ? "text-cream/60 hover:bg-white/10" : "text-espresso/50 hover:bg-espresso/5",
            ].join(" ")}
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        )}
      </form>

      {/* ----------------------------------------------------------- dropdown */}
      {open && term.length >= MIN_CHARS && (
        <div className="absolute inset-x-0 top-full z-50 mt-2 overflow-hidden rounded-[1.4rem] border border-espresso/10 bg-white shadow-lift">
          {status === "loading" && (
            <div className="flex items-center gap-3 px-5 py-4 text-sm text-espresso/55">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Searching the workshop…
            </div>
          )}

          {status === "error" && (
            <div className="px-5 py-4">
              <p className="text-sm font-medium text-espresso/75">Search is unavailable right now.</p>
              <p className="mt-1 text-xs text-espresso/45">Please try again in a moment.</p>
            </div>
          )}

          {status === "ok" && rows.length === 0 && !hasAllRow && (
            <div className="px-5 py-5">
              <p className="text-sm font-semibold text-espresso">
                No matches for <span className="text-terracotta">“{term}”</span>
              </p>
              <ul className="mt-3 flex flex-wrap gap-2">
                {CATEGORIES.slice(0, 6).map((c) => (
                  <li key={c.slug}>
                    <button
                      type="button"
                      onClick={() => go(`/shop/${c.slug}`)}
                      className="inline-flex items-center gap-1.5 rounded-full border border-espresso/15 px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-espresso/65 transition-colors hover:border-terracotta hover:text-terracotta"
                    >
                      <c.icon className="size-3.5 shrink-0" aria-hidden="true" />
                      {c.name}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {status === "ok" && rows.length > 0 && (
            <ul ref={listRef} id="search-suggestions" role="listbox" aria-label="Search suggestions" className="max-h-[22rem] overflow-y-auto py-1.5">
              {rows.slice(0, 10).map((row, i) => {
                const id = `search-opt-${i}`;
                const selected = active === i || (i === 0 && active < 0);
                return (
                  <li key={id} id={id} role="option" aria-selected={selected} data-opt={i}>
                    {row.kind === "product" ? (
                      <button
                        type="button"
                        onMouseEnter={() => setActive(i)}
                        onClick={() => selectRow(i)}
                        className={[
                          "flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors",
                          selected ? "bg-cream" : "hover:bg-cream/70",
                        ].join(" ")}
                      >
                        <Image
                          src={row.value.image_url ?? ""}
                          alt=""
                          width={44}
                          height={44}
                          className="size-11 shrink-0 rounded-lg bg-espresso/5 object-cover"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13.5px] font-medium text-espresso">
                            <Highlight text={row.value.name} term={term} />
                          </span>
                          <span className="block truncate text-[11px] uppercase tracking-[0.1em] text-espresso/45">
                            {row.value.category_name ?? "Uncategorised"}
                          </span>
                        </span>
                        <span className="shrink-0 text-sm font-semibold tabular-nums text-espresso">
                          {money(row.value.price)}
                        </span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onMouseEnter={() => setActive(i)}
                        onClick={() => selectRow(i)}
                        className={[
                          "flex w-full items-center gap-3 px-4 py-2 text-left transition-colors",
                          selected ? "bg-cream" : "hover:bg-cream/70",
                        ].join(" ")}
                      >
                        <RowIcon row={row} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-medium text-espresso">
                            <Highlight text={row.value.name} term={term} />
                          </span>
                          <span className="block truncate text-[11px] uppercase tracking-[0.1em] text-espresso/45">
                            {row.value.kind === "category" ? "Category" : "Subcategory"} · {row.value.categoryName}
                          </span>
                        </span>
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {status === "ok" && hasAllRow && (
            <button
              type="button"
              onClick={() => submit({ preventDefault: () => undefined } as React.FormEvent)}
              className="flex w-full items-center justify-between border-t border-espresso/10 px-4 py-3 text-[12px] font-semibold uppercase tracking-[0.12em] text-espresso transition-colors hover:bg-cream hover:text-terracotta"
            >
              See all results for <span className="truncate px-1 text-terracotta">“{term}”</span>
              <ArrowRight className="size-4 shrink-0" aria-hidden="true" />
            </button>
          )}

          {status === "idle" && (
            <div className="flex items-center gap-3 px-5 py-4 text-sm text-espresso/55">
              <Search className="size-4" aria-hidden="true" />
              Start typing to search name, timber or SKU…
            </div>
          )}
        </div>
      )}
    </div>
  );
}