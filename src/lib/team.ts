/**
 * Team members: the public "Meet our team" roster and its admin editor.
 *
 * Shared by `/api/team`, `/api/team/public` and the storefront page so the sort
 * order and the owner rules only ever exist once.
 */

import { z } from "zod";
import { query } from "./db";

export const TEAM_ROLES = ["owner", "administrator", "worker"] as const;
export type TeamRole = (typeof TEAM_ROLES)[number];

export const TEAM_STATUSES = ["working", "off_duty", "on_leave"] as const;
export type TeamStatus = (typeof TEAM_STATUSES)[number];

export const TEAM_ROLE_LABELS: Record<TeamRole, string> = {
  owner: "Owner",
  administrator: "Administrators",
  worker: "Workers",
};

export const TEAM_STATUS_LABELS: Record<TeamStatus, string> = {
  working: "Working",
  off_duty: "Off duty",
  on_leave: "On leave",
};

/** Owner first, then administrators, then workers. */
const ROLE_RANK = `CASE role WHEN 'owner' THEN 0 WHEN 'administrator' THEN 1 ELSE 2 END`;

export interface TeamRow {
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
  created_at: string;
  updated_at: string;
}

/** Every column the admin UI is allowed to see. */
const ADMIN_COLUMNS = `id, full_name, role, job_title, phone, email, photo_url,
  status, is_active, sort_order, created_at, updated_at`;

/** The whole roster, always in Owner -> Administrators -> Workers order. */
export async function listTeam(): Promise<TeamRow[]> {
  return query<TeamRow>(
    `SELECT ${ADMIN_COLUMNS} FROM team_members
      ORDER BY ${ROLE_RANK}, sort_order ASC, full_name ASC`,
  );
}

export interface PublicTeamMember {
  id: number;
  full_name: string;
  role: TeamRole;
  job_title: string | null;
  photo_url: string | null;
  status: TeamStatus;
}

/**
 * Storefront-safe rows: no phone, no email, nothing but what the site renders.
 * Hidden members are left out entirely.
 */
export async function listPublicTeam(): Promise<PublicTeamMember[]> {
  return query<PublicTeamMember>(
    `SELECT id, full_name, role, job_title, photo_url, status
       FROM team_members
      WHERE is_active = TRUE
      ORDER BY ${ROLE_RANK}, sort_order ASC, full_name ASC`,
  );
}

export async function getTeamMember(id: number): Promise<TeamRow | null> {
  const rows = await query<TeamRow>(
    `SELECT ${ADMIN_COLUMNS} FROM team_members WHERE id = $1`,
    [id],
  );
  return rows[0] ?? null;
}

export async function ownerExists(exceptId?: number): Promise<boolean> {
  const rows = await query<{ id: number }>(
    `SELECT id FROM team_members WHERE role = 'owner' AND id <> $1 LIMIT 1`,
    [exceptId ?? -1],
  );
  return rows.length > 0;
}

const optionalText = (max: number) =>
  z.string().trim().max(max).optional().or(z.literal(""));

export const teamMemberSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(1, "Give the team member a name.")
    .max(150, "Names are limited to 150 characters."),
  role: z.enum(TEAM_ROLES, { message: "Pick a valid role." }).default("worker"),
  jobTitle: optionalText(100),
  phone: optionalText(32),
  email: z
    .union([z.email("Enter a valid email address."), z.literal("")])
    .optional(),
  status: z.enum(TEAM_STATUSES, { message: "Pick a valid status." }).default("working"),
  isActive: z.boolean().default(true),
  sortOrder: z.coerce
    .number("Enter a sort position.")
    .int("Enter a whole number.")
    .min(0)
    .max(99999)
    .default(0),
});

export type TeamMemberInput = z.infer<typeof teamMemberSchema>;

export const teamStatusSchema = z.object({
  status: z.enum(TEAM_STATUSES, { message: "Pick a valid status." }),
});

/** Normalises blank strings to null so "no phone" is expressible. */
export function textOrNull(value: string | undefined | null): string | null {
  const trimmed = (value ?? "").trim();
  return trimmed === "" ? null : trimmed;
}

/** The next status in the Working / Off duty / On leave cycle. */
export function nextStatus(current: TeamStatus): TeamStatus {
  const cycle: Record<TeamStatus, TeamStatus> = {
    working: "off_duty",
    off_duty: "on_leave",
    on_leave: "working",
  };
  return cycle[current];
}
