"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Icon } from "./icons";
import { Button, cx } from "./ui";

/**
 * Client state for one admin list: search, sort, paging, filters and selection.
 *
 * The URL is the single source of truth, so every list is shareable and the back
 * button works. Fetching is a plain `fetch` against a module's own list endpoint
 * - deliberately not React Query, which is not installed.
 */

export interface SortState {
  key: string;
  dir: "asc" | "desc";
}

export interface CrudListOptions {
  /** Base API path, e.g. "/api/admin/products". */
  endpoint: string;
  /** Extra query values merged into every request and the URL. */
  params?: Record<string, string | undefined>;
  defaultSort?: SortState;
  defaultPerPage?: number;
  /** Debounce for the search box, in ms. */
  debounce?: number;
}

export interface CrudListState<T> {
  rows: T[];
  total: number;
  page: number;
  pageCount: number;
  loading: boolean;
  error: string | null;
  q: string;
  sort: SortState;
  perPage: number;
  filters: Record<string, string>;
  selected: number[];

  /**
   * What the search box should display. Local and immediate, so typing never
   * waits on the debounced URL write; `q` is the committed value.
   */
  searchInput: string;
  setQ: (value: string) => void;
  setSort: (key: string) => void;
  setPage: (value: number) => void;
  setPerPage: (value: number) => void;
  setFilter: (key: string, value: string | undefined) => void;
  clearFilters: () => void;

  toggleRow: (id: number) => void;
  toggleAll: () => void;
  clearSelection: () => void;
  setSelection: (ids: number[]) => void;
  isSelected: (id: number) => boolean;
  allSelected: boolean;

  refresh: () => void;
  /** Fetch JSON from a sibling endpoint with the current query string. */
  request: <TResult>(path?: string, init?: RequestInit) => Promise<TResult>;
  buildUrl: (path?: string) => string;
  setRows: (rows: T[], total?: number) => void;
}

const RESERVED = new Set(["q", "sort", "dir", "page", "perPage", "format"]);

/** Stable empty array so an un-loaded list does not churn referentially. */
const EMPTY_ROWS: never[] = [];

export function useCrudList<T extends { id: number }>(
  options: CrudListOptions,
): CrudListState<T> {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const {
    endpoint,
    params: extraParams,
    defaultSort = { key: "created_at", dir: "desc" },
    defaultPerPage = 20,
    debounce = 300,
  } = options;

  // The URL is the single source of truth for page / perPage / search. Only
  // server results and row selection are local state; the rest is derived.
  const [result, setResult] = useState<{
    rows: T[];
    total: number;
    pageCount: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [settledKey, setSettledKey] = useState<string | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [reloadKey, setReloadKey] = useState(0);

  const q = searchParams.get("q") ?? "";
  const sortKey = searchParams.get("sort") ?? defaultSort.key;
  const sortDir = (searchParams.get("dir") as "asc" | "desc") ?? defaultSort.dir;
  const pageParam = Number(searchParams.get("page") ?? 1);
  const perPageParam = Number(searchParams.get("perPage") ?? defaultPerPage);

  // Search input is local so typing stays responsive; the URL updates debounced.
  const [searchInput, setSearchInput] = useState(q);
  const [appliedQ, setAppliedQ] = useState(q);
  // Back/forward navigation must win over the debounce timer.
  if (q !== appliedQ) {
    setAppliedQ(q);
    setSearchInput(q);
  }
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const filters = useMemo(() => {
    const out: Record<string, string> = {};
    for (const [key, value] of searchParams.entries()) {
      if (RESERVED.has(key) || !value) continue;
      out[key] = value;
    }
    return out;
  }, [searchParams]);

  const queryString = useMemo(() => {
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    if (sortKey) sp.set("sort", sortKey);
    if (sortDir) sp.set("dir", sortDir);
    if (pageParam > 1) sp.set("page", String(pageParam));
    if (perPageParam !== defaultPerPage) sp.set("perPage", String(perPageParam));
    for (const [key, value] of Object.entries({ ...filters, ...extraParams })) {
      if (value) sp.set(key, value);
    }
    return sp.toString();
  }, [
    q,
    sortKey,
    sortDir,
    pageParam,
    perPageParam,
    filters,
    extraParams,
    defaultPerPage,
  ]);

  const buildUrl = useCallback(
    (path?: string) => {
      const base = path ?? endpoint;
      return queryString ? `${base}?${queryString}` : base;
    },
    [endpoint, queryString],
  );

  const request = useCallback(
    async <TResult,>(path?: string, init?: RequestInit): Promise<TResult> => {
      const res = await fetch(buildUrl(path), {
        ...init,
        headers: {
          "content-type": "application/json",
          ...(init?.headers ?? {}),
        },
      });
      const data = (await res.json().catch(() => ({}))) as TResult & {
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data?.error ?? `Request failed (${res.status})`);
      }
      return data;
    },
    [buildUrl],
  );

  /* ------------------------------------------------------------- fetching */

  // Derived rather than set in the effect body, so a new fetch is "in flight"
  // the moment the URL changes without a synchronous setState.
  const fetchKey = `${queryString}|${reloadKey}`;
  const loading = settledKey !== fetchKey;
  const rows = result?.rows ?? EMPTY_ROWS;
  const total = result?.total ?? 0;
  const pageCount = result?.pageCount ?? 1;

  useEffect(() => {
    let cancelled = false;
    const key = fetchKey;

    request<{ rows?: T[]; data?: T[]; total: number; pageCount?: number }>(
      undefined,
      { cache: "no-store" },
    )
      .then((data) => {
        if (cancelled) return;
        setResult({
          rows: data.rows ?? data.data ?? [],
          total: data.total ?? 0,
          pageCount: data.pageCount ?? 1,
        });
        setError(null);
        setSettledKey(key);
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setError(err.message);
        setSettledKey(key);
      });

    return () => {
      cancelled = true;
    };
  }, [request, fetchKey]);

  /* ---------------------------------------------------------- url updates */

  const pushParams = useCallback(
    (mutate: (sp: URLSearchParams) => void, replace = false) => {
      const sp = new URLSearchParams(searchParams.toString());
      mutate(sp);
      const qs = sp.toString();
      const url = qs ? `${pathname}?${qs}` : pathname;
      if (replace) router.replace(url, { scroll: false });
      else router.push(url, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const setQ = useCallback(
    (value: string) => {
      setSearchInput(value);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        pushParams((sp) => {
          if (value.trim()) sp.set("q", value);
          else sp.delete("q");
          sp.delete("page");
        }, true);
      }, debounce);
    },
    [pushParams, debounce],
  );

  const setSort = useCallback(
    (key: string) => {
      pushParams((sp) => {
        if (sortKey === key) {
          sp.set("dir", sortDir === "asc" ? "desc" : "asc");
        } else {
          sp.set("sort", key);
          sp.set("dir", "asc");
        }
        sp.delete("page");
      });
    },
    [pushParams, sortKey, sortDir],
  );

  const setPage = useCallback(
    (value: number) => {
      pushParams((sp) => {
        if (value > 1) sp.set("page", String(value));
        else sp.delete("page");
      });
    },
    [pushParams],
  );

  const setPerPage = useCallback(
    (value: number) => {
      pushParams((sp) => {
        if (value !== defaultPerPage) sp.set("perPage", String(value));
        else sp.delete("perPage");
        sp.delete("page");
      });
    },
    [pushParams, defaultPerPage],
  );

  const setFilter = useCallback(
    (key: string, value: string | undefined) => {
      pushParams((sp) => {
        if (value) sp.set(key, value);
        else sp.delete(key);
        sp.delete("page");
      });
    },
    [pushParams],
  );

  const clearFilters = useCallback(() => {
    pushParams((sp) => {
      for (const key of [...sp.keys()]) {
        if (!RESERVED.has(key)) sp.delete(key);
      }
      sp.delete("q");
      sp.delete("page");
    });
  }, [pushParams]);

  /* ------------------------------------------------------------ selection */

  const toggleRow = useCallback((id: number) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }, []);

  const toggleAll = useCallback(() => {
    setSelected((prev) =>
      prev.length === rows.length ? [] : rows.map((r) => r.id),
    );
  }, [rows]);

  const clearSelection = useCallback(() => setSelected([]), []);
  const isSelected = useCallback(
    (id: number) => selected.includes(id),
    [selected],
  );

  // Selection is meaningless across a page/filter change, so drop it when the
  // query changes. Adjusted during render instead of in an effect.
  const [selectionKey, setSelectionKey] = useState(queryString);
  if (selectionKey !== queryString) {
    setSelectionKey(queryString);
    setSelected([]);
  }

  const refresh = useCallback(() => setReloadKey((k) => k + 1), []);
  const setRows = useCallback((nextRows: T[], nextTotal?: number) => {
    setResult((current) => ({
      rows: nextRows,
      total: nextTotal ?? current?.total ?? nextRows.length,
      pageCount: current?.pageCount ?? 1,
    }));
  }, []);

  return {
    rows,
    total,
    page: pageParam > 0 ? pageParam : 1,
    pageCount,
    loading,
    error,
    q,
    sort: { key: sortKey, dir: sortDir },
    perPage: perPageParam || defaultPerPage,
    filters,
    selected,
    searchInput,
    setQ,
    setSort,
    setPage,
    setPerPage,
    setFilter,
    clearFilters,
    toggleRow,
    toggleAll,
    clearSelection,
    setSelection: setSelected,
    isSelected,
    allSelected: rows.length > 0 && selected.length === rows.length,
    refresh,
    setRows,
    request,
    buildUrl,
  };
}

/* ---------------------------------------------------------- bulk requests */

/** Runs a bulk action against the collection endpoint and refreshes the list. */
export async function bulkRequest(
  list: { buildUrl: (path?: string) => string; refresh: () => void; clearSelection: () => void },
  body: { action: string; ids: number[]; value?: string },
): Promise<void> {
  const res = await fetch(list.buildUrl(), {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? `Bulk action failed (${res.status})`);
  }
  list.clearSelection();
  list.refresh();
}

/* ------------------------------------------------------------- pagination */

export function Pagination({
  page,
  pageCount,
  total,
  perPage,
  onPage,
  onPerPage,
  label = "rows",
}: {
  page: number;
  pageCount: number;
  total: number;
  perPage: number;
  onPage: (page: number) => void;
  onPerPage: (perPage: number) => void;
  label?: string;
}) {
  const from = total === 0 ? 0 : (page - 1) * perPage + 1;
  const to = Math.min(page * perPage, total);

  const numbers: (number | "gap")[] = [];
  const push = (n: number | "gap") => numbers.push(n);
  if (pageCount <= 7) {
    for (let i = 1; i <= pageCount; i += 1) push(i);
  } else {
    push(1);
    if (page > 3) push("gap");
    for (let i = Math.max(2, page - 1); i <= Math.min(pageCount - 1, page + 1); i += 1) {
      push(i);
    }
    if (page < pageCount - 2) push("gap");
    push(pageCount);
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-outline pt-4">
      <p className="text-xs text-fg-soft">
        Showing <span className="font-semibold">{from}</span>-
        <span className="font-semibold">{to}</span> of{" "}
        <span className="font-semibold">{total}</span> {label}
      </p>

      <div className="flex items-center gap-3">
        <label className="flex items-center gap-1.5 text-xs text-fg-soft">
          Rows
          <select
            value={perPage}
            onChange={(e) => onPerPage(Number(e.target.value))}
            className="cursor-pointer rounded-lg border border-outline bg-transparent px-2 py-1 text-xs"
          >
            {[10, 20, 50, 100].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>

        <nav className="flex items-center gap-1" aria-label="Pagination">
          <IconButton
            label="Previous page"
            disabled={page <= 1}
            onClick={() => onPage(page - 1)}
          >
            <Icon name="chevron" className="h-3.5 w-3.5 rotate-180" />
          </IconButton>

          {numbers.map((n, i) =>
            n === "gap" ? (
              <span key={`gap-${i}`} className="px-1 text-xs text-fg-faint">
                …
              </span>
            ) : (
              <button
                key={n}
                type="button"
                onClick={() => onPage(n)}
                aria-current={n === page ? "page" : undefined}
                className={cx(
                  "h-8 min-w-8 cursor-pointer rounded-lg px-2 text-xs font-semibold tabular-nums transition-colors",
                  n === page
                    ? "bg-accent text-on-accent"
                    : "text-fg hover:bg-fill-strong",
                )}
              >
                {n}
              </button>
            ),
          )}

          <IconButton
            label="Next page"
            disabled={page >= pageCount}
            onClick={() => onPage(page + 1)}
          >
            <Icon name="chevron" className="h-3.5 w-3.5" />
          </IconButton>
        </nav>
      </div>
    </div>
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-fg transition-colors hover:bg-fill-strong disabled:cursor-not-allowed disabled:opacity-30"
    >
      {children}
    </button>
  );
}

export { Button };
