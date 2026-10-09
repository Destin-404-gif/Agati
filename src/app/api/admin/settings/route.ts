import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/admin-api";
import { logAudit } from "@/lib/audit";
import { getPool } from "@/lib/db";
import {
  SETTINGS_SCHEMA,
  SECRET_SETTING_KEYS,
  listSettings,
  listSettingsForAdmin,
  settingDefaults,
} from "./_shared";

export const dynamic = "force-dynamic";

export const GET = withAuth(
  async () => {
    /* Secrets come back as a "is it set?" boolean, never as their value. */
    const values = await listSettingsForAdmin();
    return NextResponse.json({ values, schema: SETTINGS_SCHEMA, defaults: settingDefaults() });
  },
  { permissions: ["settings.edit"] },
);

const UpdateBody = z.record(
  z.string().min(1).max(80),
  z.unknown(),
);

export const PATCH = withAuth(
  async ({ req, staff }) => {
    const parsed = UpdateBody.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: "Send a key/value object." }, { status: 400 });
    }

    const entries = Object.entries(parsed.data);
    if (entries.length === 0) {
      return NextResponse.json({ error: "Nothing to save." }, { status: 400 });
    }

    const known = new Map(SETTINGS_SCHEMA.map((f) => [f.key, f]));
    const client = await getPool().connect();

    try {
      await client.query("BEGIN");

      for (const [key, value] of entries) {
        const field = known.get(key);
        if (!field) {
          /* Reject typos instead of creating dead keys nobody reads. */
          await client.query("ROLLBACK");
          return NextResponse.json(
            { error: `Unknown setting “${key}”.` },
            { status: 400 },
          );
        }

        if (field.kind === "boolean" && typeof value !== "boolean") {
          await client.query("ROLLBACK");
          return NextResponse.json(
            { error: `“${key}” must be true or false.` },
            { status: 400 },
          );
        }

        if (field.kind === "number") {
          if (typeof value !== "number" || !Number.isFinite(value)) {
            await client.query("ROLLBACK");
            return NextResponse.json(
              { error: `“${key}” must be a number.` },
              { status: 400 },
            );
          }
          if (field.min !== undefined && value < field.min) {
            await client.query("ROLLBACK");
            return NextResponse.json(
              { error: `“${key}” cannot be below ${field.min}.` },
              { status: 400 },
            );
          }
          if (field.max !== undefined && value > field.max) {
            await client.query("ROLLBACK");
            return NextResponse.json(
              { error: `“${key}” cannot be above ${field.max}.` },
              { status: 400 },
            );
          }
        }

        if ((field.kind === "string" || field.kind === "secret") && typeof value !== "string") {
          await client.query("ROLLBACK");
          return NextResponse.json(
            { error: `“${key}” must be text.` },
            { status: 400 },
          );
        }
      }

      const before: Record<string, unknown> = {};
      await client.query("SELECT key, value FROM settings WHERE key = ANY($1::varchar[])", [
        entries.map(([key]) => key),
      ]).then(({ rows }) => {
        for (const row of rows) before[row.key] = row.value;
      });

      for (const [key, value] of entries) {
        /* A masked secret arrives as `true`/`false`; that means "leave it alone",
           not "store the string true". An empty string clears it. */
        if (SECRET_SETTING_KEYS.has(key)) {
          if (value === true) continue;
          if (value === "") {
            await client.query(
              `INSERT INTO settings (key, value, updated_at, updated_by)
               VALUES ($1, ''::jsonb, NOW(), $2)
               ON CONFLICT (key) DO UPDATE
                 SET value = ''::jsonb,
                     updated_at = NOW(),
                     updated_by = EXCLUDED.updated_by`,
              [key, staff.email],
            );
            continue;
          }
        }

        await client.query(
          `INSERT INTO settings (key, value, updated_at, updated_by)
           VALUES ($1, $2::jsonb, NOW(), $3)
           ON CONFLICT (key) DO UPDATE
             SET value = EXCLUDED.value,
                 updated_at = NOW(),
                 updated_by = EXCLUDED.updated_by`,
          [key, JSON.stringify(value), staff.email],
        );
      }

      await client.query("COMMIT");

      /* Secrets are redacted from the audit trail: the log is not a secret store. */
      const redact = (obj: Record<string, unknown>) =>
        Object.fromEntries(
          Object.entries(obj).map(([k, v]) => [
            k,
            SECRET_SETTING_KEYS.has(k) ? (v ? "[set]" : "[empty]") : v,
          ]),
        );

      await logAudit({
        action: "update",
        entity: "settings",
        before: redact(before),
        after: redact(Object.fromEntries(entries)),
        staff: { id: staff.id, email: staff.email },
      });

      return NextResponse.json({ ok: true, values: await listSettingsForAdmin() });
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  },
  { permissions: ["settings.edit"] },
);
