"use client";

import { useState, type ComponentType, type FormEvent } from "react";
import * as LucideIcons from "lucide-react";
import { ChevronDown } from "lucide-react";
import { Button, Field, Input, Select } from "./ui";
import { Icon } from "./icons";
import type { NavigationData, NavigationItem, NavbarKey } from "@/lib/navigation-data";

export interface ProductPlacementDraft {
  navbar: NavbarKey | "";
  navItemId: string;
  megaSectionId: string;
}

const EMPTY_PLACEMENT: ProductPlacementDraft = { navbar: "", navItemId: "", megaSectionId: "" };
const UploadIcon = (LucideIcons as unknown as Record<string, ComponentType<{ className?: string }>>).Package;

function ItemIcon({ name }: { name: string }) {
  if (name.startsWith("/")) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={name} alt="" className="size-4 object-contain" />;
  }
  const Glyph = (LucideIcons as unknown as Record<string, ComponentType<{ className?: string }>>)[name] ?? UploadIcon;
  return <Glyph className="size-4" aria-hidden="true" />;
}

export function ProductPlacementEditor({
  navigation: initialNavigation,
  value,
  onChange,
  error,
}: {
  navigation: NavigationData;
  value: ProductPlacementDraft[];
  onChange: (placements: ProductPlacementDraft[]) => void;
  error?: string;
}) {
  const [navigation, setNavigation] = useState(initialNavigation);
  const [newItemFor, setNewItemFor] = useState<number | null>(null);
  const [newSectionFor, setNewSectionFor] = useState<number | null>(null);
  const [openItemPicker, setOpenItemPicker] = useState<number | null>(null);
  const [newItem, setNewItem] = useState({ label: "", icon: "Package", description: "" });
  const [newSection, setNewSection] = useState({ name: "", groupLabel: "Shop by type", icon: "Package", description: "" });
  const [quickError, setQuickError] = useState("");

  function update(index: number, patch: Partial<ProductPlacementDraft>) {
    onChange(value.map((placement, position) => position === index ? { ...placement, ...patch } : placement));
  }

  async function addMenuItem(index: number, navbar: NavbarKey, event: FormEvent) {
    event.preventDefault();
    setQuickError("");
    const res = await fetch("/api/admin/navigation", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ navbar, ...newItem, hasMegaMenu: navbar === "category_bar", sortOrder: navigation[navbar].length }),
    });
    const data = await res.json();
    if (!res.ok) return setQuickError(data.error ?? "Could not create menu item.");
    const item: NavigationItem = { ...data, sections: [] };
    setNavigation((current) => ({ ...current, [navbar]: [...current[navbar], item] }));
    update(index, { navItemId: String(item.id), megaSectionId: "" });
    setNewItem({ label: "", icon: "Package", description: "" });
    setNewItemFor(null);
  }

  async function addSection(index: number, navItem: NavigationItem, event: FormEvent) {
    event.preventDefault();
    setQuickError("");
    const res = await fetch("/api/admin/navigation/sections", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ navItemId: navItem.id, ...newSection, sortOrder: navItem.sections.length }),
    });
    const data = await res.json();
    if (!res.ok) return setQuickError(data.error ?? "Could not create mega-menu section.");
    setNavigation((current) => ({
      ...current,
      [navItem.navbar]: current[navItem.navbar].map((item) => item.id === navItem.id
        ? { ...item, has_mega_menu: true, sections: [...item.sections, data] }
        : item),
    }));
    update(index, { megaSectionId: String(data.id) });
    setNewSection({ name: "", groupLabel: "Shop by type", icon: "Package", description: "" });
    setNewSectionFor(null);
  }

  return (
    <div className="space-y-4">
      {value.map((placement, index) => {
        const items = placement.navbar ? navigation[placement.navbar] : [];
        const item = items.find((entry) => String(entry.id) === placement.navItemId);
        return (
          <section key={index} className="space-y-3 rounded-xl border border-outline p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase text-fg-muted">Placement {index + 1}</p>
              {value.length > 1 && (
                <button type="button" onClick={() => onChange(value.filter((_, position) => position !== index))} aria-label="Remove placement" className="p-1 text-terracotta">
                  <Icon name="trash" className="size-4" />
                </button>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Navbar" htmlFor={`placement-${index}-navbar`} required error={index === 0 ? error : undefined}>
                <Select
                  id={`placement-${index}-navbar`}
                  required
                  value={placement.navbar}
                  onChange={(event) => {
                    const navbar = event.target.value as NavbarKey | "";
                    update(index, { navbar, navItemId: "", megaSectionId: "" });
                    setNewItemFor(null);
                    setNewSectionFor(null);
                  }}
                >
                  <option value="">Choose a navbar</option>
                  <option value="top_bar">Top bar</option>
                  <option value="category_bar">Category bar</option>
                </Select>
              </Field>
              <Field label="Menu item" htmlFor={`placement-${index}-item`} required>
                <div className="relative">
                  <button
                    id={`placement-${index}-item`}
                    type="button"
                    role="combobox"
                    aria-label="Menu item"
                    aria-expanded={openItemPicker === index}
                    aria-haspopup="listbox"
                    aria-controls={`placement-${index}-item-listbox`}
                    aria-required="true"
                    disabled={!placement.navbar}
                    onClick={() => setOpenItemPicker(openItemPicker === index ? null : index)}
                    onKeyDown={(event) => { if (event.key === "Escape") setOpenItemPicker(null); }}
                    className="flex w-full items-center gap-2 rounded-xl border border-outline bg-field px-3 py-2.5 text-left text-sm text-fg disabled:opacity-50"
                  >
                    {item && <ItemIcon name={item.icon} />}
                    <span className="min-w-0 flex-1 truncate">{item?.label ?? "Choose a menu item"}</span>
                    <ChevronDown className={`size-4 shrink-0 text-fg-muted transition-transform ${openItemPicker === index ? "rotate-180" : ""}`} />
                  </button>
                  {openItemPicker === index && (
                    <div id={`placement-${index}-item-listbox`} role="listbox" aria-label="Menu items" className="absolute inset-x-0 top-full z-20 mt-1 max-h-64 overflow-y-auto rounded-xl border border-outline bg-surface p-1 shadow-lift">
                      {items.map((entry) => (
                        <button
                          key={entry.id}
                          type="button"
                          role="option"
                          aria-selected={entry.id === item?.id}
                          onClick={() => {
                            setNewItemFor(null);
                            update(index, { navItemId: String(entry.id), megaSectionId: "" });
                            setOpenItemPicker(null);
                          }}
                          className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm hover:bg-fill"
                        >
                          <ItemIcon name={entry.icon} />
                          <span>{entry.label}</span>
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => {
                          setNewItemFor(index);
                          update(index, { navItemId: "", megaSectionId: "" });
                          setOpenItemPicker(null);
                        }}
                        className="mt-1 flex w-full items-center gap-2 border-t border-outline px-2.5 py-2 text-left text-sm font-semibold text-terracotta"
                      >
                        <Icon name="plus" className="size-3.5" /> New menu item
                      </button>
                    </div>
                  )}
                </div>
              </Field>
              <Field label="Mega-menu section" htmlFor={`placement-${index}-section`} required={Boolean(item?.has_mega_menu)}>
                {item?.has_mega_menu ? (
                  <Select
                    id={`placement-${index}-section`}
                    required
                    value={placement.megaSectionId}
                    onChange={(event) => {
                      if (event.target.value === "__new__") setNewSectionFor(index);
                      else {
                        setNewSectionFor(null);
                        update(index, { megaSectionId: event.target.value });
                      }
                    }}
                  >
                    <option value="">Choose a section</option>
                    {[...new Set(item.sections.map((section) => section.group_label))].map((group) => (
                      <optgroup key={group} label={group}>
                        {item.sections.filter((section) => section.group_label === group).map((section) => (
                          <option key={section.id} value={section.id}>{section.name}</option>
                        ))}
                      </optgroup>
                    ))}
                    <option value="__new__">+ New mega-menu section</option>
                  </Select>
                ) : item ? (
                  <Select id={`placement-${index}-section`} value="" disabled><option>This item has no mega-menu</option></Select>
                ) : (
                  <Select id={`placement-${index}-section`} value="" disabled><option>Choose a menu item first</option></Select>
                )}
              </Field>
            </div>

            {newItemFor === index && placement.navbar && (
              <form onSubmit={(event) => void addMenuItem(index, placement.navbar as NavbarKey, event)} className="grid gap-2 rounded-lg bg-fill-faint p-3 sm:grid-cols-3">
                <Input value={newItem.label} onChange={(event) => setNewItem({ ...newItem, label: event.target.value })} placeholder="Menu item name" required />
                <Input value={newItem.icon} onChange={(event) => setNewItem({ ...newItem, icon: event.target.value })} placeholder="Lucide icon name" required />
                <Input value={newItem.description} onChange={(event) => setNewItem({ ...newItem, description: event.target.value })} placeholder="Description" />
                <Button type="submit" size="sm">Create menu item</Button>
              </form>
            )}

            {newSectionFor === index && item && (
              <form onSubmit={(event) => void addSection(index, item, event)} className="grid gap-2 rounded-lg bg-fill-faint p-3 sm:grid-cols-4">
                <Input value={newSection.name} onChange={(event) => setNewSection({ ...newSection, name: event.target.value })} placeholder="Section name" required />
                <Input value={newSection.icon} onChange={(event) => setNewSection({ ...newSection, icon: event.target.value })} placeholder="Icon name" required />
                <Input value={newSection.groupLabel} onChange={(event) => setNewSection({ ...newSection, groupLabel: event.target.value })} placeholder="Group label" required />
                <Input value={newSection.description} onChange={(event) => setNewSection({ ...newSection, description: event.target.value })} placeholder="Description" />
                <Button type="submit" size="sm">Create section</Button>
              </form>
            )}
          </section>
        );
      })}
      {quickError && <p className="text-sm text-terracotta">{quickError}</p>}
      <Button type="button" variant="secondary" size="sm" disabled={value.length >= 12} onClick={() => onChange([...value, { ...EMPTY_PLACEMENT }])}>
        <Icon name="plus" className="size-3.5" /> Add another placement
      </Button>
    </div>
  );
}