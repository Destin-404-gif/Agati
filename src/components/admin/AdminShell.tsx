"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Icon } from "./icons";
import { cx } from "./ui";
import { NAV } from "@/lib/admin-nav";

const THEME_KEY = "agati-theme";

export interface ShellAlert {
  id: string;
  label: string;
  count: number;
  href: string;
}

export interface ShellStaff {
  id: number;
  /** The login handle, shown in the account menu alongside the email. */
  username: string;
  email: string;
  fullName: string | null;
  role: string | null;
  roleName: string | null;
  permissions: string[];
}

function initials(staff: ShellStaff): string {
  const source = staff.fullName || staff.email;
  return source
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

function canSee(staff: ShellStaff, permission?: string): boolean {
  if (!permission) return true;
  if (staff.role === "super-admin") return true;
  return staff.permissions.includes(permission);
}

export function AdminShell({
  staff,
  alerts,
  logo,
  children,
}: {
  staff: ShellStaff;
  alerts: ShellAlert[];
  logo: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [menuOpen, setMenuOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const [search, setSearch] = useState("");

  // Restore preferences after mount so server and client markup match. Reading
  // localStorage is an external-system read, and it has to happen after mount
  // or the server-rendered markup would not match.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const saved = localStorage.getItem("agati-sidebar");
    if (saved === "collapsed") setCollapsed(true);
    setTheme(document.documentElement.classList.contains("dark") ? "dark" : "light");
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Navigating away should close every transient panel. Adjusted during render
  // rather than in an effect, so the panels never repaint open for a frame.
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setDrawerOpen(false);
    setMenuOpen(false);
    setBellOpen(false);
  }

  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDrawerOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawerOpen]);

  const toggleTheme = useCallback(() => {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.classList.toggle("dark", next === "dark");
    localStorage.setItem(THEME_KEY, next);
    setTheme(next);
  }, [theme]);

  const toggleSidebar = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("agati-sidebar", next ? "collapsed" : "expanded");
      return next;
    });
  }, []);

  const signOut = useCallback(async () => {
    await fetch("/api/admin/auth/logout", { method: "POST" });
    router.replace("/admin/login");
    router.refresh();
  }, [router]);

  function onSearchSubmit(event: React.FormEvent) {
    event.preventDefault();
    const term = search.trim();
    router.push(
      term
        ? `/admin/products?q=${encodeURIComponent(term)}`
        : "/admin/products",
    );
  }

  const groups = NAV.map((group) => ({
    ...group,
    items: group.items.filter((item) => canSee(staff, item.permission)),
  })).filter((group) => group.items.length > 0);

  const totalAlerts = alerts.reduce((sum, a) => sum + a.count, 0);

  return (
    <div className="min-h-screen bg-bg text-fg">
      {/* ---------------------------------------------------------- sidebar */}
      <aside
        className={cx(
          "fixed inset-y-0 left-0 z-40 hidden shrink-0 flex-col border-r border-outline bg-surface backdrop-blur-sm transition-[width] duration-200 lg:flex",
          collapsed ? "w-18" : "w-64",
        )}
      >
        <div
          className={cx(
            "flex h-16 items-center border-b border-outline",
            collapsed ? "justify-center px-2" : "gap-2.5 px-5",
          )}
        >
          <Link href="/admin" className="flex items-center gap-2.5 overflow-hidden">
            <Image
              src={logo}
              alt="Agati"
              width={32}
              height={32}
              className="h-8 w-8 shrink-0 object-contain"
            />
            {!collapsed && (
              <span className="font-display text-base font-semibold tracking-tight whitespace-nowrap">
                Agati
              </span>
            )}
          </Link>
        </div>

        <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
          {groups.map((group) => (
            <div key={group.label}>
              {!collapsed && (
                  <p className="px-2.5 pb-2 text-[10px] font-semibold tracking-[0.14em] text-fg-faint uppercase">
                  {group.label}
                </p>
              )}
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const active = item.exact
                    ? pathname === item.href
                    : pathname.startsWith(item.href);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        title={collapsed ? item.label : undefined}
                        aria-current={active ? "page" : undefined}
                        className={cx(
                          "flex items-center gap-3 rounded-xl px-2.5 py-2.5 text-sm font-medium transition-colors",
                          collapsed && "justify-center px-0",
                          active
                            ? "bg-accent text-on-accent"
                            : "text-fg hover:bg-fill",
                        )}
                      >
                        <Icon name={item.icon} className="h-4.5 w-4.5 shrink-0" />
                        {!collapsed && <span className="truncate">{item.label}</span>}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="border-t border-outline p-3">
          <button
            type="button"
            onClick={toggleTheme}
            title={theme === "dark" ? "Light mode" : "Dark mode"}
            className={cx(
              "flex w-full cursor-pointer items-center gap-3 rounded-xl px-2.5 py-2.5 text-sm font-medium text-fg transition-colors hover:bg-fill",
              collapsed && "justify-center px-0",
            )}
          >
            <Icon name={theme === "dark" ? "sun" : "moon"} className="h-4.5 w-4.5" filled />
            {!collapsed && <span>{theme === "dark" ? "Light" : "Dark"} mode</span>}
          </button>
          <button
            type="button"
            onClick={toggleSidebar}
            title={collapsed ? "Expand" : "Collapse"}
            className={cx(
              "mt-0.5 flex w-full cursor-pointer items-center gap-3 rounded-xl px-2.5 py-2.5 text-sm font-medium text-fg transition-colors hover:bg-fill",
              collapsed && "justify-center px-0",
            )}
          >
            <Icon
              name="chevron"
              className={cx("h-4.5 w-4.5 transition-transform", collapsed && "rotate-180")}
            />
            {!collapsed && <span>Collapse</span>}
          </button>
        </div>
      </aside>

      {/* ------------------------------------------------------ mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setDrawerOpen(false)}
            className="absolute inset-0 cursor-pointer bg-espresso/50 backdrop-blur-sm"
          />
          <div className="absolute inset-y-0 left-0 flex w-72 flex-col border-r border-outline bg-bg">
            <div className="flex h-16 items-center justify-between border-b border-outline px-5">
              <span className="font-display text-base font-semibold">Agati</span>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="cursor-pointer p-1.5 text-fg-soft"
                aria-label="Close"
              >
                <Icon name="close" className="h-4 w-4" filled />
              </button>
            </div>
            <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
              {groups.map((group) => (
                <div key={group.label}>
                <p className="px-2.5 pb-2 text-[10px] font-semibold tracking-[0.14em] text-fg-faint uppercase">
                    {group.label}
                  </p>
                  <ul className="space-y-0.5">
                    {group.items.map((item) => {
                      const active = item.exact
                        ? pathname === item.href
                        : pathname.startsWith(item.href);
                      return (
                        <li key={item.href}>
                          <Link
                            href={item.href}
                            className={cx(
                              "flex items-center gap-3 rounded-xl px-2.5 py-2.5 text-sm font-medium",
                              active
                                ? "bg-accent text-on-accent"
                                : "text-fg",
                            )}
                          >
                            <Icon name={item.icon} className="h-4.5 w-4.5" />
                            {item.label}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </nav>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- main */}
      <div
        className={cx(
          "flex min-h-screen flex-col transition-[padding] duration-200",
          collapsed ? "lg:pl-18" : "lg:pl-64",
        )}
      >
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-outline bg-bg/85 px-4 backdrop-blur-md sm:px-6">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="cursor-pointer p-1.5 text-fg lg:hidden"
            aria-label="Open navigation"
          >
            <Icon name="menu" className="h-5 w-5" filled />
          </button>

          {/* Who is signed in, on the left of the bar. */}
          <div className="hidden min-w-0 shrink-0 sm:block">
            <p className="truncate text-sm leading-tight font-semibold text-fg">
              {staff.fullName || staff.email}
            </p>
            <p className="truncate text-xs leading-tight text-fg-muted">
              {staff.roleName || "No role"}
            </p>
          </div>

          <form onSubmit={onSearchSubmit} className="relative max-w-md flex-1">
            <Icon
              name="search"
              className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-fg-faint"
            />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products…"
              aria-label="Search the catalogue"
              className="w-full rounded-full border border-outline bg-field py-2 pr-4 pl-9 text-sm text-fg placeholder:text-fg-faint focus-visible:border-outline-strong focus-visible:outline-none"
            />
          </form>

          <div className="ml-auto flex items-center gap-1">
            <button
              type="button"
              onClick={toggleTheme}
              className="cursor-pointer rounded-full p-2 text-fg transition-colors hover:bg-fill"
              aria-label="Toggle theme"
            >
              <Icon name={theme === "dark" ? "sun" : "moon"} className="h-4.5 w-4.5" filled />
            </button>
            {/* notifications */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setBellOpen((v) => !v)}
                className="relative cursor-pointer rounded-full p-2 text-fg transition-colors hover:bg-fill"
                aria-label="Notifications"
                aria-expanded={bellOpen}
              >
                <Icon name="bell" className="h-4.5 w-4.5" />
                {totalAlerts > 0 && (
                  <span className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-terracotta px-1 text-[10px] font-bold text-white">
                    {totalAlerts > 99 ? "99+" : totalAlerts}
                  </span>
                )}
              </button>

              {bellOpen && (
                <div className="absolute right-0 z-50 mt-2 w-72 overflow-hidden rounded-2xl border border-outline bg-surface shadow-lift">
                  <p className="border-b border-outline px-4 py-3 text-xs font-semibold tracking-wide text-fg-soft uppercase">
                    Needs attention
                  </p>
                  {alerts.length === 0 ? (
                    <p className="px-4 py-6 text-center text-sm text-fg-muted">
                      Nothing waiting on you.
                    </p>
                  ) : (
                    <ul className="max-h-80 overflow-y-auto">
                      {alerts.map((alert) => (
                        <li key={alert.id}>
                          <Link
                            href={alert.href}
                            className="flex items-center justify-between gap-3 px-4 py-3 text-sm transition-colors hover:bg-fill"
                          >
                            <span className="text-fg">
                              {alert.label}
                            </span>
                            <span className="rounded-full bg-fill-strong px-2 py-0.5 text-xs font-semibold tabular-nums">
                              {alert.count}
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>

            {/* account */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                className="flex cursor-pointer items-center gap-2 rounded-full py-1 pr-3 pl-1 text-sm font-medium text-fg transition-colors hover:bg-fill"
                aria-label="Account"
                aria-expanded={menuOpen}
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-sage text-xs font-bold text-white">
                  {initials(staff)}
                </span>
                <span className="hidden sm:inline">Account</span>
              </button>

              {menuOpen && (
                <div className="absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-2xl border border-outline bg-surface shadow-lift">
                  <div className="flex items-center gap-3 border-b border-outline px-4 py-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sage text-xs font-bold text-white">
                      {initials(staff)}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">
                        {staff.fullName || staff.email}
                      </p>
                      {staff.username && (
                        <p className="truncate text-xs text-fg-muted">
                          @{staff.username}
                        </p>
                      )}
                      <p className="truncate text-xs text-fg-muted">
                        {staff.email}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-fg-muted">
                        {staff.roleName || "No role"}
                      </p>
                    </div>
                  </div>
                  <div className="py-1">
                    <Link
                      href="/admin/change-password"
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-fg transition-colors hover:bg-fill"
                    >
                      <Icon name="cog" className="h-4 w-4" />
                      Change password
                    </Link>
                    <Link
                      href="/"
                      className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-fg transition-colors hover:bg-fill"
                    >
                      <Icon name="external" className="h-4 w-4" />
                      View storefront
                    </Link>
                    <button
                      type="button"
                      onClick={signOut}
                      className="flex w-full cursor-pointer items-center gap-2.5 px-4 py-2.5 text-sm text-terracotta transition-colors hover:bg-terracotta/8"
                    >
                      <Icon name="logout" className="h-4 w-4" filled />
                      Sign out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 px-4 py-6 sm:px-6 sm:py-8">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}

export { NAV };
