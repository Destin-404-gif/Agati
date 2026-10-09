"use client";

import { useCallback, useEffect, useState } from "react";
import { DataTable, type Column } from "./DataTable";
import { Icon } from "./icons";
import { Modal, submitFormById, useConfirmState } from "./overlays";
import { useToast } from "./Toast";
import { useCrudList } from "./useCrudList";
import { Button, Checkbox, Field, Input, Select } from "./ui";
import { formatDateTime } from "@/lib/admin-format";
import { ALL_PERMISSIONS } from "@/lib/admin-nav";
import type { RoleRow, StaffRow } from "@/lib/admin-list";

interface Draft {
  id: number | null;
  email: string;
  full_name: string;
  role_slug: string;
  is_active: boolean;
  password: string;
}

function emptyDraft(roleSlug: string): Draft {
  return {
    id: null,
    email: "",
    full_name: "",
    role_slug: roleSlug,
    is_active: true,
    password: "",
  };
}

export function StaffList({ currentStaffId }: { currentStaffId: number }) {
  const toast = useToast();
  const { dialog, confirmDialog } = useConfirmState();
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);

  const list = useCrudList<StaffRow>({
    endpoint: "/api/admin/staff",
    defaultSort: { key: "email", dir: "asc" },
  });

  const hasFilters = Object.keys(list.filters).length > 0 || Boolean(list.q);

  const loadRoles = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/staff?include=roles", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (res.ok) setRoles(data.roles ?? []);
    } catch {
      /* the role list is only needed for the editor; table still works */
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadRoles();
  }, [loadRoles]);

  async function save() {
    if (!draft) return;
    const isEdit = draft.id !== null;

    const res = await fetch(isEdit ? `/api/admin/staff/${draft.id}` : "/api/admin/staff", {
      method: isEdit ? "PATCH" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(draft),
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      toast.error(data.error ?? "Could not save that staff member.");
      return;
    }

    toast.success(isEdit ? "Staff member updated." : "Staff member created.");
    setDraft(null);
    list.refresh();
  }

  function remove(row: StaffRow) {
    confirmDialog({
      title: `Delete ${row.email}?`,
      message: "Their sessions end immediately and any password resets are removed. This cannot be undone.",
      confirmLabel: "Delete staff member",
      variant: "danger",
      onConfirm: async () => {
        const res = await fetch(`/api/admin/staff/${row.id}`, { method: "DELETE" });
        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          toast.error(data.error ?? "Could not delete that staff member.");
          return;
        }

        toast.success("Staff member deleted.");
        list.refresh();
        void loadRoles();
      },
    });
  }

  const columns: Column<StaffRow>[] = [
    {
      key: "email",
      header: "Staff member",
      sortable: true,
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate font-medium">
            {row.full_name || row.email}
            {row.id === currentStaffId && (
              <span className="ml-2 rounded-full bg-sage/20 px-1.5 py-0.5 text-[10px] font-semibold text-sage">
                you
              </span>
            )}
          </p>
          <p className="truncate text-xs text-fg-muted">
            {row.full_name ? row.email : "-"}
          </p>
        </div>
      ),
    },
    {
      key: "role",
      header: "Role",
      sortable: true,
      render: (row) => row.role_name ?? "No role",
    },
    {
      key: "is_active",
      header: "Status",
      sortable: false,
      render: (row) => (
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
            row.is_active
              ? "bg-sage/20 text-sage"
              : "bg-fill-strong text-fg-soft"
          }`}
        >
          {row.is_active ? "Active" : "Disabled"}
        </span>
      ),
    },
    {
      key: "last_login_at",
      header: "Last login",
      sortable: true,
      hideBelow: "lg",
      className: "whitespace-nowrap text-fg-soft",
      render: (row) => (row.last_login_at ? formatDateTime(row.last_login_at) : "Never"),
    },
    {
      key: "actions",
      header: "",
      sortable: false,
      className: "text-right",
      render: (row) => (
        <div className="flex justify-end gap-1">
          <button
            type="button"
            onClick={() =>
              setDraft({
                id: row.id,
                email: row.email,
                full_name: row.full_name ?? "",
                role_slug: row.role_slug ?? "staff",
                is_active: row.is_active,
                password: "",
              })
            }
            className="cursor-pointer rounded-lg p-2 text-fg-soft transition-colors hover:bg-fill"
            aria-label={`Edit ${row.email}`}
          >
            <Icon name="edit" className="h-4 w-4" filled />
          </button>
          {row.id !== currentStaffId && (
            <button
              type="button"
              onClick={() => remove(row)}
              className="cursor-pointer rounded-lg p-2 text-fg-soft transition-colors hover:bg-terracotta/12 hover:text-terracotta"
              aria-label={`Delete ${row.email}`}
            >
              <Icon name="trash" className="h-4 w-4" filled />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1 sm:max-w-xs">
          <Icon
            name="search"
            className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-fg-faint"
          />
          <input
            type="search"
            value={list.searchInput}
            onChange={(e) => list.setQ(e.target.value)}
            placeholder="Search staff…"
            aria-label="Search staff"
            className="w-full rounded-full border border-outline bg-field py-2 pr-4 pl-9 text-sm text-fg placeholder:text-fg-faint focus-visible:border-outline-strong focus-visible:outline-none"
          />
        </div>

        <Select
          value={list.filters.role ?? ""}
          onChange={(e) => list.setFilter("role", e.target.value || undefined)}
          className="w-auto min-w-32"
          aria-label="Filter by role"
        >
          <option value="">All roles</option>
          {roles.map((r) => (
            <option key={r.slug} value={r.slug}>
              {r.name}
            </option>
          ))}
        </Select>

        <Select
          value={list.filters.active ?? ""}
          onChange={(e) => list.setFilter("active", e.target.value || undefined)}
          className="w-auto min-w-28"
          aria-label="Filter by status"
        >
          <option value="">Any status</option>
          <option value="true">Active</option>
          <option value="false">Disabled</option>
        </Select>

        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={list.clearFilters}>
            Clear
          </Button>
        )}

        <Button
          onClick={() => setDraft(emptyDraft(roles[0]?.slug ?? "staff"))}
          className="ml-auto"
        >
          <Icon name="plus" className="h-4 w-4" filled />
          New staff member
        </Button>
      </div>

      <DataTable
        rows={list.rows}
        loading={list.loading}
        error={list.error}
        columns={columns}
        sort={list.sort}
        onSort={list.setSort}
        page={list.page}
        pageCount={list.pageCount}
        total={list.total}
        perPage={list.perPage}
        onPage={list.setPage}
        onPerPage={list.setPerPage}
        emptyTitle={hasFilters ? "No staff match" : "No staff members yet"}
        label="staff members"
      />

      <section className="mt-8">
        <h2 className="mb-2 font-display text-lg font-semibold">Roles</h2>
        <ul className="divide-y divide-outline-faint rounded-xl border border-outline">
          {roles.map((role) => (
            <li key={role.id} className="px-4 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium">{role.name}</p>
                <span className="rounded-full bg-fill-strong px-2 py-0.5 text-xs text-fg-soft">
                  {role.staff_count} staff
                </span>
              </div>
              {role.description && (
                <p className="mt-0.5 text-sm text-fg-soft">
                  {role.description}
                </p>
              )}
              <div className="mt-2 flex flex-wrap gap-1">
                {role.permissions.length === 0 ? (
                  <span className="text-xs text-fg-muted">
                    No permissions - this role cannot sign in.
                  </span>
                ) : (
                  role.permissions.map((p) => (
                    <span
                      key={p}
                      className="rounded-md bg-fill px-1.5 py-0.5 font-mono text-[11px] text-fg"
                    >
                      {p}
                    </span>
                  ))
                )}
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-fg-muted">
          Roles and their permissions are defined in the database
          ({ALL_PERMISSIONS.length} permission keys available).
        </p>
      </section>

      {draft && (
        <StaffDialog
          draft={draft}
          roles={roles}
          onChange={setDraft}
          onClose={() => setDraft(null)}
          onSave={save}
        />
      )}

      {dialog}
    </>
  );
}

function StaffDialog({
  draft,
  roles,
  onChange,
  onClose,
  onSave,
}: {
  draft: Draft;
  roles: RoleRow[];
  onChange: (next: Draft) => void;
  onClose: () => void;
  onSave: () => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  const isEdit = draft.id !== null;
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    onChange({ ...draft, [key]: value });

  return (
    <Modal
      open
      onClose={onClose}
      title={isEdit ? "Edit staff member" : "New staff member"}
      size="md"
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          {/* Submits the form in the body, so the buttons stay pinned to the
              bottom of the dialog. */}
          <Button
            type="button"
            onClick={() => submitFormById("staff-form")}
            loading={saving}
          >
            {saving ? "Saving…" : isEdit ? "Save changes" : "Create staff member"}
          </Button>
        </>
      }
    >
      <form
        id="staff-form"
        onSubmit={(e) => {
          e.preventDefault();
          void (async () => {
            setSaving(true);
            try {
              await onSave();
            } finally {
              setSaving(false);
            }
          })();
        }}
        className="space-y-4"
      >
        <Field label="Email" htmlFor="s-email" required>
          <Input
            id="s-email"
            type="email"
            value={draft.email}
            required
            maxLength={255}
            onChange={(e) => set("email", e.target.value)}
          />
        </Field>

        <Field label="Full name" htmlFor="s-name">
          <Input
            id="s-name"
            value={draft.full_name}
            maxLength={150}
            onChange={(e) => set("full_name", e.target.value)}
          />
        </Field>

        <Field label="Role" htmlFor="s-role" required>
          <Select
            id="s-role"
            value={draft.role_slug}
            onChange={(e) => set("role_slug", e.target.value)}
          >
            {roles.map((r) => (
              <option key={r.slug} value={r.slug}>
                {r.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label={isEdit ? "New password" : "Password"}
          htmlFor="s-pass"
          hint={isEdit ? "Leave blank to keep the current password." : "At least 10 characters."}
          required={!isEdit}
        >
          <Input
            id="s-pass"
            type="password"
            autoComplete="new-password"
            value={draft.password}
            required={!isEdit}
            minLength={draft.password ? 10 : undefined}
            onChange={(e) => set("password", e.target.value)}
          />
        </Field>

        <Checkbox
          checked={draft.is_active}
          onChange={(e) => set("is_active", e.target.checked)}
          label="Active - can sign in"
        />
      </form>
    </Modal>
  );
}
