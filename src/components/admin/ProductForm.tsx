"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "./Toast";
import { ImageField, Modal, submitFormById } from "./overlays";
import { Alert, Button, Checkbox, Field, Input, Select, Textarea } from "./ui";
import { Icon } from "./icons";
import { fieldErrors, productSchema, slugify } from "@/lib/admin-schemas";
import { PRODUCT_STATUSES } from "@/lib/admin-nav";

interface CategoryOption {
  id: number;
  name: string;
  slug: string;
  subcategories: { id: number; name: string; slug: string }[];
}

export interface ProductFormValues {
  id?: number;
  name: string;
  slug: string;
  description: string;
  price: string;
  categoryId: string;
  subcategoryId: string;
  stockQuantity: string;
  status: string;
  isNew: boolean;
  isFeatured: boolean;
  images: { url: string }[];
}

export const emptyProduct: ProductFormValues = {
  name: "",
  slug: "",
  description: "",
  price: "",
  categoryId: "",
  subcategoryId: "",
  stockQuantity: "0",
  status: "active",
  isNew: false,
  isFeatured: false,
  images: [],
};

/**
 * Create/edit form. Validates with the same Zod schema the API uses, so the
 * rules cannot drift between client and server.
 */
export function ProductForm({
  initial,
  onSaved,
  setSaving: setSavingProp,
}: {
  initial?: ProductFormValues;
  onSaved?: (saved: ProductFormValues, id: number, slug: string) => void;
  /** Used standalone on `/admin/products/new`; the modal owns its save state. */
  setSaving?: (value: boolean) => void;
}) {
  const router = useRouter();
  const toast = useToast();

  const setSaving = setSavingProp ?? (() => {});

  // Re-seed the form when a *different* product is loaded. Keyed on the id
  // rather than on object identity, because the parent re-renders (toasts,
  // list refreshes) and a new `initial` object with the same id must not wipe
  // what the user is typing.
  const initialKey = initial?.id ?? "new";
  const [loadedKey, setLoadedKey] = useState(initialKey);

  const [values, setValues] = useState<ProductFormValues>(initial ?? emptyProduct);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [categoriesError, setCategoriesError] = useState("");
  const [slugTouched, setSlugTouched] = useState(Boolean(initial?.slug));

  if (initial && initialKey !== loadedKey) {
    setLoadedKey(initialKey);
    setValues(initial);
  }

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/categories", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error ?? "Could not load categories.");
        if (!cancelled) setCategories(data.categories ?? []);
      })
      .catch((error: unknown) => {
        if (!cancelled) setCategoriesError(error instanceof Error ? error.message : "Could not load categories.");
      })
      .finally(() => { if (!cancelled) setCategoriesLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const editing = Boolean(values.id);

  function set<K extends keyof ProductFormValues>(
    key: K,
    value: ProductFormValues[K],
  ) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function onNameBlur() {
    if (slugTouched || editing) return;
    const next = slugify(values.name);
    if (next) set("slug", next);
  }

  const previewSlug = useMemo(
    () => (values.slug ? slugify(values.slug) : slugify(values.name)),
    [values.slug, values.name],
  );

  /** Field-key -> the input id, so a rejected save can put the cursor on it. */
  const FIELD_IDS: Record<string, string> = {
    name: "name",
    slug: "slug",
    description: "description",
    price: "price",
    categoryId: "category",
    subcategoryId: "subcategory",
    stockQuantity: "stock",
    status: "status",
  };

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setErrors({});
    setFormError(null);

    const payload = {
      name: values.name,
      slug: values.slug ? slugify(values.slug) : "",
      description: values.description,
      price: values.price,
      categoryId: values.categoryId ? Number(values.categoryId) : null,
      subcategoryId: values.subcategoryId ? Number(values.subcategoryId) : null,
      stockQuantity: values.stockQuantity,
      status: values.status,
      isNew: values.isNew,
      isFeatured: values.isFeatured,
      images: values.images.filter((i) => i.url),
    };

    /*
     * Validation happens here rather than in the browser.
     *
     * The modal footer submits this form from outside the dialog, so the panel's
     * `overflow-hidden` clipped the native validation bubble whenever a required
     * field was empty - the button looked like it had hung. Rejecting the payload
     * with the same Zod schema the API uses means the first problem is shown as a
     * toast and an alert, and the offending input is focused.
     */
    const parsed = productSchema.safeParse(payload);
    if (!parsed.success) {
      const fields = fieldErrors(parsed.error);
      setErrors(fields);
      const message =
        Object.values(fields)[0] ?? "Please check the highlighted fields.";
      setFormError(message);
      toast.error(message);

      const firstKey = Object.keys(fields)[0];
      const id = firstKey ? FIELD_IDS[firstKey] : undefined;
      if (id) {
        const el = document.getElementById(id);
        el?.scrollIntoView({ block: "center", behavior: "smooth" });
        el?.focus({ preventScroll: true });
      }
      return;
    }

    setSaving(true);

    try {
      const res = await fetch(
        editing ? `/api/admin/products/${values.id}` : "/api/admin/products",
        {
          method: editing ? "PUT" : "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(parsed.data),
        },
      );
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (data.fields) setErrors(data.fields);
        const message = data.error ?? "Could not save that product.";
        setFormError(message);
        toast.error(message);
        return;
      }

      toast.success(editing ? "Product updated." : "Product created.");
      onSaved?.(values, data.id, data.slug);
      if (!onSaved) router.push("/admin/products");
    } catch {
      const message = "Network error. Check your connection and try again.";
      setFormError(message);
      toast.error(message);
    } finally {
      // Nothing may leave the footer's Save button stuck in its loading state.
      setSaving(false);
    }
  }

  function addImage() {
    // The server caps a product at 12 images; mirror that here so the button
    // cannot add a thirteenth row that the save would then reject.
    if (values.images.length >= 12) return;
    set("images", [...values.images, { url: "" }]);
  }

  function updateImage(index: number, url: string) {
    set(
      "images",
      values.images.map((img, i) => (i === index ? { url } : img)),
    );
  }

  function removeImage(index: number) {
    set(
      "images",
      values.images.filter((_, i) => i !== index),
    );
  }

  function moveImage(index: number, delta: number) {
    const next = [...values.images];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target]!, next[index]!];
    set("images", next);
  }

  return (
    /* The id lets the modal footer submit this form from outside it, which is
       what keeps Save/Cancel pinned to the bottom of the dialog. `noValidate`
       hands validation to `onSubmit` - the browser's own bubble is clipped by
       the dialog, which is what made the footer button look like it hung. */
    <form id="product-form" onSubmit={onSubmit} noValidate className="space-y-6">
      {formError && <Alert tone="error">{formError}</Alert>}

      <div className="grid gap-5 lg:grid-cols-3">
        {/* ------------------------------------------------------ details */}
        <div className="space-y-5 lg:col-span-2">
          <div className="space-y-4 rounded-2xl border border-outline bg-surface p-5">
            <h2 className="font-display text-base font-semibold">Details</h2>

            <Field label="Name" htmlFor="name" required error={errors.name}>
              <Input
                id="name"
                value={values.name}
                onChange={(e) => set("name", e.target.value)}
                onBlur={onNameBlur}
                placeholder="Walnut Dining Table"
                invalid={Boolean(errors.name)}
                required
              />
            </Field>

            <Field
              label="URL slug"
              htmlFor="slug"
              hint={
                previewSlug ? (
                  <>
                    agati.com/furniture/{" "}
                    <span className="font-medium text-fg">
                      {previewSlug}
                    </span>
                  </>
                ) : (
                  "Generated from the name."
                )
              }
              error={errors.slug}
            >
              <Input
                id="slug"
                value={values.slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  set("slug", e.target.value);
                }}
                placeholder="walnut-dining-table"
                invalid={Boolean(errors.slug)}
              />
            </Field>

            <Field label="Description" htmlFor="description" error={errors.description}>
              <Textarea
                id="description"
                value={values.description}
                onChange={(e) => set("description", e.target.value)}
                rows={6}
                placeholder="Solid walnut, hand-finished…"
              />
            </Field>
          </div>

          <div className="space-y-3 rounded-2xl border border-outline bg-surface p-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-display text-base font-semibold">Images</h2>
                <p className="text-xs text-fg-soft">
                  The first image is the one the shop displays.
                </p>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={addImage}
                disabled={values.images.length >= 12}
              >
                <Icon name="plus" className="h-3.5 w-3.5" filled />
                Add another image
              </Button>
            </div>

            {/*
                A new product starts with no image rows, and an empty row has no
                uploader in it, so without this the admin sees only "No images
                yet" and has to guess that "Add image" reveals a file picker.
                The first image gets a real uploader immediately.
              */}
              {values.images.length === 0 && (
                <li className="rounded-xl border border-outline p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-semibold text-fg-soft">
                      Image 1
                      <span className="ml-2 rounded-full bg-sage/15 px-2 py-0.5 text-[10px] text-sage-dark dark:text-sage-light">
                        Primary
                      </span>
                    </span>
                  </div>
                  <ImageField
                    value=""
                    onChange={(url) => {
                      if (url) set("images", [{ url }]);
                    }}
                    key="primary-img" label="Primary image"
                    hint="This is the photo the shop and search results show. PNG, JPEG or WebP up to 5MB."
                  />
                </li>
              )}

              {values.images.length > 0 && (
              <ul className="space-y-3">
                {values.images.map((image, index) => (
                  <li
                    key={index}
                    className="rounded-xl border border-outline p-3"
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-xs font-semibold text-fg-soft">
                        Image {index + 1}
                        {index === 0 && (
                          <span className="ml-2 rounded-full bg-sage/15 px-2 py-0.5 text-[10px] text-sage-dark dark:text-sage-light">
                            Primary
                          </span>
                        )}
                      </span>
                      <div className="flex items-center gap-1">
                        <IconButton
                          label="Move up"
                          disabled={index === 0}
                          onClick={() => moveImage(index, -1)}
                        >
                          <Icon name="chevron" className="h-3 w-3 rotate-90" />
                        </IconButton>
                        <IconButton
                          label="Move down"
                          disabled={index === values.images.length - 1}
                          onClick={() => moveImage(index, 1)}
                        >
                          <Icon name="chevron" className="h-3 w-3 -rotate-90" />
                        </IconButton>
                        <IconButton
                          label="Remove image"
                          onClick={() => removeImage(index)}
                          tone="danger"
                        >
                          <Icon name="trash" className="h-3.5 w-3.5" filled />
                        </IconButton>
                      </div>
                    </div>
                    <ImageField
                      key={index}
                      value={image.url}
                      onChange={(url) => updateImage(index, url)}
                    />
                  </li>
                ))}
              </ul>
              )}
            {errors.images && (
              <p className="text-xs font-medium text-terracotta">{errors.images}</p>
            )}
          </div>
        </div>

        {/* --------------------------------------------------------- aside */}
        <div className="space-y-5">
          <div className="space-y-4 rounded-2xl border border-outline bg-surface p-5">
            <h2 className="font-display text-base font-semibold">Organisation</h2>

            <Field label="Category" htmlFor="category" required error={errors.categoryId}>
              <Select
                id="category"
                value={values.categoryId}
                required
                disabled={categoriesLoading || Boolean(categoriesError)}
                onChange={(event) => {
                  set("categoryId", event.target.value);
                  set("subcategoryId", "");
                }}
              >
                <option value="">{categoriesLoading ? "Loading categories..." : "Choose a category"}</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>{category.name}</option>
                ))}
              </Select>
            </Field>
            {categoriesError && <Alert tone="error">{categoriesError}</Alert>}

            <Field label="Subcategory" htmlFor="subcategory" error={errors.subcategoryId}>
              <Select
                id="subcategory"
                value={values.subcategoryId}
                disabled={!values.categoryId}
                onChange={(event) => set("subcategoryId", event.target.value)}
              >
                <option value="">No subcategory</option>
                {categories
                  .find((category) => String(category.id) === values.categoryId)
                  ?.subcategories.map((subcategory) => (
                    <option key={subcategory.id} value={subcategory.id}>{subcategory.name}</option>
                  ))}
              </Select>
            </Field>

            <Field label="Status" htmlFor="status" error={errors.status}>
              <Select
                id="status"
                value={values.status}
                onChange={(e) => set("status", e.target.value)}
              >
                {PRODUCT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            </Field>

            <div className="flex flex-wrap gap-4 pt-1">
              <Checkbox
                label="Mark as new"
                checked={values.isNew}
                onChange={(e) => set("isNew", e.target.checked)}
              />
              <Checkbox
                label="Featured"
                checked={values.isFeatured}
                onChange={(e) => set("isFeatured", e.target.checked)}
              />
            </div>
          </div>

          <div className="space-y-4 rounded-2xl border border-outline bg-surface p-5">
            <h2 className="font-display text-base font-semibold">Price & stock</h2>

            <Field label="Price (£)" htmlFor="price" required error={errors.price}>
              <Input
                id="price"
                type="number"
                step="0.01"
                min="0"
                value={values.price}
                onChange={(e) => set("price", e.target.value)}
                placeholder="0.00"
                invalid={Boolean(errors.price)}
                required
              />
            </Field>

            <Field
              label="Stock quantity"
              htmlFor="stock"
              required
              error={errors.stockQuantity}
            >
              <Input
                id="stock"
                type="number"
                step="1"
                min="0"
                value={values.stockQuantity}
                onChange={(e) => set("stockQuantity", e.target.value)}
                invalid={Boolean(errors.stockQuantity)}
                required
              />
            </Field>
          </div>
        </div>
      </div>
    </form>
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  tone = "plain",
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  tone?: "plain" | "danger";
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={[
        "flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg transition-colors disabled:cursor-not-allowed disabled:opacity-30",
        tone === "danger"
          ? "text-terracotta hover:bg-terracotta/10"
          : "text-fg-muted hover:bg-fill-strong",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

/** Modal wrapper so lists can open the form without a separate route. */
export function ProductFormModal({
  open,
  onClose,
  onSaved,
  initial,
}: {
  open: boolean;
  onClose: () => void;
  onSaved?: (saved: ProductFormValues, id: number, slug: string) => void;
  initial?: ProductFormValues;
}) {
  const editing = Boolean(initial?.id);
  const [saving, setSaving] = useState(false);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? "Edit product" : "New product"}
      size="xl"
      footer={
        <ProductFormFooter
          saving={saving}
          editing={editing}
          onCancel={onClose}
        />
      }
    >
      <ProductForm
        initial={initial}
        onSaved={(saved, id, slug) => {
          onSaved?.(saved, id, slug);
          onClose();
        }}
        setSaving={setSaving}
      />
    </Modal>
  );
}

/**
 * The footer is rendered by the modal so it stays pinned to the bottom of the
 * dialog, but it still has to submit the form in the body. The `form` attribute
 * associates the button with the form wherever it lives in the document (both
 * sit inside the same portal); `requestSubmit` is still called as a belt-and-
 * braces path for browsers that ignore the association across a portal. The
 * form is `noValidate`, so neither route can be silently blocked.
 */
export function ProductFormFooter({
  saving,
  editing,
  onCancel,
}: {
  saving: boolean;
  editing: boolean;
  onCancel: () => void;
}) {
  return (
    <>
      <Button type="button" variant="secondary" onClick={onCancel} disabled={saving}>
        Cancel
      </Button>
      <Button
        type="submit"
        form="product-form"
        onClick={(event) => {
          event.preventDefault();
          submitFormById("product-form");
        }}
        loading={saving}
      >
        {saving ? "Saving…" : editing ? "Save changes" : "Create product"}
      </Button>
    </>
  );
}
