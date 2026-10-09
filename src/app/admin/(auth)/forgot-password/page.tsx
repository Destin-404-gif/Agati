"use client";

import { useState } from "react";
import Link from "next/link";
import { Alert, Button, Field, Input } from "@/components/admin/ui";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);

    try {
      const res = await fetch("/api/admin/auth/forgot", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error ?? "Could not start a reset. Try again.");
      } else {
        setMessage(
          data.message ??
            "If that account exists, a reset link is on its way.",
        );
      }
      setLoading(false);
    } catch {
      setError("Network error. Check your connection and try again.");
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-sm">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold tracking-tight text-fg">
          Reset your password
        </h1>
        <p className="mt-1 text-sm text-fg-soft">
          Enter your staff email and we&apos;ll send a reset link.
        </p>
      </div>

      <form
        onSubmit={onSubmit}
        className="space-y-4 rounded-2xl border border-outline bg-surface p-6 shadow-soft"
      >
        {error && <Alert tone="error">{error}</Alert>}
        {message && <Alert tone="success">{message}</Alert>}

        <Field label="Email" htmlFor="email" required>
          <Input
            id="email"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@agati.com"
            disabled={Boolean(message)}
          />
        </Field>

        <Button
          type="submit"
          size="lg"
          className="w-full"
          loading={loading}
          disabled={Boolean(message)}
        >
          Send reset link
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
