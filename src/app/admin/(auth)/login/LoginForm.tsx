"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { Alert, Button, Checkbox, Field, Input } from "@/components/admin/ui";

/**
 * Sign-in form.
 *
 * One field accepts either handle - the username or the email address the
 * account was created with - so the label says both rather than guessing.
 *
 * There is no forced password change: the seeded password keeps working and
 * nothing redirects to the change-password page after signing in.
 */
export default function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const identifierId = useId();
  const passwordId = useId();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/admin/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ identifier, password, remember }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error ?? "Could not sign in. Try again.");
        setLoading(false);
        return;
      }

      router.replace(next);
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
          Sign in
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-fg-soft">
          Use the username or email address you were given.
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-5">
        {error && <Alert tone="error">{error}</Alert>}

        <Field label="Username or email" htmlFor={identifierId} required>
          <Input
            id={identifierId}
            name="identifier"
            type="text"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            required
            autoFocus
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder="admin"
            invalid={Boolean(error)}
          />
        </Field>

        <Field label="Password" htmlFor={passwordId} required>
          <div className="relative">
            <Input
              id={passwordId}
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              invalid={Boolean(error)}
              className="pr-11"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              // The label describes the action, not the state, so it is correct
              // both before and after the toggle.
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
              className="absolute inset-y-0 right-0 flex w-11 cursor-pointer items-center justify-center rounded-r-xl text-fg-muted transition-colors hover:text-fg focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-accent"
            >
              {showPassword ? (
                <EyeOff className="size-4" aria-hidden="true" />
              ) : (
                <Eye className="size-4" aria-hidden="true" />
              )}
            </button>
          </div>
        </Field>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <Checkbox
            name="remember"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            label="Keep me signed in"
          />
          <Link
            href="/admin/forgot-password"
            className="text-xs font-medium text-fg-soft underline-offset-4 transition-colors hover:text-fg hover:underline"
          >
            Forgot your password?
          </Link>
        </div>

        <Button type="submit" size="lg" loading={loading} className="w-full">
          {loading ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      <p className="mt-8 border-t border-outline pt-6 text-xs leading-relaxed text-fg-muted">
        Staff access only. Every sign-in and every change to the catalogue is
        logged.
      </p>
    </div>
  );
}