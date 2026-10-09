"use client";

/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "./icons";
import { Modal, submitFormById, useConfirmState } from "./overlays";
import { useToast } from "./Toast";
import {
  Badge,
  Button,
  Card,
  Checkbox,
  EmptyState,
  Field,
  Input,
  Select,
  Skeleton,
  cx,
} from "./ui";

type TeamRole = "owner" | "administrator" | "worker";
type TeamStatus = "working" | "off_duty" | "on_leave";

interface TeamMember {
  id: number;
  full_name: string;
  role: TeamRole;
  job_title: string | null;
  phone: string | null;
  email: string | null;
  photo_url: string | null;
  status: TeamStatus;
  is_active: boolean;
  sort_order: number;
}

const ROLE_LABELS: Record<TeamRole, string> = {
  owner: "Owner",
  administrator: "Administrator",
  worker: "Worker",
};

const STATUS_LABELS: Record<TeamStatus, string> = {
  working: "Working",
  off_duty: "Off duty",
  on_leave: "On leave",
};

const STATUS_TONES: Record<TeamStatus, "success" | "neutral" | "warning"> = {
  working: "success",
  off_duty: "neutral",
  on_leave: "warning",
};

const STATUS_CYCLE: TeamStatus[] = ["working", "off_duty", "on_leave"];

const ROLE_ORDER: TeamRole[] = ["owner", "administrator", "worker"];

function initials(name: string): string {
  return name
    .split(/[\s-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

function fetchJson(res: Response, fallback: string) {
  return res.json().catch(() => ({ error: fallback }));
}

function MemberAvatar({ member }: { member: TeamMember }) {
  if (member.photo_url) {
    return (
      <img
        src={member.photo_url}
        alt=""
        className="h-14 w-14 shrink-0 rounded-full border border-outline object-cover"
      />
    );
  }
  return (
    <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-sage text-sm font-bold text-cream">
      {initials(member.full_name)}
    </span>
  );
}

function Stat({
  label,
  value,
  dot,
}: {
  label: string;
  value: number;
  dot?: string;
}) {
  return (
    <Card className="flex items-center gap-4" padded={false}>
      <div className="p-5">
        <p className="font-display text-3xl font-semibold tabular-nums">{value}</p>
        <p className="mt-1 flex items-center gap-2 text-xs font-semibold tracking-wide text-fg-soft uppercase">
          {dot && (
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: dot }} />
          )}
          {label}
        </p>
      </div>
    </Card>
  );
}

function MemberCardSkeleton() {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-outline bg-surface p-4">
      <Skeleton className="h-14 w-14 shrink-0 rounded-full" />
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-3 w-56" />
      </div>
      <Skeleton className="h-6 w-20 rounded-full" />
    </div>
  );
}

interface Draft {
  id: number | null;
  full_name: string;
  role: TeamRole;
  job_title: string;
  phone: string;
  email: string;
  status: TeamStatus;
  sort_order: string;
  is_active: boolean;
  photo_url: string | null;
  pendingPhoto: File | null;
  removingPhoto: boolean;
}

function emptyDraft(role: TeamRole): Draft {
  return {
    id: null,
    full_name: "",
    role,
    job_title: "",
    phone: "",
    email: "",
    status: "working",
    sort_order: "0",
    is_active: true,
    photo_url: null,
    pendingPhoto: null,
    removingPhoto: false,
  };
}

export function TeamManager() {
  const toast = useToast();
  const { dialog, confirmDialog } = useConfirmState();

  const [members, setMembers] = useState<TeamMember[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"all" | "working">("all");
  const [q, setQ] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);

  const dataVersion = useRef(0);

  const load = useCallback(async (opts?: { quiet?: boolean }) => {
    const version = ++dataVersion.current;
    if (!opts?.quiet) setError(null);
    try {
      const res = await fetch("/api/team", { cache: "no-store" });
      const data = await fetchJson(res, "Could not load the team.");
      if (version !== dataVersion.current) return;
      if (!res.ok) {
        setError(data.error ?? "Could not load the team.");
        setMembers([]);
        return;
      }
      setMembers(data);
    } catch {
      if (version !== dataVersion.current) return;
      setError("Could not reach the server. Try again in a moment.");
      setMembers([]);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const hasOwner = useMemo(
    () => members?.some((m) => m.role === "owner") ?? false,
    [members],
  );

  const filtered = useMemo(() => {
    if (!members) return null;
    const needle = q.trim().toLowerCase();
    const list =
      tab === "working"
        ? members.filter((m) => m.status === "working")
        : members;
    if (!needle) return list;
    return list.filter((m) =>
      [m.full_name, m.job_title ?? "", m.email ?? "", m.phone ?? ""].some((f) =>
        f.toLowerCase().includes(needle),
      ),
    );
  }, [members, tab, q]);

  const counts = useMemo(() => {
    const base = { total: 0, working: 0, off_duty: 0, on_leave: 0 };
    if (!members) return base;
    for (const m of members) {
      base.total += 1;
      if (m.status === "working") base.working += 1;
      else if (m.status === "off_duty") base.off_duty += 1;
      else base.on_leave += 1;
    }
    return base;
  }, [members]);

  async function toggleStatus(member: TeamMember) {
    const index = STATUS_CYCLE.indexOf(member.status);
    const next = STATUS_CYCLE[(index + 1) % STATUS_CYCLE.length]!;

    setMembers((prev) =>
      prev
        ? prev.map((m) => (m.id === member.id ? { ...m, status: next } : m))
        : prev,
    );

    const res = await fetch(`/api/team/${member.id}/status`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    const data = await fetchJson(res, "Could not change the status.");

    if (!res.ok) {
      toast.error(data.error ?? "Could not change the status.");
      void load();
      return;
    }

    setMembers((prev) =>
      prev
        ? prev.map((m) => (m.id === member.id ? { ...m, status: data.status } : m))
        : prev,
    );
    toast.success(`${member.full_name} is now ${STATUS_LABELS[data.status as TeamStatus].toLowerCase()}.`);
  }

  async function save() {
    if (!draft) return;
    const isEdit = draft.id !== null;

    const body = {
      fullName: draft.full_name.trim(),
      role: draft.role,
      jobTitle: draft.job_title.trim(),
      phone: draft.phone.trim(),
      email: draft.email.trim(),
      status: draft.status,
      isActive: draft.is_active,
      sortOrder: Math.max(0, Number(draft.sort_order || 0)),
    };

    const res = await fetch(isEdit ? `/api/team/${draft.id}` : "/api/team", {
      method: isEdit ? "PUT" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await fetchJson(res, "Could not save that team member.");

    if (!res.ok) {
      toast.error(data.error ?? "Could not save that team member.");
      return;
    }

    let createdId = draft.id;
    if (!isEdit && data.id) createdId = data.id;

    try {
      if (createdId && draft.pendingPhoto) {
        const form = new FormData();
        form.append("file", draft.pendingPhoto);
        const up = await fetch(`/api/team/${createdId}/photo`, { method: "POST", body: form });
        if (!up.ok) {
          const ud = await fetchJson(up, "Saved, but the photo could not be uploaded.");
          toast.error(ud.error ?? "Saved, but the photo could not be uploaded.");
        } else {
          toast.success(isEdit ? "Team member updated." : "Team member created.");
        }
      } else {
        toast.success(isEdit ? "Team member updated." : "Team member created.");
      }
    } catch {
      toast.success(isEdit ? "Team member updated." : "Team member created.");
    }

    setDraft(null);
    void load();
  }

  function remove(member: TeamMember) {
    confirmDialog({
      title: `Remove ${member.full_name}?`,
      message: "Their photo, contact details and roster entry are removed. This cannot be undone.",
      confirmLabel: "Remove team member",
      variant: "danger",
      onConfirm: async () => {
        const res = await fetch(`/api/team/${member.id}`, { method: "DELETE" });
        const data = await fetchJson(res, "Could not remove that team member.");
        if (!res.ok) {
          toast.error(data.error ?? "Could not remove that team member.");
          return;
        }
        toast.success(`${member.full_name} has been removed from the team.`);
        void load({ quiet: true });
      },
    });
  }

  const sections = useMemo(() => {
    const list = filtered ?? [];
    return ROLE_ORDER.map((role) => ({
      role,
      label: ROLE_LABELS[role],
      members: list.filter((m) => m.role === role),
    })).filter((s) => s.members.length > 0);
  }, [filtered]);

  const empty = filtered !== null && filtered.length === 0;

  return (
    <div className="space-y-6">
      {/* --------------------------------------------------- summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Stat label="Total team" value={counts.total} dot="#c77b5d" />
        <Stat label="Working now" value={counts.working} dot="#7c8a5e" />
        <Stat label="Off duty" value={counts.off_duty} dot="#b8b09f" />
        <Stat label="On leave" value={counts.on_leave} dot="#3a2f24" />
      </div>

      {/* ------------------------------------------------------- toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div
          role="tablist"
          aria-label="Filter team by availability"
          className="flex rounded-full border border-outline bg-surface p-1"
        >
          {([
            { key: "all", label: "All Team" },
            { key: "working", label: "Currently Working" },
          ] as const).map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => setTab(t.key)}
              className={cx(
                "cursor-pointer rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
                tab === t.key
                  ? "bg-accent text-on-accent"
                  : "text-fg-soft hover:text-fg",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="relative min-w-56 flex-1 sm:max-w-xs">
          <Icon
            name="search"
            className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-fg-faint"
          />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search the team…"
            aria-label="Search team members"
            className="w-full rounded-full border border-outline bg-field py-2 pr-4 pl-9 text-sm text-fg placeholder:text-fg-faint focus-visible:border-outline-strong focus-visible:outline-none"
          />
        </div>

        <Button
          onClick={() =>
            setDraft({ ...emptyDraft(hasOwner ? "worker" : "owner"), sort_order: "0" })
          }
          className="ml-auto"
        >
          <Icon name="plus" className="h-4 w-4" filled />
          Add member
        </Button>
      </div>

      {/* --------------------------------------------------------- content */}
      {members === null ? (
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <MemberCardSkeleton key={i} />
            ))}
          </div>
        </div>
      ) : error ? (
        <Card>
          <EmptyState
            title="Could not load the team"
            description={error}
            action={<Button onClick={() => load()}>Try again</Button>}
          />
        </Card>
      ) : empty ? (
        <Card>
          <EmptyState
            title={
              q || tab === "working"
                ? "No team members match"
                : "Your team is empty"
            }
            description={
              q || tab === "working"
                ? "Try a different search, or switch back to All Team."
                : "Add an owner, administrator or worker to get started."
            }
            action={
              q ? undefined : (
                <Button
                  onClick={() =>
                    setDraft({ ...emptyDraft(hasOwner ? "worker" : "owner"), sort_order: "0" })
                  }
                >
                  <Icon name="plus" className="h-4 w-4" filled />
                  Add member
                </Button>
              )
            }
          />
        </Card>
      ) : (
        <div className="space-y-7">
          {sections.map((section) => (
            <section key={section.role}>
              <div className="mb-3 flex items-baseline gap-2">
                <h2 className="font-display text-base font-semibold tracking-tight">
                  {section.label}
                </h2>
                <span className="text-xs font-semibold tracking-wide text-fg-muted uppercase">
                  {section.members.length}
                </span>
              </div>

              <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {section.members.map((member) => (
                  <li key={member.id}>
                    <Card className="group h-full" padded={false}>
                      <div className="flex h-full items-center gap-4 p-4">
                        <MemberAvatar member={member} />

                        <div className="min-w-0 flex-1">
                          <p className="truncate font-semibold text-fg">
                            {member.full_name}
                            {!member.is_active && (
                              <span className="ml-2 rounded-full bg-fill-strong px-1.5 py-0.5 text-[10px] font-semibold text-fg-soft">
                                hidden
                              </span>
                            )}
                          </p>
                          <p className="truncate text-xs text-fg-soft">
                            {member.job_title || ROLE_LABELS[member.role]}
                          </p>
                          {(member.email || member.phone) && (
                            <p className="mt-0.5 truncate text-xs text-fg-muted">
                              {member.email || member.phone}
                            </p>
                          )}
                        </div>

                        <div className="flex shrink-0 flex-col items-end gap-2">
                          <button
                            type="button"
                            onClick={() => toggleStatus(member)}
                            title={`Currently ${STATUS_LABELS[member.status]}. Click to change.`}
                            aria-label={`${member.full_name} is ${STATUS_LABELS[member.status]}. Change status.`}
                            className="cursor-pointer rounded-full transition-opacity hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
                          >
                            <Badge tone={STATUS_TONES[member.status]}>
                              {STATUS_LABELS[member.status]}
                            </Badge>
                          </button>

                          <div className="flex gap-1 opacity-100 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100">
                            <button
                              type="button"
                              onClick={() =>
                                setDraft({
                                  id: member.id,
                                  full_name: member.full_name,
                                  role: member.role,
                                  job_title: member.job_title ?? "",
                                  phone: member.phone ?? "",
                                  email: member.email ?? "",
                                  status: member.status,
                                  sort_order: String(member.sort_order ?? 0),
                                  is_active: member.is_active,
                                  photo_url: member.photo_url,
                                  pendingPhoto: null,
                                  removingPhoto: false,
                                })
                              }
                              className="cursor-pointer rounded-lg p-1.5 text-fg-soft transition-colors hover:bg-fill hover:text-fg"
                              aria-label={`Edit ${member.full_name}`}
                            >
                              <Icon name="edit" className="h-4 w-4" filled />
                            </button>
                            {member.role !== "owner" && (
                              <button
                                type="button"
                                onClick={() => remove(member)}
                                className="cursor-pointer rounded-lg p-1.5 text-fg-soft transition-colors hover:bg-terracotta/12 hover:text-terracotta"
                                aria-label={`Remove ${member.full_name}`}
                              >
                                <Icon name="trash" className="h-4 w-4" filled />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </Card>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {draft && (
        <TeamDialog
          draft={draft}
          hasOwner={hasOwner}
          onChange={setDraft}
          onClose={() => setDraft(null)}
          onSave={save}
        />
      )}

      {dialog}
    </div>
  );
}

/* ------------------------------------------------------------------ dialog */

function TeamDialog({
  draft,
  hasOwner,
  onChange,
  onClose,
  onSave,
}: {
  draft: Draft;
  hasOwner: boolean;
  onChange: (next: Draft) => void;
  onClose: () => void;
  onSave: () => Promise<void>;
}) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const isEdit = draft.id !== null;
  const isOwner = draft.role === "owner";
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    onChange({ ...draft, [key]: value });

  async function uploadPhoto(file: File) {
    if (!draft.id) {
      set("pendingPhoto", file);
      return;
    }
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`/api/team/${draft.id}/photo`, { method: "POST", body: form });
      const data = await fetchJson(res, "Could not upload that photo.");
      if (!res.ok) {
        toast.error(data.error ?? "Could not upload that photo.");
        return;
      }
      set("photo_url", data.photo_url ?? null);
      toast.success("Photo updated.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function removePhoto() {
    if (!draft.id) {
      set("removingPhoto", true);
      return;
    }
    setUploading(true);
    try {
      const res = await fetch(`/api/team/${draft.id}/photo`, { method: "DELETE" });
      if (!res.ok) {
        const data = await fetchJson(res, "Could not remove that photo.");
        toast.error(data.error ?? "Could not remove that photo.");
        return;
      }
      set("photo_url", null);
      set("pendingPhoto", null);
      toast.success("Photo removed.");
    } finally {
      setUploading(false);
    }
  }

  // When the existing owner is edited, the role must stay put: there can only
  // be one, and it can never be deleted.
  const roleLocked = draft.id !== null && hasOwner && isOwner;

  const photoPreview = useMemo(
    () => (draft.pendingPhoto ? URL.createObjectURL(draft.pendingPhoto) : null),
    [draft.pendingPhoto],
  );

  return (
    <Modal
      open
      onClose={onClose}
      title={isEdit ? "Edit team member" : "Add team member"}
      size="md"
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving || uploading}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => submitFormById("team-form")}
            loading={saving}
            disabled={uploading}
          >
            {saving ? "Saving…" : isEdit ? "Save changes" : "Add member"}
          </Button>
        </>
      }
    >
      <form
        id="team-form"
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
        {/* -------------------------------------------------------- photo */}
        <div className="flex items-center gap-4">
          <div className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-outline bg-field">
            {draft.photo_url || photoPreview ? (
              <img
                src={photoPreview ?? draft.photo_url ?? ""}
                alt="Member photo"
                className="h-full w-full rounded-full object-cover"
              />
            ) : (
              <Icon name="users" className="h-6 w-6 text-fg-faint" />
            )}
          </div>
          <div className="min-w-0 flex-1 space-y-1.5">
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void uploadPhoto(file);
              }}
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              loading={uploading}
              onClick={() => fileRef.current?.click()}
            >
              Choose photo
            </Button>
            <p className="text-xs text-fg-muted">
              {isEdit
                ? "PNG, JPEG or WebP. Saved in high quality."
                : draft.pendingPhoto
                  ? "Photo will be attached when the member is created."
                  : "PNG, JPEG or WebP. You can add a photo right after creating."}
            </p>
            {(draft.photo_url || draft.pendingPhoto || draft.removingPhoto) &&
              draft.id !== null && (
                <button
                  type="button"
                  onClick={() => {
                    set("pendingPhoto", null);
                    void removePhoto();
                  }}
                  className="cursor-pointer text-xs font-medium text-terracotta hover:underline"
                >
                  Remove photo
                </button>
              )}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name" htmlFor="m-name" required>
            <Input
              id="m-name"
              value={draft.full_name}
              required
              maxLength={150}
              autoFocus
              onChange={(e) => set("full_name", e.target.value)}
            />
          </Field>

          <Field
            label="Role"
            htmlFor="m-role"
            hint={roleLocked ? "An Agati always has exactly one owner." : undefined}
          >
            <Select
              id="m-role"
              value={draft.role}
              disabled={roleLocked}
              onChange={(e) => set("role", e.target.value as TeamRole)}
            >
              <option value="owner" disabled={!roleLocked && !isOwner && hasOwner}>
                Owner
              </option>
              <option value="administrator">Administrator</option>
              <option value="worker">Worker</option>
            </Select>
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Job title" htmlFor="m-job">
            <Input
              id="m-job"
              value={draft.job_title}
              maxLength={100}
              placeholder="e.g. Joiner, Finisher, Workshop lead"
              onChange={(e) => set("job_title", e.target.value)}
            />
          </Field>

          <Field label="Phone" htmlFor="m-phone">
            <Input
              id="m-phone"
              type="tel"
              value={draft.phone}
              maxLength={32}
              onChange={(e) => set("phone", e.target.value)}
            />
          </Field>
        </div>

        <Field label="Email" htmlFor="m-email">
          <Input
            id="m-email"
            type="email"
            value={draft.email}
            maxLength={255}
            onChange={(e) => set("email", e.target.value)}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Status" htmlFor="m-status">
            <Select
              id="m-status"
              value={draft.status}
              onChange={(e) => set("status", e.target.value as TeamStatus)}
            >
              <option value="working">Working</option>
              <option value="off_duty">Off duty</option>
              <option value="on_leave">On leave</option>
            </Select>
          </Field>

          <Field label="Sort order" htmlFor="m-sort" hint="Lower numbers appear first within the role.">
            <Input
              id="m-sort"
              type="number"
              min={0}
              max={99999}
              value={draft.sort_order}
              onChange={(e) => set("sort_order", e.target.value)}
            />
          </Field>
        </div>

        <Checkbox
          checked={draft.is_active}
          onChange={(e) => set("is_active", e.target.checked)}
          label="Visible on the public team page"
        />
      </form>
    </Modal>
  );
}