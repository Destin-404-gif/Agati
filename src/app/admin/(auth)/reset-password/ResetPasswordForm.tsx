"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Alert, Button, Field, Input } from "@/components/admin/ui";

export default function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const mismatch = confirm.length > 0 && password !== confirm;
  const tooShort = password.length > 0 && password.length < 8;

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (mismatch || tooShort) return;

    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/admin/auth/reset", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error ?? "Could not reset your password.");
        setLoading(false);
        return;
      }

      router.replace("/admin");
      router.refresh();
    } catch {
      setError("Network error. Check your connection and try again.");
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-sm">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold tracking-tight text-fg">
          Choose a new password
        </h1>
        <p className="mt-1 text-sm text-fg-soft">
          You&apos;ll be signed in automatically afterwards.
        </p>
      </div>

      <form
        onSubmit={onSubmit}
        className="space-y-4 rounded-2xl border border-outline bg-surface p-6 shadow-soft"
      >
        {error && <Alert tone="error">{error}</Alert>}

        <Field
          label="New password"
          htmlFor="password"
          required
          error={tooShort ? "Use at least 8 characters." : null}
        >
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            invalid={tooShort}
          />
        </Field>

        <Field
          label="Confirm password"
          htmlFor="confirm"
          required
          error={mismatch ? "Passwords do not match." : null}
        >
          <Input
            id="confirm"
            type="password"
            autoComplete="new-password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            invalid={mismatch}
          />
        </Field>

        <Button
          type="submit"
          size="lg"
          className="w-full"
          loading={loading}
          disabled={mismatch || tooShort}
        >
          {loading ? "Updating…" : "Update password"}
        </Button>

        <p className="pt-1 text-center text-xs text-fg-muted">
          <Link
            href="/admin/login"
            className="underline-offset-4 hover:text-fg hover:underline"
          >
            Back to sign in
          </Link>
        </p>
      </form>
    </div>
  );
}
