// Sidebar navigation for the admin area — client component (toggle state).
// Uses usePathname to highlight the active item.
"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useI18n } from "@/app/components/I18nProvider";

const navItems = [
  { href: "/admin", labelKey: "admin.sidebar.overview", icon: "home" },
  { href: "/admin/categories", labelKey: "admin.sidebar.categories", icon: "folder" },
  { href: "/admin/links", labelKey: "admin.sidebar.links", icon: "link" },
  { href: "/admin/import", labelKey: "admin.sidebar.import", icon: "download" },
  { href: "/admin/settings", labelKey: "admin.sidebar.settings", icon: "settings" },
] as const;

export default function AdminSidebar() {
  const { t } = useI18n();
  const [collapsed, setCollapsed] = useState(true);
  const pathname = usePathname();

  // Active item: /admin is exact; others are prefix-matched.
  const activeItem =
    pathname === "/admin" ? "/admin" : navItems.find((item) => pathname.startsWith(item.href))?.href ?? null;

  return (
    <>
      {/* Mobile toggle button — visible only when sidebar is hidden */}
      <button
        type="button"
        className="fixed left-3 top-3 z-50 rounded-lg border border-slate-200 bg-white p-2 text-slate-600 shadow-sm hover:bg-slate-50 md:hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
        onClick={() => setCollapsed(false)}
        aria-label="Open sidebar"
      >
        <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path
            fillRule="evenodd"
            d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {/* Overlay on mobile when sidebar is open */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm md:hidden transition-opacity",
          collapsed ? "pointer-events-none opacity-0" : "pointer-events-auto opacity-100",
        )}
        onClick={() => setCollapsed(true)}
      />

      <aside
        className={cn(
          "fixed top-0 left-0 z-40 h-screen w-64 border-r border-slate-200 bg-white transition-transform duration-200 dark:border-slate-700 dark:bg-slate-800",
          collapsed ? "-translate-x-full" : "translate-x-0",
        )}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between px-5 py-4">
            <a href="/admin" className="flex items-center gap-2">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">
                L
              </span>
              <span className="gradient-text text-lg font-bold">Admin</span>
            </a>
            <button
              type="button"
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 md:hidden dark:hover:bg-slate-700"
              onClick={() => setCollapsed(true)}
              aria-label="Close sidebar"
            >
              <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </div>

          <nav className="flex-1 space-y-1 px-3">
            {navItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className={cn(
                  "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition",
                  activeItem === item.href
                    ? "bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white",
                )}
              >
                <span
                  className={cn(
                    "text-slate-400 transition group-hover:text-brand-500",
                    activeItem === item.href && "text-brand-600 dark:text-brand-400",
                  )}
                >
                  <NavIcon kind={item.icon} />
                </span>
                <span>{t(item.labelKey)}</span>
              </a>
            ))}
          </nav>

          <div className="border-t border-slate-200 px-4 py-4 text-xs text-slate-400 dark:border-slate-700">
            NavBox Admin &middot; v0.1.0
          </div>
        </div>
      </aside>
    </>
  );
}

// ---------------------------------------------------------------------------
// Icon render — inline SVG, no external deps.
// ---------------------------------------------------------------------------

function NavIcon({ kind }: { kind: string }) {
  const props = {
    className: "h-5 w-5",
    viewBox: "0 0 20 20",
    fill: "currentColor",
  };

  switch (kind) {
    case "home":
      return (
        <svg {...props}>
          <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
        </svg>
      );
    case "folder":
      return (
        <svg {...props}>
          <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
        </svg>
      );
    case "link":
      return (
        <svg {...props}>
          <path fillRule="evenodd" d="M12.586 4.586a2 2 0 112.828 2.828l-3 3a2 2 0 01-2.828 0 1 1 0 00-1.414 1.414 4 4 0 005.656 0l3-3a4 4 0 00-5.656-5.656l-1.5 1.5a1 1 0 101.414 1.414l1.5-1.5zm-5 5a2 2 0 010 2.828l-3 3a2 2 0 11-2.828-2.828l3-3a2 2 0 012.828 0z" clipRule="evenodd" />
        </svg>
      );
    case "download":
      return (
        <svg {...props}>
          <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      );
    case "settings":
      return (
        <svg {...props}>
          <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.532 1.532 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.532 1.532 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
        </svg>
      );
    default:
      return null;
  }
}
