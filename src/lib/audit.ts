import { query } from "./db";

export type AuditAction =
  | "create"
  | "update"
  | "delete"
  | "login"
  | "login_failed"
  | "logout"
  | "export"
  | "status"
  | "password_reset"
  | "settings"
  | string;

export interface AuditActor {
  id: number;
  email: string;
}

export interface AuditInput {
  action: AuditAction;
  entity: string;
  entityId?: string | number | null;
  before?: unknown;
  after?: unknown;
  staff?: AuditActor | null;
  ip?: string | null;
}

function toJson(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
}

/**
 * Records a change. Failures are swallowed: an audit hiccup must never take down
 * the request that was otherwise fine.
 */
export async function logAudit(input: AuditInput): Promise<void> {
  try {
    await query(
      `INSERT INTO audit_logs
         (staff_id, staff_email, action, entity, entity_id, before_data, after_data, ip)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8)`,
      [
        input.staff?.id ?? null,
        input.staff?.email ?? null,
        input.action,
        input.entity,
        input.entityId === null || input.entityId === undefined
          ? null
          : String(input.entityId),
        toJson(input.before),
        toJson(input.after),
        input.ip ?? null,
      ],
    );
  } catch (err) {
    console.error("[audit] failed to record entry", err);
  }
}

export interface AuditActorLike {
  id: number;
  email: string;
}

export function actor(staff: AuditActorLike | null): AuditActor | null {
  return staff ? { id: staff.id, email: staff.email } : null;
}
