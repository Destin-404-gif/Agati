"use client";

import { useId } from "react";
import { cx } from "./ui";
import {
  CHART_COLORS,
  formatValue,
  type FormatKind,
} from "@/lib/admin-format";

/**
 * Minimal SVG chart set. Hand-rolled because no charting package is installed.
 *
 * Props stay strictly serializable: a server component can pass these, but it
 * cannot pass functions or values imported out of another "use client" module.
 */

export interface TrendPoint {
  label: string;
  value: number;
}

/* ------------------------------------------------------------- area trend */

export function AreaTrend({
  points,
  height = 180,
  format = "number",
  caption,
}: {
  points: TrendPoint[];
  height?: number;
  format?: FormatKind;
  caption?: string;
}) {
  const gradientId = useId();
  const W = 600;
  const H = height;
  const padX = 8;
  const padTop = 12;
  const padBottom = 24;

  if (points.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-fg-muted">
        No data for this period yet.
      </p>
    );
  }

  const max = Math.max(...points.map((p) => p.value), 1);
  const innerW = W - padX * 2;
  const innerH = H - padTop - padBottom;
  const step = points.length > 1 ? innerW / (points.length - 1) : 0;

  const coords = points.map((p, i) => ({
    x: padX + i * step,
    y: padTop + innerH - (p.value / max) * innerH,
  }));

  // Horizontal-cubic smoothing between points.
  const line = coords
    .map((c, i) => {
      if (i === 0) return `M ${c.x} ${c.y}`;
      const prev = coords[i - 1]!;
      const mid = prev.x + (c.x - prev.x) / 2;
      return `C ${mid} ${prev.y}, ${mid} ${c.y}, ${c.x} ${c.y}`;
    })
    .join(" ");

  const area = `${line} L ${coords[coords.length - 1]!.x} ${padTop + innerH} L ${coords[0]!.x} ${padTop + innerH} Z`;

  let peak = 0;
  for (let i = 1; i < points.length; i += 1) {
    if (points[i]!.value > points[peak]!.value) peak = i;
  }

  return (
    <figure className="w-full">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full"
        role="img"
        aria-label={caption ?? "Trend over time"}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-sage)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="var(--color-sage)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {[0, 0.5, 1].map((t) => (
          <line
            key={t}
            x1={padX}
            x2={W - padX}
            y1={padTop + innerH * t}
            y2={padTop + innerH * t}
            stroke="currentColor"
            strokeOpacity="0.08"
            strokeDasharray="3 4"
          />
        ))}

        <path d={area} fill={`url(#${gradientId})`} />
        <path
          d={line}
          fill="none"
          stroke="var(--color-sage)"
          strokeWidth="2.25"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        <circle cx={coords[peak]!.x} cy={coords[peak]!.y} r="3.5" fill="var(--color-sage)" />

        {points.map((p, i) => (
          <text
            key={`${p.label}-${i}`}
            x={coords[i]!.x}
            y={H - 6}
            textAnchor="middle"
            className="fill-current text-[10px] opacity-45"
          >
            {p.label}
          </text>
        ))}
      </svg>
      <figcaption className="sr-only">
        Peak {formatValue(points[peak]!.value, format)} on {points[peak]!.label}
      </figcaption>
    </figure>
  );
}

/* -------------------------------------------------------------- bar chart */

export function BarList({
  items,
  format = "number",
}: {
  items: { label: string; value: number }[];
  format?: FormatKind;
}) {
  if (items.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-fg-muted">
        Nothing to chart yet.
      </p>
    );
  }

  const max = Math.max(...items.map((i) => i.value), 1);

  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={item.label}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate text-fg">
              {item.label}
            </span>
            <span className="shrink-0 font-semibold tabular-nums">
              {formatValue(item.value, format)}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-fill-strong">
            <div
              className="h-full rounded-full bg-sage transition-[width] duration-500"
              style={{ width: `${Math.max((item.value / max) * 100, 2)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------------------------------------------ donut */

export interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

export function Donut({
  segments,
  size = 168,
  thickness = 22,
}: {
  segments: DonutSegment[];
  size?: number;
  thickness?: number;
}) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;

  if (total === 0) {
    return (
      <div
        className="flex items-center justify-center rounded-full border-[22px] border-outline"
        style={{ width: size, height: size }}
      >
        <span className="text-xs text-fg-faint">No data</span>
      </div>
    );
  }

  // Precompute each arc's dash length and running offset in one pass, so no
  // variable is mutated while rendering.
  const arcs = segments.reduce<
    { segment: DonutSegment; dash: number; offset: number }[]
  >((acc, segment) => {
    const previous = acc[acc.length - 1];
    acc.push({
      segment,
      dash: (segment.value / total) * circumference,
      offset: previous ? previous.offset + previous.dash : 0,
    });
    return acc;
  }, []);

  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
      role="img"
      aria-label={segments.map((s) => `${s.label}: ${s.value}`).join(", ")}
    >
      <svg viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeOpacity="0.08"
          strokeWidth={thickness}
        />
        {arcs.map(({ segment, dash, offset }, i) => (
          <circle
            key={segment.label}
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={
              segment.color || CHART_COLORS[i % CHART_COLORS.length]
            }
            strokeWidth={thickness}
            strokeDasharray={`${dash} ${circumference - dash}`}
            strokeDashoffset={-offset}
          />
        ))}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-2xl font-semibold tabular-nums">{total}</span>
        <span className="text-[10px] tracking-wide text-fg-muted uppercase">
          total
        </span>
      </div>
    </div>
  );
}

export function Legend({ segments }: { segments: DonutSegment[] }) {
  const total = segments.reduce((sum, s) => sum + s.value, 0) || 1;
  return (
    <ul className="min-w-0 flex-1 space-y-2">
      {segments.map((s, i) => (
        <li key={s.label} className="flex items-center gap-2.5 text-sm">
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: s.color || CHART_COLORS[i % CHART_COLORS.length] }}
          />
          <span className="min-w-0 flex-1 truncate text-fg capitalize">
            {s.label}
          </span>
          <span className="shrink-0 font-semibold tabular-nums">{s.value}</span>
          <span className="w-10 shrink-0 text-right text-xs text-fg-faint tabular-nums">
            {Math.round((s.value / total) * 100)}%
          </span>
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------------------------------------- sparkline */

export function Sparkline({
  values,
  className,
}: {
  values: number[];
  className?: string;
}) {
  if (values.length < 2) return null;
  const max = Math.max(...values, 1);
  const W = 100;
  const H = 28;
  const step = W / (values.length - 1);

  const d = values
    .map((v, i) => `${i === 0 ? "M" : "L"} ${i * step} ${H - (v / max) * H}`)
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className={cx("h-7 w-full", className)}
      aria-hidden="true"
    >
      <path
        d={d}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
