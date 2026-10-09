"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { Alert, Button, Field, Input } from "@/components/admin/ui";

/**
 * Optional, self-service password change.
 *
 * Nothing ever routes here automatically: there is no forced change, no expiry
 * and no reminder. A person who wants to move off the seeded password opens it
 * from the account menu. It verifies the current password, so a live session on
 * its own cannot take the account over.
 */
export default function ChangePasswordForm({ handle }: { handle: string }) {
  const router = useRouter();
  const currentId = useId();
  const nextId = useId();
  const confirmId = useId();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const mismatch = confirm.length > 0 && confirm !== newPassword;

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setFieldErrors({});

    if (newPassword !== confirm) {
      setFieldErrors({ confirm: "Those two passwords do not match." });
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/admin/auth/change-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error ?? "Could not change your password.");
        if (Array.isArray(data.fields)) {
          setFieldErrors(
            Object.fromEntries(
              data.fields.map((f: { path: string; message: string }) => [
                f.path,
                f.message,
              ]),
            ),
          );
        }
        setLoading(false);
        return;
      }

      // The password is no longer the seeded one, so the dashboard is reachable
      // and `must_change_password` is clear.
      router.replace("/admin");
      router.refresh();
    } catch {
      setError("Network error. Check your connection and try again.");
      setLoading(false);
    }
  }

  return (
    <div className="w-full">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-fg">
          Change your password
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-fg-soft">
          Pick something you do not use anywhere else. You will stay signed in.
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-5">
        {error && <Alert tone="error">{error}</Alert>}

        <Field
          label="Your current password"
          htmlFor={currentId}
          error={fieldErrors.currentPassword}
          required
        >
          <Input
            id={currentId}
            name="currentPassword"
            type={show ? "text" : "password"}
            autoComplete="current-password"
            required
            autoFocus
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            invalid={Boolean(fieldErrors.currentPassword)}
            className="pr-11"
          />
        </Field>

        <Field
          label="New password"
          htmlFor={nextId}
          error={fieldErrors.newPassword}
          hint="At least 10 characters. A short phrase you will remember beats a scrambled word."
          required
        >
          <Input
            id={nextId}
            name="newPassword"
            type={show ? "text" : "password"}
            autoComplete="new-password"
            required
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            invalid={Boolean(fieldErrors.newPassword)}
            className="pr-11"
          />
        </Field>

        <Field
          label="Confirm new password"
          htmlFor={confirmId}
          error={fieldErrors.confirm ?? (mismatch ? "Those two passwords do not match." : null)}
          required
        >
          <Input
            id={confirmId}
            name="confirmPassword"
            type={show ? "text" : "password"}
            autoComplete="new-password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            invalid={mismatch || Boolean(fieldErrors.confirm)}
            className="pr-11"
          />
        </Field>

        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          aria-pressed={show}
          className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-fg-soft underline-offset-4 transition-colors hover:text-fg hover:underline"
        >
          {show ? (
            <EyeOff className="size-3.5" aria-hidden="true" />
          ) : (
            <Eye className="size-3.5" aria-hidden="true" />
          )}
          {show ? "Hide passwords" : "Show passwords"}
        </button>

        <Button type="submit" size="lg" loading={loading} className="w-full">
          {loading ? "Saving…" : "Save new password"}
        </Button>

        <button
          type="button"
          onClick={() => router.back()}
          className="w-full cursor-pointer text-center text-xs font-medium text-fg-muted underline-offset-4 transition-colors hover:text-fg hover:underline"
        >
          Cancel
        </button>
      </form>
    </div>
  );
}