"use client";

import Link from "next/link";
import type { ReactNode } from "react";

type PillButtonProps = {
  children: ReactNode;
  href?: string;
  onClick?: () => void;
  variant?: "dark" | "cream" | "terracotta" | "outline";
  size?: "sm" | "md" | "lg";
  className?: string;
  type?: "button" | "submit";
  disabled?: boolean;
  title?: string;
};

const VARIANTS = {
  dark: "bg-espresso text-cream hover:bg-terracotta",
  cream: "bg-cream text-espresso hover:bg-white",
  terracotta: "bg-terracotta text-cream hover:bg-espresso",
  outline: "bg-transparent text-cream hover:bg-cream hover:text-espresso",
} as const;

const SIZES = {
  sm: "px-4 py-2 text-[11px]",
  md: "px-6 py-3 text-xs",
  lg: "px-8 py-4 text-[13px]",
} as const;

/** Pill CTA: dark bg, cream text, rounded-full, subtle scale on hover/tap. */
export default function PillButton({
  children,
  href,
  onClick,
  variant = "dark",
  size = "md",
  className = "",
  type = "button",
  disabled = false,
  title,
}: PillButtonProps) {
  const cls = [
    "inline-flex items-center justify-center gap-2 rounded-full font-semibold uppercase",
    "tracking-[0.14em] transition-all duration-300 ease-out",
    "hover:scale-[1.04] active:scale-[0.97]",
    "disabled:pointer-events-none disabled:opacity-50",
    VARIANTS[variant],
    SIZES[size],
    className,
  ].join(" ");

  if (href) {
    return (
      <Link href={href} className={cls} title={title}>
        {children}
      </Link>
    );
  }
  return (
    <button type={type} onClick={onClick} className={cls} disabled={disabled} title={title}>
      {children}
    </button>
  );
}
