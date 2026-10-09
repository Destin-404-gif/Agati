"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Icon } from "./icons";
import { Button, cx } from "./ui";
import { uploadWithProgress } from "./ImageUploader";

/* ------------------------------------------------------------------ modal */

/**
 * The one modal.
 *
 * Root cause of the old "Edit product runs off the bottom of the screen" bug:
 * the overlay was rendered wherever the calling component sat in the tree, and
 * the panel was capped with `max-h-[92vh]` but given no `dvh` fallback and no
 * flex `min-h-0` on the scrolling body. A flex child defaults to
 * `min-height: auto`, so the body refused to shrink below its content, the
 * panel grew past the cap, and the footer was pushed out of the viewport.
 *
 * What this fixes, once, for every dialog in the dashboard:
 *   - rendered through a portal on document.body, so no ancestor with
 *     `transform`, `overflow` or `backdrop-filter` can trap it;
 *   - `max-height: calc(100dvh - 2rem)` with a `vh` fallback, so mobile browser
 *     chrome does not push the footer off screen;
 *   - a real flex column where only `ModalBody` scrolls, and the footer cannot
 *     be scrolled away;
 *   - focus trap, Escape, backdrop click, focus restore and scroll lock.
 */

const SIZES = {
  sm: "sm:max-w-sm",
  md: "sm:max-w-lg",
  lg: "sm:max-w-2xl",
  xl: "sm:max-w-4xl",
} as const;

export type ModalSize = keyof typeof SIZES;

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type=hidden])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: ModalSize;
  /**
   * Set when the form behind the dialog has unsaved edits. Escape and a
   * backdrop click then ask before discarding them instead of closing outright.
   */
  dirty?: boolean;
}

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  dirty = false,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  /* Warn before throwing away unsaved edits. */
  const requestClose = useCallback(() => {
    if (dirty) {
      const leave = window.confirm(
        "You have unsaved changes. Close anyway and discard them?",
      );
      if (!leave) return;
    }
    onClose();
  }, [dirty, onClose]);

  /* Escape closes, Tab is trapped inside the panel. */
  useEffect(() => {
    if (!open) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        requestClose();
        return;
      }

      if (event.key !== "Tab") return;

      const panel = panelRef.current;
      if (!panel) return;

      const items = Array.from(
        panel.querySelectorAll<HTMLElement>(FOCUSABLE),
      ).filter((el) => el.offsetParent !== null || el === document.activeElement);

      if (items.length === 0) {
        event.preventDefault();
        return;
      }

      const first = items[0]!;
      const last = items[items.length - 1]!;
      const active = document.activeElement;

      if (event.shiftKey && (active === first || !panel.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [open, requestClose]);

  /*
   * Scroll lock without layout jump.
   *
   * `position: fixed` on the body is the only lock that also stops iOS rubber
   * banding, but it scrolls the page to the top unless the current scroll
   * offset is restored. The right padding compensates for the scrollbar so the
   * page underneath does not shift sideways when it disappears.
   */
  useLayoutEffect(() => {
    if (!open) return;

    const body = document.body;
    const scrollY = window.scrollY;
    const gap = window.innerWidth - document.documentElement.clientWidth;

    const previous = {
      position: body.style.position,
      top: body.style.top,
      width: body.style.width,
      overflowY: body.style.overflowY,
      paddingRight: body.style.paddingRight,
    };

    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.width = "100%";
    body.style.overflowY = "scroll";
    if (gap > 0) body.style.paddingRight = `${gap}px`;

    return () => {
      body.style.position = previous.position;
      body.style.top = previous.top;
      body.style.width = previous.width;
      body.style.overflowY = previous.overflowY;
      body.style.paddingRight = previous.paddingRight;
      window.scrollTo(0, scrollY);
    };
  }, [open]);

  /*
   * Move focus in on open, and hand it back to the trigger on close.
   *
   * `mounted` is part of the dependency list on purpose: the portal cannot be
   * rendered until after the first client effect has flipped `mounted`, so an
   * effect keyed only on `open` would find no panel and never focus anything.
   *
   * The focus happens in a `requestAnimationFrame` so it lands after layout,
   * and the cleanup only restores focus when it is still inside the dialog -
   * React re-runs mount effects in development, and an unconditional restore
   * would snatch focus back to the trigger right after the dialog opened.
   */
  useEffect(() => {
    if (!open || !mounted) return;

    const panel = panelRef.current;
    if (!panel) return;

    const onClose_ = panel.ownerDocument.activeElement as HTMLElement | null;

    const frame = requestAnimationFrame(() => {
      const target =
        panel.querySelector<HTMLElement>("[data-autofocus]") ??
        panel.querySelector<HTMLElement>(FOCUSABLE) ??
        panel;
      target.focus();
    });

    return () => {
      cancelAnimationFrame(frame);
      const active = panel.ownerDocument.activeElement;
      const stillOurs =
        !active || active === panel.ownerDocument.body || panel.contains(active);
      if (stillOurs) onClose_?.focus?.();
    };
  }, [open, mounted]);

  if (!mounted || !open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-200 flex items-end justify-center sm:items-center sm:p-4"
      /* The overlay covers the sidebar and top bar, so nothing behind it can
         intercept a click meant for the dialog. */
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) requestClose();
      }}
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-espresso/60 backdrop-blur-sm motion-safe:animate-[fadeIn_.15s_ease-out]"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={cx(
          "relative flex w-full flex-col overflow-hidden border border-outline bg-bg shadow-lift",
          "max-h-[calc(100vh-2rem)] supports-[height:100dvh]:max-h-[calc(100dvh-2rem)]",
          "rounded-t-2xl sm:rounded-2xl",
          SIZES[size],
          "motion-safe:animate-[modalIn_.18s_ease-out]",
        )}
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <ModalHeader title={title} description={description} onClose={requestClose} />
        <ModalBody>{children}</ModalBody>
        {footer && <ModalFooter>{footer}</ModalFooter>}
      </div>
    </div>,
    document.body,
  );
}

export function ModalHeader({
  title,
  description,
  onClose,
}: {
  title: string;
  description?: string;
  onClose: () => void;
}) {
  return (
    <div className="flex shrink-0 items-start justify-between gap-4 border-b border-outline px-5 py-4">
      <div className="min-w-0">
        <h2 className="font-display text-lg font-semibold tracking-tight">{title}</h2>
        {description && (
          <p className="mt-0.5 text-sm text-fg-soft">{description}</p>
        )}
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close dialog"
        className="-mt-1 shrink-0 cursor-pointer rounded-lg p-1.5 text-fg-muted transition-colors hover:bg-fill-strong"
      >
        <Icon name="close" className="h-4 w-4" filled />
      </button>
    </div>
  );
}

/**
 * The only part that scrolls. `min-h-0` is the important bit: without it a flex
 * child refuses to shrink and pushes the footer out of the panel.
 */
export function ModalBody({ children }: { children: ReactNode }) {
  return (
    <div
      data-modal-body
      className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5"
    >
      {children}
    </div>
  );
}

/** Opaque so scrolled content never shows through the buttons. */
export function ModalFooter({ children }: { children: ReactNode }) {
  return (
    <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-outline bg-bg px-5 py-4">
      {children}
    </div>
  );
}

/**
 * Submit a form that lives in the dialog body from a button in the dialog
 * footer.
 *
 * The HTML `form="id"` attribute would normally do this, but the two ends live
 * in different parts of the tree once the dialog is portalled, and relying on
 * the association proved unreliable. `requestSubmit()` is explicit, and unlike
 * `form.submit()` it still runs constraint validation and fires the submit
 * event, so the form's own handler decides what happens.
 */
export function submitFormById(id: string): void {
  const form = document.getElementById(id);
  if (form instanceof HTMLFormElement) form.requestSubmit();
}

  /* ---------------------------------------------------------- confirm dialog */

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "primary";
  onConfirm: () => void | Promise<void>;
}

interface ConfirmApi {
  dialog: ReactNode;
  confirmDialog: (options: ConfirmOptions) => void;
}

/** Local confirm state. Renders a Modal at the point of use. */
export function useConfirmState(): ConfirmApi {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const [busy, setBusy] = useState(false);

  const confirmDialog = useCallback((opts: ConfirmOptions) => {
    setOptions(opts);
  }, []);

  const close = useCallback(() => {
    setOptions(null);
    setBusy(false);
  }, []);

  const onConfirm = useCallback(async () => {
    if (!options) return;
    setBusy(true);
    try {
      await options.onConfirm();
      close();
    } finally {
      setBusy(false);
    }
  }, [options, close]);

  const dialog = options ? (
    <Modal
      open
      onClose={close}
      title={options.title}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={busy}>
            {options.cancelLabel ?? "Cancel"}
          </Button>
          <Button
            variant={options.variant === "danger" ? "danger" : "primary"}
            onClick={onConfirm}
            loading={busy}
          >
            {options.confirmLabel ?? "Confirm"}
          </Button>
        </>
      }
    >
      <p className="text-sm leading-relaxed text-fg">
        {options.message}
      </p>
    </Modal>
  ) : null;

  return { dialog, confirmDialog };
}

/* ------------------------------------------------------------- image field */

export interface UploadedImage {
  url: string;
  name: string;
}

/**
 * Uploads to `storage/uploads` through the upload endpoint and previews the result.
 * Falls back to a pasted URL when a file is chosen directly.
 */
export function ImageField({
  value,
  onChange,
  label = "Image",
  hint = "PNG, JPEG or WebP up to 5MB.",
  allowSvg = false,
}: {
  value: string;
  onChange: (url: string) => void;
  label?: string;
  hint?: string;
  /** Logos and favicons accept SVG; product and banner photos do not. */
  allowSvg?: boolean;
}) {
  const [preview, setPreview] = useState(value);
  useEffect(() => {
    if (value !== preview) {
      setPreview(value);
    }
  }, [value, preview]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const objectUrl = useRef<string | null>(null);

  useEffect(
    () => () => {
      if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    },
  );

  // The parent owns the URL, so adopt its value when it changes (after an
  // upload, or when switching products). Adjusted during render, not in an
  // effect, so the preview never flashes the previous image.


  async function onFile(file: File) {
    setError(null);

    if (file.size > 5 * 1024 * 1024) {
      setError("That file is larger than 5MB.");
      return;
    }

    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    objectUrl.current = URL.createObjectURL(file);
    setPreview(objectUrl.current);
    setUploading(true);
    setProgress(0);

    try {
      const data = await uploadWithProgress(file, "/api/admin/uploads", {
        onProgress: setProgress,
      });
      const url = data.url;
      if (!url) throw new Error("Upload failed: the server did not return a URL.");

      if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
      objectUrl.current = null;
      setPreview(url);
      onChange(url);
    } catch (err) {
      // A dropped session is the most likely cause and the message the admin
      // sees should say so, otherwise "fetch failed" looks like a broken server.
      const message =
        err instanceof TypeError
          ? "Could not reach the server. Check your connection and that your session has not expired, then try again."
          : err instanceof Error
            ? err.message
            : "Upload failed.";
      setError(message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-2">
      <span className="block text-xs font-semibold tracking-wide text-fg uppercase">
        {label}
      </span>

      <div className="flex flex-wrap items-start gap-4">
        <div className="relative flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-outline bg-field">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={preview}
              alt="Preview"
              className="h-full w-full object-cover"
            />
          ) : (
            <Icon name="image" className="h-6 w-6 text-fg-faint" />
          )}
          {uploading && (
            <div className="absolute inset-x-2 bottom-2 h-1.5 overflow-hidden rounded-full bg-bg/80" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label="Image upload progress">
              <div className="h-full bg-terracotta transition-[width]" style={{ width: `${progress}%` }} />
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-2">
          <input
            ref={inputRef}
            type="file"
            accept={
              allowSvg
                ? "image/png,image/jpeg,image/webp,image/svg+xml"
                : "image/png,image/jpeg,image/webp"
            }
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void onFile(file);
              e.target.value = "";
            }}
          />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            loading={uploading}
            onClick={() => inputRef.current?.click()}
          >
            Choose file
          </Button>

          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="/images/example.jpg"
            className="w-full rounded-xl border border-outline bg-field px-3 py-2 text-xs text-fg placeholder:text-fg-faint focus-visible:border-outline-strong focus-visible:outline-none"
          />
          <p className="text-xs text-fg-muted">{hint}</p>
          {error && <p className="text-xs font-medium text-terracotta">{error}</p>}
        </div>
      </div>
    </div>
  );
}
