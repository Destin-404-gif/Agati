"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check } from "lucide-react";

/**
 * Cart state for the storefront.
 *
 * The cart lives in `localStorage` and holds *references only* - product id,
 * variant id and quantity. Prices are deliberately absent: they are recomputed
 * by the server on every read (see `/api/cart/price`) and again when the order
 * is placed, so a stale or tampered `localStorage` can never change a total.
 *
 * Hydration: the store is an external store read through `useSyncExternalStore`,
 * whose snapshot is `null` until `localStorage` has been read. The server render
 * and the first client render therefore agree - an empty cart - and nothing
 * cart-dependent renders until the real lines arrive, so there is no hydration
 * mismatch and no flash of the wrong item count.
 */

export type CartItem = {
  product_id: number;
  variant_id: number | null;
  slug: string;
  name: string;
  variant_name: string | null;
  image_url: string | null;
  quantity: number;
};

export type AddableProduct = {
  id: number;
  slug: string;
  name: string;
  image_url: string | null;
};

const STORAGE_KEY = "agati-cart";
const MAX_ITEMS = 50;
const MAX_QUANTITY = 99;

type Toast = { id: number; message: string };

type CartValue = {
  items: CartItem[];
  /** False until localStorage has been read. Render nothing cart-dependent before then. */
  ready: boolean;
  /** Sum of quantities across every line. 0 before `ready`. */
  count: number;
  add: (product: AddableProduct, quantity?: number, variant?: { id: number; name: string | null } | null) => void;
  setQuantity: (key: string, quantity: number) => void;
  remove: (key: string) => void;
  clear: () => void;
  /** `product_id:variant_id`, or product id alone when there is no variant. */
  keyOf: (item: Pick<CartItem, "product_id" | "variant_id">) => string;
  quantityOf: (productId: number, variantId?: number | null) => number;
};

const CartContext = createContext<CartValue | null>(null);

export const cartItemKey = (productId: number, variantId?: number | null): string =>
  `${productId}:${variantId ?? 0}`;

const isFiniteInt = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value > 0;

const str = (value: unknown, max = 200): string =>
  typeof value === "string" ? value.slice(0, max) : "";

/** Drop anything corrupt rather than letting it break every later render. */
function parseStored(raw: string | null): CartItem[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    const out: CartItem[] = [];
    const seen = new Set<string>();

    for (const entry of parsed.slice(0, MAX_ITEMS * 2)) {
      const o = (entry ?? {}) as Record<string, unknown>;
      if (!isFiniteInt(o.product_id)) continue;

      const variantId =
        o.variant_id === null || o.variant_id === undefined || o.variant_id === 0
          ? null
          : isFiniteInt(o.variant_id)
            ? o.variant_id
            : null;

      const quantity = Math.min(Math.max(Math.trunc(Number(o.quantity) || 1), 1), MAX_QUANTITY);
      const key = cartItemKey(o.product_id, variantId);
      if (seen.has(key)) continue;
      seen.add(key);

      out.push({
        product_id: o.product_id,
        variant_id: variantId,
        slug: str(o.slug, 150),
        name: str(o.name, 150),
        variant_name: o.variant_name === null ? null : str(o.variant_name, 100) || null,
        image_url: o.image_url === null ? null : str(o.image_url, 300) || null,
        quantity,
      });
    }

    return out.slice(0, MAX_ITEMS);
  } catch {
    return [];
  }
}

/* ------------------------------------------------------------ the storage */

/**
 * A tiny external store around `localStorage`, so the cart can be read through
 * `useSyncExternalStore` instead of being copied into state from an effect.
 * That keeps the server render and the first client render identical, and gives
 * multi-tab sync for free.
 */
type Snapshot = CartItem[] | null;

let snapshot: Snapshot = null;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

/** Read storage once. `snapshot` stays `null` until this has run. */
function hydrate() {
  if (snapshot !== null) return;
  let parsed: CartItem[] = [];
  try {
    parsed = parseStored(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    // Storage blocked entirely: the cart still works, just for this visit only.
  }
  snapshot = parsed;
}

function subscribe(listener: () => void): () => void {
  hydrate();
  listeners.add(listener);

  function onStorage(event: StorageEvent) {
    if (event.key !== STORAGE_KEY) return;
    snapshot = parseStored(event.newValue);
    emit();
  }
  window.addEventListener("storage", onStorage);

  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** Stable reference between reads, which is what React requires of a snapshot. */
function getSnapshot(): Snapshot {
  return snapshot;
}

/** The server has no storage, so it always sees "not ready yet". */
function getServerSnapshot(): Snapshot {
  return null;
}

/** The empty cart, for before storage has been read. A shared frozen reference. */
const NO_LINES: CartItem[] = Object.freeze([]) as unknown as CartItem[];

/** Replace the cart, persist it and tell React. */
function commit(next: CartItem[]): void {
  snapshot = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Private browsing / quota exceeded: the cart still works for this visit.
  }
  emit();
}

/** Update the current lines. Always reads the freshest snapshot. */
function update(recipe: (current: CartItem[]) => CartItem[]): void {
  hydrate();
  commit(recipe(snapshot ?? []));
}

/* -------------------------------------------------------------- the provider */

export function CartProvider({ children }: { children: ReactNode }) {
  const items = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(0);

  /** `null` until storage has been read - render nothing cart-dependent before then. */
  const ready = items !== null;
  const lines = useMemo(() => items ?? NO_LINES, [items]);

  const notify = useCallback((message: string) => {
    const id = ++toastId.current;
    setToasts((current) => [...current, { id, message }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((t) => t.id !== id));
    }, 2600);
  }, []);

  const keyOf = useCallback(
    (item: Pick<CartItem, "product_id" | "variant_id">) =>
      cartItemKey(item.product_id, item.variant_id),
    [],
  );

  const add = useCallback<CartValue["add"]>(
    (product, quantity = 1, variant = null) => {
      const wanted = Math.min(Math.max(Math.trunc(quantity) || 1, 1), MAX_QUANTITY);
      const key = cartItemKey(product.id, variant?.id ?? null);

      // Merging into an existing line, and the MAX_ITEMS cap, both read the
      // freshest snapshot so two rapid clicks cannot lose a write.
      update((current) => {
        const index = current.findIndex(
          (item) => cartItemKey(item.product_id, item.variant_id) === key,
        );

        if (index >= 0) {
          const next = [...current];
          next[index] = {
            ...next[index],
            quantity: Math.min(next[index].quantity + wanted, MAX_QUANTITY),
          };
          return next;
        }

        if (current.length >= MAX_ITEMS) return current;

        return [
          ...current,
          {
            product_id: product.id,
            variant_id: variant?.id ?? null,
            slug: product.slug,
            name: product.name,
            variant_name: variant?.name ?? null,
            image_url: product.image_url,
            quantity: wanted,
          },
        ];
      });

      notify(`${product.name} added to your cart`);
    },
    [notify],
  );

  const setQuantity = useCallback((key: string, quantity: number) => {
    // Never below 1 - the decrement control removes the line instead.
    const next = Math.min(Math.max(Math.trunc(quantity) || 1, 1), MAX_QUANTITY);
    update((current) =>
      current.map((item) =>
        cartItemKey(item.product_id, item.variant_id) === key
          ? { ...item, quantity: next }
          : item,
      ),
    );
  }, []);

  const remove = useCallback((key: string) => {
    update((current) =>
      current.filter((item) => cartItemKey(item.product_id, item.variant_id) !== key),
    );
  }, []);

  const clear = useCallback(() => update(() => []), []);

  const count = useMemo(
    () => lines.reduce((sum, item) => sum + item.quantity, 0),
    [lines],
  );

  const quantityOf = useCallback(
    (productId: number, variantId?: number | null) =>
      lines.find(
        (item) =>
          cartItemKey(item.product_id, item.variant_id) === cartItemKey(productId, variantId),
      )?.quantity ?? 0,
    [lines],
  );

  const value = useMemo<CartValue>(
    () => ({ items: lines, ready, count, add, setQuantity, remove, clear, keyOf, quantityOf }),
    [lines, ready, count, add, setQuantity, remove, clear, keyOf, quantityOf],
  );

  return (
    <CartContext.Provider value={value}>
      {children}
      <CartToasts toasts={toasts} />
    </CartContext.Provider>
  );
}

export function useCart(): CartValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside <CartProvider>");
  return ctx;
}

/** Small confirmation that an item reached the cart. */
function CartToasts({ toasts }: { toasts: Toast[] }) {
  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="pointer-events-none fixed inset-x-0 bottom-5 z-[80] flex flex-col items-center gap-2 px-4"
    >
      <AnimatePresence initial={false}>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="flex items-center gap-3 rounded-full bg-espresso py-3 pr-5 pl-3 text-cream shadow-lift"
          >
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-sage text-espresso">
              <Check className="size-3.5" aria-hidden="true" />
            </span>
            <span className="text-[13px] font-medium">{toast.message}</span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}