"use client";

import { useEffect, useState } from "react";
import { useToast } from "./Toast";
import { Button, Checkbox, Field, Input, Spinner } from "./ui";
import type { SettingField } from "@/app/api/admin/settings/_shared";

type Values = Record<string, unknown>;

export function SettingsForm() {
  const toast = useToast();
  const [schema, setSchema] = useState<SettingField[]>([]);
  const [values, setValues] = useState<Values>({});
  const [initial, setInitial] = useState<Values>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/admin/settings", { cache: "no-store" })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error ?? "Could not load settings.");
        setSchema(data.schema ?? []);
        setValues(data.values ?? {});
        setInitial(data.values ?? {});
        setError(null);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const groups = schema.reduce<Record<string, SettingField[]>>((acc, field) => {
    (acc[field.group] ??= []).push(field);
    return acc;
  }, {});

  /* Secrets compare on presence, not value: the server never sent the value, so
   an untouched secret must not look dirty and must not be sent as `true`. */
  const dirty = schema.some((field) => {
    if (field.kind === "secret") {
      return values[field.key] !== "" && values[field.key] !== initial[field.key];
    }
    return JSON.stringify(values[field.key]) !== JSON.stringify(initial[field.key]);
  });

  async function save() {
    /* Send only what changed, so untouched rows are not rewritten. */
    const changed: Values = {};
    for (const field of schema) {
      if (JSON.stringify(values[field.key]) !== JSON.stringify(initial[field.key])) {
        changed[field.key] = values[field.key];
      }
    }

    if (Object.keys(changed).length === 0) return;

    setSaving(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(changed),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        toast.error(data.error ?? "Could not save those settings.");
        return;
      }

      setValues(data.values ?? values);
      setInitial(data.values ?? values);
      toast.success("Settings saved.");
    } finally {
      setSaving(false);
    }
  }

  function revert() {
    setValues(initial);
  }

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <Spinner />
      </div>
    );
  }

  if (error) {
    return (
      <p className="rounded-xl border border-terracotta/40 bg-terracotta/10 px-4 py-3 text-sm text-terracotta">
        {error}
      </p>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
      className="space-y-8"
    >
      {Object.entries(groups).map(([group, fields]) => (
        <fieldset key={group}>
          <legend className="mb-3 font-display text-lg font-semibold">{group}</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            {fields.map((field) => {
              const id = `set-${field.key.replace(/\./g, "-")}`;
              return (
                <div
                  key={field.key}
                  className={
                    field.kind === "boolean" || field.kind === "secret"
                      ? "sm:col-span-2"
                      : ""
                  }
                >
                  {field.kind === "boolean" ? (
                    <Checkbox
                      id={id}
                      checked={Boolean(values[field.key])}
                      onChange={(e) =>
                        setValues((v) => ({ ...v, [field.key]: e.target.checked }))
                      }
                      label={field.label}
                    />
                  ) : field.kind === "secret" ? (
                    /* Secrets arrive from the server as a boolean "is it set?".
                       The input starts empty and only sends a value when the
                       admin actually types one, so the masked state is never
                       written back over the stored secret. */
                    <Field
                      label={field.label}
                      htmlFor={id}
                      hint={
                        values[field.key]
                          ? `${field.hint ?? ""} Currently set - leave blank to keep it.`.trim()
                          : field.hint
                      }
                    >
                      <Input
                        id={id}
                        type="password"
                        autoComplete="new-password"
                        value={
                          typeof values[field.key] === "string"
                            ? String(values[field.key])
                            : ""
                        }
                        placeholder={values[field.key] ? "••••••••" : "Not set"}
                        onChange={(e) =>
                          setValues((v) => ({ ...v, [field.key]: e.target.value }))
                        }
                      />
                    </Field>
                  ) : (
                    <Field
                      label={field.label}
                      htmlFor={id}
                      hint={field.hint}
                    >
                      <Input
                        id={id}
                        type={field.kind === "number" ? "number" : "text"}
                        value={
                          values[field.key] === undefined || values[field.key] === null
                            ? ""
                            : String(values[field.key])
                        }
                        min={field.min}
                        max={field.max}
                        step={field.kind === "number" ? "any" : undefined}
                        onChange={(e) =>
                          setValues((v) => ({
                            ...v,
                            [field.key]:
                              field.kind === "number"
                                ? e.target.value === ""
                                  ? 0
                                  : Number(e.target.value)
                                : e.target.value,
                          }))
                        }
                      />
                    </Field>
                  )}
                  {field.kind === "boolean" && field.hint && (
                    <p className="mt-1 ml-6 text-xs text-fg-muted">
                      {field.hint}
                    </p>
                  )}
                  <p className="mt-1 font-mono text-[11px] text-fg-faint">
                    {field.key}
                  </p>
                </div>
              );
            })}
          </div>
        </fieldset>
      ))}

      <div className="sticky bottom-0 -mx-4 flex items-center gap-2 border-t border-outline bg-bg/85 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <Button type="submit" loading={saving} disabled={!dirty}>
          {saving ? "Saving…" : "Save changes"}
        </Button>
        <Button type="button" variant="secondary" onClick={revert} disabled={!dirty || saving}>
          Revert
        </Button>
        {dirty && !saving && (
          <span className="text-xs text-fg-muted">Unsaved changes</span>
        )}
      </div>
    </form>
  );
}
