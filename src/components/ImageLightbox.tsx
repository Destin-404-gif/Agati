"use client";

/* eslint-disable @next/next/no-img-element */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";

/**
 * The one full-screen photo viewer, shared by the workshop gallery and the
 * product page.
 *
 * It loads the largest 3840px variant and paints the 400px thumbnail underneath
 * while it arrives, so opening a photograph never flashes white. Zoom is wheel +
 * double-click on a desktop and pinch + double-tap on a phone, with drag to pan
 * once zoomed; next/previous work from buttons, the arrow keys and a swipe. The
 * page behind is scroll-locked, focus is trapped inside the dialog and handed
 * back to whatever opened it on close.
 */

export interface LightboxItem {
  /** The largest variant - what the viewer loads at full size. */
  src: string;
  srcSet?: string;
  sizes?: string;
  /** Small version painted under the large one while it loads. */
  placeholderUrl?: string | null;
  width?: number | null;
  height?: number | null;
  title?: string | null;
  caption?: string | null;
  alt?: string | null;
  /** The file the Download button offers (defaults to `src`). */
  downloadUrl?: string | null;
}

export interface ImageLightboxProps {
  items: LightboxItem[];
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
  allowDownload?: boolean;
  /** Element to focus again on close; defaults to whatever had focus. */
  returnFocusTo?: HTMLElement | null;
}

const MIN_SCALE = 1;
const MAX_SCALE = 5;
const DOUBLE_TAP_ZOOM = 2.5;
const SWIPE_MIN = 48;

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

export default function ImageLightbox({
  items,
  index,
  onIndexChange,
  onClose,
  allowDownload = false,
  returnFocusTo,
}: ImageLightboxProps) {
  const item = items[index] ?? null;
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [loaded, setLoaded] = useState(false);

  const stageRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const panStart = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const pinchStart = useRef<{ distance: number; scale: number } | null>(null);
  const swipeStart = useRef<{ x: number; y: number } | null>(null);
  const lastTap = useRef(0);
  const draggedRef = useRef(false);
  const focusBefore = useRef<HTMLElement | null>(null);

  const many = items.length > 1;

  const reset = useCallback(() => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  }, []);

  const go = useCallback(
    (delta: number) => {
      if (!many) return;
      onIndexChange((index + delta + items.length) % items.length);
    },
    [index, items.length, many, onIndexChange],
  );

  /* A fresh photograph always opens un-zoomed and un-panned. */
  useEffect(() => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
    setLoaded(false);
  }, [index]);

  /* Escape closes, arrows walk, +/−/0 control zoom, Tab stays inside. */
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      } else if (event.key === "ArrowRight") {
        go(1);
      } else if (event.key === "ArrowLeft") {
        go(-1);
      } else if (event.key === "+" || event.key === "=") {
        setScale((s) => clamp(s * 1.35, MIN_SCALE, MAX_SCALE));
      } else if (event.key === "-" || event.key === "_") {
        setScale((s) => {
          const next = clamp(s / 1.35, MIN_SCALE, MAX_SCALE);
          if (next <= MIN_SCALE) setOffset({ x: 0, y: 0 });
          return next;
        });
      } else if (event.key === "0") {
        reset();
      } else if (event.key === "Tab") {
        const nodes = dialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
        );
        if (!nodes || nodes.length === 0) return;
        const first = nodes[0]!;
        const last = nodes[nodes.length - 1]!;
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, onClose, reset]);

  /* Lock the page behind the viewer; put focus back where it came from. */
  useEffect(() => {
    focusBefore.current = returnFocusTo ?? (document.activeElement as HTMLElement | null);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus();
    return () => {
      document.body.style.overflow = previous;
      focusBefore.current?.focus?.();
    };
  }, [returnFocusTo]);

  /* Preload the neighbours so stepping through the set feels instant. */
  useEffect(() => {
    if (!many) return;
    for (const i of [(index + 1) % items.length, (index - 1 + items.length) % items.length]) {
      const url = items[i]?.src;
      if (!url) continue;
      const img = new window.Image();
      img.src = url;
    }
  }, [index, items, many]);

  /* Wheel zoom needs a non-passive listener so the page cannot scroll behind. */
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      setScale((s) => {
        const next = clamp(s * (1 - event.deltaY * 0.0015), MIN_SCALE, MAX_SCALE);
        if (next <= MIN_SCALE) setOffset({ x: 0, y: 0 });
        return next;
      });
    };
    stage.addEventListener("wheel", onWheel, { passive: false });
    return () => stage.removeEventListener("wheel", onWheel);
  }, []);

  const toggleZoom = useCallback(() => {
    setScale((s) => (s > MIN_SCALE ? MIN_SCALE : DOUBLE_TAP_ZOOM));
    setOffset({ x: 0, y: 0 });
  }, []);

  const zoomBy = useCallback((factor: number) => {
    setScale((s) => {
      const next = clamp(s * factor, MIN_SCALE, MAX_SCALE);
      if (next <= MIN_SCALE) setOffset({ x: 0, y: 0 });
      return next;
    });
  }, []);

  const distance = (a: { x: number; y: number }, b: { x: number; y: number }) =>
    Math.hypot(a.x - b.x, a.y - b.y);

  function onPointerDown(event: ReactPointerEvent) {
    draggedRef.current = false;
    (event.target as HTMLElement).setPointerCapture?.(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinchStart.current = { distance: distance(a!, b!), scale };
      panStart.current = null;
      swipeStart.current = null;
    } else if (pointers.current.size === 1) {
      if (scale > MIN_SCALE) {
        panStart.current = { x: event.clientX, y: event.clientY, ox: offset.x, oy: offset.y };
      } else {
        swipeStart.current = { x: event.clientX, y: event.clientY };
      }
    }
  }

  function onPointerMove(event: ReactPointerEvent) {
    if (pointers.current.has(event.pointerId)) {
      const previous = pointers.current.get(event.pointerId)!;
      if (Math.hypot(previous.x - event.clientX, previous.y - event.clientY) > 6) {
        draggedRef.current = true;
      }
    }
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (pinchStart.current && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()];
      const factor = distance(a!, b!) / (pinchStart.current.distance || 1);
      setScale(clamp(pinchStart.current.scale * factor, MIN_SCALE, MAX_SCALE));
      return;
    }

    if (panStart.current && scale > MIN_SCALE) {
      setOffset({
        x: panStart.current.ox + (event.clientX - panStart.current.x),
        y: panStart.current.oy + (event.clientY - panStart.current.y),
      });
    }
  }

  function onPointerUp(event: ReactPointerEvent) {
    const wasTouch = event.pointerType === "touch";
    pointers.current.delete(event.pointerId);

    if (pointers.current.size < 2) pinchStart.current = null;

    if (panStart.current) {
      panStart.current = null;
    } else if (swipeStart.current && scale <= MIN_SCALE) {
      const dx = event.clientX - swipeStart.current.x;
      const dy = event.clientY - swipeStart.current.y;
      swipeStart.current = null;
      if (Math.abs(dx) > SWIPE_MIN && Math.abs(dx) > Math.abs(dy)) go(dx < 0 ? 1 : -1);
    }

    /* Double-tap to zoom (phones only; a mouse uses the dblclick event). */
    if (wasTouch && scale <= MIN_SCALE) {
      const now = Date.now();
      if (now - lastTap.current < 300) toggleZoom();
      lastTap.current = now;
    }
  }

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={item?.title ?? "Photograph viewer"}
      tabIndex={-1}
      className="fixed inset-0 z-300 flex flex-col bg-espresso/95 backdrop-blur-sm focus:outline-none motion-safe:animate-[fadeIn_.2s_ease-out]"
    >
      {/* ------------------------------------------------------------ toolbar */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 px-4 py-3 text-cream sm:px-6">
        <p className="text-eyebrow tabular-nums text-cream/60">
          {index + 1} / {items.length}
        </p>

        <div className="flex items-center gap-1.5">
          <IconButton label="Zoom out" onClick={() => zoomBy(1 / 1.35)} disabled={scale <= MIN_SCALE}>
            <path d="M5 12h14" />
          </IconButton>
          <IconButton label="Zoom in" onClick={() => zoomBy(1.35)} disabled={scale >= MAX_SCALE}>
            <path d="M12 5v14M5 12h14" />
          </IconButton>
          <IconButton
            label="Reset zoom"
            onClick={reset}
            disabled={scale <= MIN_SCALE && offset.x === 0 && offset.y === 0}
          >
            <path d="M4 4v6h6M20 20v-6h-6M20 9a8 8 0 0 0-14-4M4 15a8 8 0 0 0 14 4" />
          </IconButton>
          {allowDownload && item && (
            <a
              href={item.downloadUrl ?? item.src}
              download
              className="rounded-full p-2 text-cream/70 transition-colors hover:bg-cream/10 hover:text-cream"
              aria-label="Download this photograph at full size"
              title="Download full size"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 3v12m0 0 4-4m-4 4-4-4M4 20h16" />
              </svg>
            </a>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close the viewer"
            className="rounded-full p-2 text-cream/70 transition-colors hover:bg-cream/10 hover:text-cream"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" aria-hidden="true">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* --------------------------------------------------------------- stage */}
      <div
        ref={stageRef}
        onClick={(event) => {
          // Clicking the dark space around the photo closes it. A pan or swipe
          // must not: `draggedRef` records that the pointer actually travelled.
          if (scale <= MIN_SCALE && !draggedRef.current && event.target === event.currentTarget) {
            onClose();
          }
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={toggleZoom}
        style={{ touchAction: "none" }}
        className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden px-2"
      >
        {item && (
          <div
            className="absolute inset-0 flex items-center justify-center motion-safe:transition-transform motion-safe:duration-100"
            style={{ transform: `translate3d(${offset.x}px, ${offset.y}px, 0) scale(${scale})` }}
          >
            {item.placeholderUrl && !loaded && (
              <img
                src={item.placeholderUrl}
                alt=""
                aria-hidden="true"
                className="absolute inset-0 m-auto h-full w-full scale-105 object-contain blur-xl"
              />
            )}
            <img
              src={item.src}
              srcSet={item.srcSet}
              sizes={item.sizes}
              alt={item.alt ?? item.title ?? ""}
              draggable={false}
              onLoad={() => setLoaded(true)}
              className={`relative max-h-full max-w-full select-none object-contain transition-opacity duration-300 motion-reduce:transition-none ${
                loaded || !item.placeholderUrl ? "opacity-100" : "opacity-0"
              }`}
            />
          </div>
        )}
      </div>

      {/* ------------------------------------------------- caption + arrows */}
      {many && (
        <>
          <LightboxArrow side="previous" onClick={() => go(-1)} />
          <LightboxArrow side="next" onClick={() => go(1)} />
        </>
      )}

      {item && (item.title || item.caption) && (
        <figcaption className="shrink-0 px-6 pb-4 text-center">
          {item.title && (
            <p className="font-display text-lg font-semibold tracking-[-0.02em] text-cream">
              {item.title}
            </p>
          )}
          {item.caption && (
            <p className="mx-auto mt-1.5 max-w-2xl text-sm leading-relaxed text-cream/65">
              {item.caption}
            </p>
          )}
        </figcaption>
      )}
    </div>
  );
}

/** Round icon button that dims when its action is not available. */
function IconButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="rounded-full p-2 text-cream/70 transition-colors hover:bg-cream/10 hover:text-cream disabled:opacity-30"
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {children}
      </svg>
    </button>
  );
}

/** Previous / next control, pinned to the edge of the viewer. */
function LightboxArrow({ side, onClick }: { side: "previous" | "next"; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={side === "previous" ? "Previous photograph" : "Next photograph"}
      className={`absolute top-1/2 -translate-y-1/2 rounded-full bg-cream/10 p-3 text-cream/80 backdrop-blur-sm transition-colors hover:bg-cream/20 hover:text-cream focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cream ${
        side === "previous" ? "left-3 sm:left-6" : "right-3 sm:right-6"
      }`}
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d={side === "previous" ? "m15 18-6-6 6-6" : "m9 18 6-6-6-6"} />
      </svg>
    </button>
  );
}