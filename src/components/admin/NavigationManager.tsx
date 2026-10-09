"use client";

import { useEffect, useMemo, useState } from "react";
import { uploadWithProgress } from "./ImageUploader";
import { ImageField } from "./overlays";
import { Alert, Button, Checkbox, Field, Input, Textarea } from "./ui";
import { Icon } from "./icons";
import type { MegaMenuSection, NavigationData, NavigationItem, NavbarKey } from "@/lib/navigation-data";

const NAVBARS: { key: NavbarKey; label: string }[] = [
  { key: "top_bar", label: "Top bar" },
  { key: "category_bar", label: "Category bar" },
];

const inputClass = "w-full rounded-xl border border-outline bg-field px-3 py-2 text-sm text-fg";

export function NavigationManager() {
  const [navigation, setNavigation] = useState<NavigationData>({ top_bar: [], category_bar: [] });
  const [navbar, setNavbar] = useState<NavbarKey>("top_bar");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [itemDraft, setItemDraft] = useState<NavigationItem | null>(null);
  const [sectionDraft, setSectionDraft] = useState<MegaMenuSection | null>(null);
  const [addingItem, setAddingItem] = useState(false);
  const [addingSection, setAddingSection] = useState(false);
  const [newItem, setNewItem] = useState({ label: "", icon: "Package", description: "" });
  const [newSection, setNewSection] = useState({ name: "", groupLabel: "Shop by type", description: "", icon: "Package" });
  const [iconProgress, setIconProgress] = useState(0);
  const [error, setError] = useState("");

  const items = navigation[navbar];
  const selectedItem = items.find((item) => item.id === selectedId) ?? null;

  useEffect(() => {
    void fetch("/api/admin/navigation", { cache: "no-store" })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Could not load navigation.");
        setNavigation(data);
        const first = data.top_bar[0] ?? data.category_bar[0];
        if (first) {
          setNavbar(first.navbar);
          setSelectedId(first.id);
          setItemDraft(first);
          setSectionDraft(first.sections[0] ?? null);
        }
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not load navigation."));
  }, []);

  useEffect(() => {
    if (selectedItem) {
      setItemDraft(selectedItem);
      setSectionDraft(selectedItem.sections[0] ?? null);
    } else {
      setItemDraft(null);
      setSectionDraft(null);
    }
  }, [selectedId, navigation, selectedItem]);

  const groupedSections = useMemo(() => {
    const groups = new Map<string, MegaMenuSection[]>();
    for (const section of selectedItem?.sections ?? []) {
      const group = groups.get(section.group_label) ?? [];
      group.push(section);
      groups.set(section.group_label, group);
    }
    return [...groups.entries()];
  }, [selectedItem]);

  function applyItem(item: NavigationItem) {
    setNavigation((current) => ({
      ...current,
      [item.navbar]: current[item.navbar].some((entry) => entry.id === item.id)
        ? current[item.navbar].map((entry) => entry.id === item.id ? { ...entry, ...item } : entry)
        : [...current[item.navbar], item].sort((a, b) => a.sort_order - b.sort_order),
    }));
    setSelectedId(item.id);
    setItemDraft(item);
  }

  async function saveItem() {
    if (!itemDraft) return;
    setError("");
    const res = await fetch(`/api/admin/navigation/${itemDraft.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        navbar: itemDraft.navbar,
        label: itemDraft.label,
        slug: itemDraft.slug,
        description: itemDraft.description ?? "",
        icon: itemDraft.icon,
        hasMegaMenu: itemDraft.has_mega_menu,
        sortOrder: itemDraft.sort_order,
        isActive: itemDraft.is_active,
      }),
    });
    const data = await res.json();
    if (!res.ok) return setError(data.error ?? "Could not save menu item.");
    applyItem({ ...data, sections: itemDraft.sections });
  }

  async function createItem(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    const res = await fetch("/api/admin/navigation", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        navbar,
        ...newItem,
        hasMegaMenu: navbar === "category_bar",
        sortOrder: items.length,
      }),
    });
    const data = await res.json();
    if (!res.ok) return setError(data.error ?? "Could not create menu item.");
    applyItem(data);
    setNewItem({ label: "", icon: "Package", description: "" });
    setAddingItem(false);
  }

  async function updateItemOrder(item: NavigationItem, direction: -1 | 1) {
    const index = items.findIndex((entry) => entry.id === item.id);
    const other = items[index + direction];
    if (!other) return;
    const reordered = [...items];
    [reordered[index], reordered[index + direction]] = [reordered[index + direction]!, reordered[index]!];
    const next = reordered.map((entry, sort_order) => ({ ...entry, sort_order }));
    setNavigation((current) => ({ ...current, [navbar]: next }));
    await Promise.all([item, other].map((entry) => fetch(`/api/admin/navigation/${entry.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        navbar,
        label: entry.label,
        slug: entry.slug,
        description: entry.description ?? "",
        icon: entry.icon,
        hasMegaMenu: entry.has_mega_menu,
        sortOrder: next.find((candidate) => candidate.id === entry.id)?.sort_order ?? entry.sort_order,
        isActive: entry.is_active,
      }),
    })));
  }

  async function updateSectionOrder(section: MegaMenuSection, direction: -1 | 1) {
    if (!selectedItem) return;
    const current = [...selectedItem.sections].sort((a, b) => a.sort_order - b.sort_order);
    const index = current.findIndex((entry) => entry.id === section.id);
    const target = index + direction;
    if (target < 0 || target >= current.length) return;
    [current[index], current[target]] = [current[target]!, current[index]!];
    const reordered = current.map((entry, sort_order) => ({ ...entry, sort_order }));
    const nextItem = { ...selectedItem, sections: reordered };
    applyItem(nextItem);
    if (sectionDraft) setSectionDraft(reordered.find((entry) => entry.id === sectionDraft.id) ?? sectionDraft);
    await Promise.all(reordered.map(async (entry) => {
      const res = await fetch(`/api/admin/navigation/sections/${entry.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          groupLabel: entry.group_label,
          name: entry.name,
          slug: entry.slug,
          description: entry.description ?? "",
          icon: entry.icon,
          image: entry.image ?? "",
          sortOrder: entry.sort_order,
          isActive: entry.is_active,
        }),
      });
      if (!res.ok) setError("Could not save section order.");
    }));
  }

  async function deleteItem(item: NavigationItem) {
    if (!window.confirm(`Delete ${item.label} and its sections?`)) return;
    const res = await fetch(`/api/admin/navigation/${item.id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json();
      return setError(data.error ?? "Could not delete menu item.");
    }
    setNavigation((current) => ({ ...current, [navbar]: current[navbar].filter((entry) => entry.id !== item.id) }));
    const next = items.find((entry) => entry.id !== item.id);
    setSelectedId(next?.id ?? null);
  }

  async function createSection(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedItem) return;
    setError("");
    const res = await fetch("/api/admin/navigation/sections", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ navItemId: selectedItem.id, ...newSection, sortOrder: selectedItem.sections.length }),
    });
    const data = await res.json();
    if (!res.ok) return setError(data.error ?? "Could not create section.");
    const nextItem = { ...selectedItem, has_mega_menu: true, sections: [...selectedItem.sections, data] };
    applyItem(nextItem);
    setSectionDraft(data);
    setNewSection({ name: "", groupLabel: "Shop by type", description: "", icon: "Package" });
    setAddingSection(false);
  }

  async function saveSection() {
    if (!sectionDraft) return;
    setError("");
    const res = await fetch(`/api/admin/navigation/sections/${sectionDraft.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        groupLabel: sectionDraft.group_label,
        name: sectionDraft.name,
        slug: sectionDraft.slug,
        description: sectionDraft.description ?? "",
        icon: sectionDraft.icon,
        image: sectionDraft.image ?? "",
        sortOrder: sectionDraft.sort_order,
        isActive: sectionDraft.is_active,
      }),
    });
    const data = await res.json();
    if (!res.ok) return setError(data.error ?? "Could not save section.");
    const owner = navigation[navbar].find((item) => item.id === data.nav_item_id);
    if (owner) applyItem({ ...owner, sections: owner.sections.map((section) => section.id === data.id ? data : section) });
    setSectionDraft(data);
  }

  async function deleteSection(section: MegaMenuSection) {
    const res = await fetch(`/api/admin/navigation/sections/${section.id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json();
      return setError(data.error ?? "Could not delete section.");
    }
    if (!selectedItem) return;
    const sections = selectedItem.sections.filter((entry) => entry.id !== section.id);
    applyItem({ ...selectedItem, sections, has_mega_menu: sections.length > 0 || selectedItem.has_mega_menu });
    setSectionDraft(sections[0] ?? null);
  }

  async function uploadIcon(file: File) {
    setIconProgress(0);
    const result = await uploadWithProgress(file, "/api/admin/uploads", { onProgress: setIconProgress });
    if (sectionDraft && result.url) setSectionDraft({ ...sectionDraft, icon: result.url });
  }

  return (
    <div className="space-y-5">
      {error && <Alert tone="error">{error}</Alert>}
      <div className="flex gap-2 border-b border-outline">
        {NAVBARS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => {
              setNavbar(tab.key);
              setSelectedId(navigation[tab.key][0]?.id ?? null);
              setAddingItem(false);
            }}
            className={`border-b-2 px-4 py-2 text-sm font-semibold ${navbar === tab.key ? "border-terracotta text-fg" : "border-transparent text-fg-muted"}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(220px,0.8fr)_minmax(0,2fr)]">
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">{navbar === "top_bar" ? "Top bar items" : "Category bar items"}</h2>
            <Button size="sm" variant="secondary" onClick={() => setAddingItem((value) => !value)}>
              <Icon name="plus" className="size-3.5" /> New item
            </Button>
          </div>
          {addingItem && (
            <form onSubmit={createItem} className="space-y-2 rounded-xl border border-outline p-3">
              <Input value={newItem.label} onChange={(event) => setNewItem({ ...newItem, label: event.target.value })} placeholder="Name" required />
              <Input value={newItem.icon} onChange={(event) => setNewItem({ ...newItem, icon: event.target.value })} placeholder="Lucide icon name" required />
              <Textarea value={newItem.description} onChange={(event) => setNewItem({ ...newItem, description: event.target.value })} placeholder="Description" rows={2} />
              <Button type="submit" size="sm">Create item</Button>
            </form>
          )}
          <ol className="space-y-1">
            {items.map((item, index) => (
              <li key={item.id} className={`flex items-center gap-1 rounded-xl px-2 py-1 ${selectedId === item.id ? "bg-fill" : ""}`}>
                <button type="button" onClick={() => setSelectedId(item.id)} className="min-w-0 flex-1 truncate px-2 py-2 text-left text-sm font-medium">
                  {item.label}{!item.is_active && <span className="ml-2 text-xs text-fg-muted">Hidden</span>}
                </button>
                <button type="button" aria-label="Move up" disabled={index === 0} onClick={() => void updateItemOrder(item, -1)} className="p-1 text-fg-muted disabled:opacity-30"><Icon name="chevron" className="size-3 rotate-90" /></button>
                <button type="button" aria-label="Move down" disabled={index === items.length - 1} onClick={() => void updateItemOrder(item, 1)} className="p-1 text-fg-muted disabled:opacity-30"><Icon name="chevron" className="size-3 -rotate-90" /></button>
              </li>
            ))}
          </ol>
        </section>

        {itemDraft ? (
          <section className="min-w-0 space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Menu item name"><Input value={itemDraft.label} onChange={(event) => setItemDraft({ ...itemDraft, label: event.target.value })} /></Field>
              <Field label="URL slug"><Input value={itemDraft.slug} onChange={(event) => setItemDraft({ ...itemDraft, slug: event.target.value })} /></Field>
              <Field label="Icon name"><Input value={itemDraft.icon} onChange={(event) => setItemDraft({ ...itemDraft, icon: event.target.value })} /></Field>
              <Field label="Description"><Input value={itemDraft.description ?? ""} onChange={(event) => setItemDraft({ ...itemDraft, description: event.target.value })} /></Field>
            </div>
            <div className="flex flex-wrap items-center gap-5">
              <Checkbox label="Has mega-menu" checked={itemDraft.has_mega_menu} onChange={(event) => setItemDraft({ ...itemDraft, has_mega_menu: event.target.checked })} />
              <Checkbox label="Visible" checked={itemDraft.is_active} onChange={(event) => setItemDraft({ ...itemDraft, is_active: event.target.checked })} />
              <Button size="sm" onClick={() => void saveItem()}>Save item</Button>
              <Button size="sm" variant="danger" onClick={() => void deleteItem(itemDraft)}>Delete item</Button>
            </div>

            <div className="border-t border-outline pt-5">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-semibold">Mega-menu sections</h3>
                <Button size="sm" variant="secondary" onClick={() => setAddingSection((value) => !value)}><Icon name="plus" className="size-3.5" /> New section</Button>
              </div>
              {addingSection && (
                <form onSubmit={createSection} className="mb-4 grid gap-2 rounded-xl border border-outline p-3 sm:grid-cols-2">
                  <Input value={newSection.name} onChange={(event) => setNewSection({ ...newSection, name: event.target.value })} placeholder="Section name" required />
                  <Input value={newSection.groupLabel} onChange={(event) => setNewSection({ ...newSection, groupLabel: event.target.value })} placeholder="Group label" required />
                  <Input value={newSection.icon} onChange={(event) => setNewSection({ ...newSection, icon: event.target.value })} placeholder="Icon name" required />
                  <Input value={newSection.description} onChange={(event) => setNewSection({ ...newSection, description: event.target.value })} placeholder="One-line description" />
                  <Button type="submit" size="sm">Create section</Button>
                </form>
              )}
              <div className="grid gap-5 xl:grid-cols-[220px_minmax(0,1fr)]">
                <div className="space-y-3">
                  {groupedSections.map(([group, sections]) => (
                    <div key={group}>
                      <p className="mb-1 text-[10px] font-semibold uppercase text-fg-muted">{group}</p>
                      {sections.map((section) => (
                        <div key={section.id} className="flex items-center gap-1">
                          <button type="button" onClick={() => setSectionDraft(section)} className={`min-w-0 flex-1 truncate rounded-lg px-2 py-1.5 text-left text-sm ${sectionDraft?.id === section.id ? "bg-fill font-semibold" : "text-fg-soft"}`}>
                            {section.name}{!section.is_active && " · Hidden"}
                          </button>
                          <button type="button" aria-label={`Move ${section.name} up`} onClick={() => void updateSectionOrder(section, -1)} className="p-1 text-fg-muted"><Icon name="chevron" className="size-3 rotate-90" /></button>
                          <button type="button" aria-label={`Move ${section.name} down`} onClick={() => void updateSectionOrder(section, 1)} className="p-1 text-fg-muted"><Icon name="chevron" className="size-3 -rotate-90" /></button>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
                {sectionDraft ? (
                  <div className="space-y-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="Section name"><Input value={sectionDraft.name} onChange={(event) => setSectionDraft({ ...sectionDraft, name: event.target.value })} /></Field>
                      <Field label="Group label"><Input value={sectionDraft.group_label} onChange={(event) => setSectionDraft({ ...sectionDraft, group_label: event.target.value })} /></Field>
                      <Field label="URL slug"><Input value={sectionDraft.slug} onChange={(event) => setSectionDraft({ ...sectionDraft, slug: event.target.value })} /></Field>
                      <Field label="Description"><Input value={sectionDraft.description ?? ""} onChange={(event) => setSectionDraft({ ...sectionDraft, description: event.target.value })} /></Field>
                      <Field label="Lucide icon name"><Input value={sectionDraft.icon.startsWith("/") ? "" : sectionDraft.icon} onChange={(event) => setSectionDraft({ ...sectionDraft, icon: event.target.value })} /></Field>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="Icon image upload">
                        <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadIcon(file).catch((err: unknown) => setError(err instanceof Error ? err.message : "Icon upload failed.")); }} className={inputClass} />
                        {iconProgress > 0 && iconProgress < 100 && <progress className="mt-1 w-full" value={iconProgress} max={100} />}
                      </Field>
                      <ImageField value={sectionDraft.image ?? ""} onChange={(image) => setSectionDraft({ ...sectionDraft, image })} label="Section image" hint="Upload an image or enter a URL." />
                    </div>
                    <div className="flex flex-wrap items-center gap-4">
                      <Checkbox label="Visible" checked={sectionDraft.is_active} onChange={(event) => setSectionDraft({ ...sectionDraft, is_active: event.target.checked })} />
                      <Button size="sm" onClick={() => void saveSection()}>Save section</Button>
                      <Button size="sm" variant="danger" onClick={() => void deleteSection(sectionDraft)}>Delete section</Button>
                    </div>
                  </div>
                ) : <p className="text-sm text-fg-muted">Select a section to edit.</p>}
              </div>
            </div>
          </section>
        ) : <div className="flex min-h-48 items-center justify-center text-sm text-fg-muted">Add or select a menu item.</div>}
      </div>
    </div>
  );
}