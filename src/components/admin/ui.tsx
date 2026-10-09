"use client";

import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

/* ------------------------------------------------------------------ button */

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-accent text-on-accent hover:bg-accent/90 focus-visible:outline-accent",
  secondary:
    "bg-surface text-fg border border-outline-strong hover:bg-fill focus-visible:outline-accent",
  ghost:
    "bg-transparent text-fg hover:bg-fill focus-visible:outline-accent",
  danger:
    "bg-terracotta text-white hover:bg-terracotta-light focus-visible:outline-terracotta",
};

const SIZES: Record<Size, string> = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2.5 text-sm",
  lg: "px-6 py-3 text-sm",
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  className,
  children,
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={cx(
        "inline-flex cursor-pointer items-center justify-center gap-2 rounded-full font-semibold tracking-wide",
        "transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        "focus-visible:outline-2 focus-visible:outline-offset-2",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
    >
      {loading && <Spinner className="h-3.5 w-3.5" />}
      {children}
    </button>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <svg
      className={cx("animate-spin", className)}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="3"
        opacity="0.25"
      />
      <path
        d="M12 2a10 10 0 0 1 10 10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

/* ------------------------------------------------------------------- forms */

export function Field({
  label,
  error,
  hint,
  required,
  htmlFor,
  children,
}: {
  label: string;
  error?: string | null;
  hint?: ReactNode;
  required?: boolean;
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label
        htmlFor={htmlFor}
        className="block text-xs font-semibold tracking-wide text-fg uppercase"
      >
        {label}
        {required && <span className="ml-1 text-terracotta">*</span>}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-fg-muted">{hint}</p>}
      {error && <p className="text-xs font-medium text-terracotta">{error}</p>}
    </div>
  );
}

const CONTROL =
  "w-full rounded-xl border bg-field px-3.5 py-2.5 text-sm text-fg placeholder:text-fg-faint transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 disabled:opacity-60";

export function Input({
  invalid,
  className,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return (
    <input
      {...rest}
      className={cx(
        CONTROL,
        invalid
          ? "border-terracotta focus-visible:outline-terracotta"
          : "border-outline focus-visible:outline-accent",
        className,
      )}
    />
  );
}

export function Textarea({
  invalid,
  className,
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }) {
  return (
    <textarea
      {...rest}
      className={cx(
        CONTROL,
        "min-h-24 resize-y",
        invalid
          ? "border-terracotta focus-visible:outline-terracotta"
          : "border-outline focus-visible:outline-accent",
        className,
      )}
    />
  );
}

export function Select({
  invalid,
  className,
  children,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }) {
  return (
    <select
      {...rest}
      className={cx(
        CONTROL,
        "cursor-pointer appearance-none bg-[length:1rem] bg-[right_0.75rem_center] bg-no-repeat bg-[image:var(--select-arrow)] pr-9",
        invalid ? "border-terracotta" : "border-outline",
        className,
      )}
    >
      {children}
    </select>
  );
}

export function Checkbox({
  label,
  className,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { label?: string }) {
  return (
    <label className={cx("flex cursor-pointer items-center gap-2", className)}>
      <input
        type="checkbox"
        {...rest}
        className="h-4 w-4 cursor-pointer rounded border-outline-strong accent-sage focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
      />
      {label && <span className="text-sm text-fg">{label}</span>}
    </label>
  );
}

/* ------------------------------------------------------------------ layout */

export function Card({
  className,
  children,
  padded = true,
}: {
  className?: string;
  children: ReactNode;
  padded?: boolean;
}) {
  return (
    <div
      className={cx(
        "rounded-2xl border border-outline bg-surface shadow-soft backdrop-blur-sm",
        padded && "p-5",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  description,
  action,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="font-display text-lg font-semibold text-fg">
          {title}
        </h2>
        {description && (
          <p className="mt-0.5 text-sm text-fg-soft">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}

/* ------------------------------------------------------------------ states */

export function Alert({
  tone = "error",
  children,
}: {
  tone?: "error" | "success" | "info";
  children: ReactNode;
}) {
  const tones = {
    error: "border-terracotta/40 bg-terracotta/10 text-terracotta",
    success: "border-sage/40 bg-sage/10 text-sage-dark dark:text-sage-light",
    info: "border-outline bg-fill text-fg",
  } as const;

  return (
    <div
      role="status"
      className={cx(
        "rounded-xl border px-3.5 py-2.5 text-sm font-medium",
        tones[tone],
      )}
    >
      {children}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cx(
        "animate-pulse rounded-lg bg-fill",
        className ?? "h-4 w-full",
      )}
    />
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
      <div
        aria-hidden="true"
        className="flex h-12 w-12 items-center justify-center rounded-full bg-fill"
      >
        <svg
          viewBox="0 0 24 24"
          className="h-6 w-6 text-fg-faint"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path d="M4 7h16M4 12h10M4 17h7" strokeLinecap="round" />
        </svg>
      </div>
      <div>
        <p className="font-display text-base font-semibold text-fg">
          {title}
        </p>
        {description && (
          <p className="mt-1 text-sm text-fg-soft">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}

const BADGE_TONES: Record<string, string> = {
  neutral: "bg-fill-strong text-fg",
  success: "bg-sage/15 text-sage-dark dark:text-sage-light",
  warning: "bg-terracotta/15 text-terracotta",
  danger: "bg-terracotta/20 text-terracotta",
  info: "bg-sage/10 text-sage-dark dark:text-sage-light",
};

export function Badge({
  tone = "neutral",
  children,
}: {
  tone?: keyof typeof BADGE_TONES;
  children: ReactNode;
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize",
        BADGE_TONES[tone],
      )}
    >
      {children}
    </span>
  );
}

/** Maps a domain status string to a badge tone. */
export function statusTone(status: string): keyof typeof BADGE_TONES {
  const s = status.toLowerCase();
  if (["active", "paid", "delivered", "accepted", "completed", "published"].includes(s))
    return "success";
  if (["new", "pending", "draft", "sent"].includes(s)) return "info";
  if (["cancelled", "rejected", "failed", "inactive"].includes(s)) return "danger";
  if (["processing", "in_progress", "shipped"].includes(s)) return "warning";
  return "neutral";
}
