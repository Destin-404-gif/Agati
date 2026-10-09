"use client";

import Image from "next/image";
import type { ReactNode } from "react";
import { Icon } from "./icons";
import { useConfirmState } from "./overlays";
import { Pagination } from "./useCrudList";
import { Badge, cx, EmptyState, Skeleton, statusTone } from "./ui";
import type { SortState } from "./useCrudList";

/**
 * The admin table used by every module. Sorting, selection and paging are
 * delegated to `useCrudList`, so each module supplies columns and cells only.
 */

export interface Column<T> {
  key: string;
  header: string;
  /** Show the sort control and send this key to the API. */
  sortable?: boolean;
  /** Tailwind classes for the cell. */
  className?: string;
  headerClassName?: string;
  render: (row: T) => ReactNode;
  /** Hide below this breakpoint to keep narrow screens readable. */
  hideBelow?: "sm" | "md" | "lg" | "xl";
}

const HIDE_CLASS: Record<string, string> = {
  sm: "hidden sm:table-cell",
  md: "hidden md:table-cell",
  lg: "hidden lg:table-cell",
  xl: "hidden xl:table-cell",
};

export interface BulkAction {
  label: string;
  icon?: string;
  onClick: (ids: number[]) => void | Promise<void>;
  /** Shown as a destructive confirm dialog. */
  confirm?: string;
  variant?: "secondary" | "danger";
}

export function DataTable<T extends { id: number }>({
  rows,
  loading,
  error,
  columns,
  sort,
  onSort,
  selectable = false,
  selected: propSelected,
  onToggleRow,
  onToggleAll,
  allSelected,
  bulkActions = [],
  page = 1,
  pageCount = 1,
  total = 0,
  perPage = 20,
  onPage,
  onPerPage,
  rowHref,
  emptyTitle = "Nothing here yet",
  emptyDescription,
  emptyAction,
  label = "rows",
  rowKey,
}: {
  rows: T[];
  loading: boolean;
  error?: string | null;
  columns: Column<T>[];
  sort?: SortState;
  onSort?: (key: string) => void;
  selectable?: boolean;
  selected?: number[];
  onToggleRow?: (id: number) => void;
  onToggleAll?: () => void;
  allSelected?: boolean;
  bulkActions?: BulkAction[];
  page?: number;
  pageCount?: number;
  total?: number;
  perPage?: number;
  onPage?: (page: number) => void;
  onPerPage?: (perPage: number) => void;
  rowHref?: (row: T) => string;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
  label?: string;
  rowKey?: (row: T) => string | number;
}) {
  const selected = propSelected ?? [];
  const selectedCount = selected.length;
  const showPaging = Boolean(onPage && pageCount && pageCount > 0);

  if (error) {
    return (
      <div className="rounded-xl border border-terracotta/40 bg-terracotta/10 px-4 py-3 text-sm text-terracotta">
        {error}
      </div>
    );
  }

  if (!loading && rows.length === 0) {
    return (
      <EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} />
    );
  }

  return (
    <div>
      {bulkActions.length > 0 && selectedCount > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-outline bg-fill-faint px-3 py-2">
          <span className="text-xs font-semibold text-fg">
            {selectedCount} selected
          </span>
          <div className="flex flex-wrap gap-2">
            {bulkActions.map((action) => (
              <BulkButton key={action.label} action={action} ids={selected} />
            ))}
          </div>
        </div>
      )}

      <div className="-mx-4 overflow-x-auto sm:mx-0">
        <table className="w-full min-w-max border-collapse text-sm">
          <thead>
            <tr className="border-b border-outline">
              {selectable && (
                <th scope="col" className="w-10 px-4 py-2.5 text-left">
                  <input
                    type="checkbox"
                    checked={Boolean(allSelected)}
                    onChange={onToggleAll}
                    aria-label="Select all rows"
                    className="h-4 w-4 cursor-pointer rounded border-outline-strong accent-sage"
                  />
                </th>
              )}

              {columns.map((col) => {
                const active = sort?.key === col.key;
                return (
                  <th
                    key={col.key}
                    scope="col"
                    className={cx(
                      "px-4 py-2.5 text-left text-[11px] font-semibold tracking-[0.1em] text-fg-muted uppercase",
                      col.headerClassName,
                      col.hideBelow && HIDE_CLASS[col.hideBelow],
                      col.className,
                    )}
                  >
                    {col.sortable && onSort ? (
                      <button
                        type="button"
                        onClick={() => onSort(col.key)}
                        className={cx(
                          "inline-flex cursor-pointer items-center gap-1 transition-colors hover:text-fg",
                          active && "text-fg",
                        )}
                      >
                        {col.header}
                        <Icon
                          name="chevron"
                          className={cx(
                            "h-3 w-3 transition-transform",
                            active && sort?.dir === "asc" ? "rotate-90" : "-rotate-90",
                            !active && "opacity-25",
                          )}
                        />
                      </button>
                    ) : (
                      col.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody>
            {loading
              ? Array.from({ length: 6 }).map((_, i) => (
                  <tr
                    key={`sk-${i}`}
                    className="border-b border-outline-faint"
                  >
                    {selectable && (
                      <td className="px-4 py-3">
                        <Skeleton className="h-4 w-4" />
                      </td>
                    )}
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className={cx(
                          "px-4 py-3",
                          col.hideBelow && HIDE_CLASS[col.hideBelow],
                        )}
                      >
                        <Skeleton className="h-4 w-full max-w-32" />
                      </td>
                    ))}
                  </tr>
                ))
              : rows.map((row) => (
                  <tr
                    key={rowKey ? rowKey(row) : row.id}
                    className={cx(
                      "border-b border-outline-faint transition-colors",
                      "hover:bg-fill-faint",
                      selected?.includes(row.id) && "bg-sage/8 dark:bg-sage/15",
                      rowHref && "cursor-pointer",
                    )}
                    onClick={rowHref ? () => (window.location.href = rowHref(row)) : undefined}
                  >
                    {selectable && (
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selected?.includes(row.id) ?? false}
                          onChange={() => onToggleRow?.(row.id)}
                          aria-label={`Select row ${row.id}`}
                          className="h-4 w-4 cursor-pointer rounded border-outline-strong accent-sage"
                        />
                      </td>
                    )}
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className={cx(
                          "px-4 py-3 align-middle",
                          col.className,
                          col.hideBelow && HIDE_CLASS[col.hideBelow],
                        )}
                      >
                        {col.render(row)}
                      </td>
                    ))}
                  </tr>
                ))}
          </tbody>
        </table>
      </div>

      {showPaging && (
        <div className="mt-4">
          <Pagination
            page={page}
            pageCount={pageCount}
            total={total}
            perPage={perPage}
            onPage={onPage ?? noop}
            onPerPage={onPerPage ?? noop}
            label={label}
          />
        </div>
      )}
    </div>
  );
}

function BulkButton({
  action,
  ids,
}: {
  action: BulkAction;
  ids: number[];
}) {  const { dialog, confirmDialog } = useConfirmState();
  const variant = action.variant ?? "secondary";
  const tone =
    variant === "danger"
      ? "bg-terracotta/12 text-terracotta hover:bg-terracotta/20"
      : "bg-fill-strong text-fg hover:bg-fill-strong";

  return (
    <>
      <button
        type="button"
        onClick={() => {
          if (action.confirm) {
            confirmDialog({
              title: action.label,
              message: action.confirm,
              confirmLabel: action.label,
              variant: "danger",
              onConfirm: () => action.onClick(ids),
            });
          } else {
            void action.onClick(ids);
          }
        }}
        className={cx(
          "inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors",
          tone,
        )}
      >
        {action.icon && <Icon name={action.icon} className="h-3.5 w-3.5" />}
        {action.label}
      </button>

      {dialog}
    </>
  );
}

/* ------------------------------------------------------- shared fragments */

const noop = () => {};

export function Thumb({
  src,
  alt,
  size = 40,
}: {
  src: string | null;
  alt: string;
  size?: number;
}) {
  if (!src) {
    return (
      <span
        style={{ width: size, height: size }}
        className="flex shrink-0 items-center justify-center rounded-lg bg-fill text-fg-faint"
      >
        <Icon name="image" className="h-4 w-4" />
      </span>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={size}
      height={size}
      sizes={`${size}px`}
      className="shrink-0 rounded-lg object-cover"
      style={{ width: size, height: size }}
    />
  );
}

export function StatusBadge({ status }: { status: string }) {
  return <Badge tone={statusTone(status)}>{status.replace(/_/g, " ")}</Badge>;
}
