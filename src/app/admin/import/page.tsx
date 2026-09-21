// T5 - Import / Export landing.
// Placeholder cards for T8 (browser bookmarks), T9 (JSON import/export), and
// T10 (Docker container scan). Each card points at a reserved route that those
// tasks will fill in later.
// T14 - Nginx site scan import entry card added to T5 import landing.
'use client';

import Link from "next/link";
import { cn } from "@/lib/utils";
import { useI18n } from "@/app/components/I18nProvider";

type ImportOption = {
  titleKey: string;
  descKey: string;
  icon: React.ReactNode;
  tag: string;
  href: string;
  status: "soon" | "wip";
};

export default function ImportPage() {
  const { t } = useI18n();

  const options: ImportOption[] = [
    {
      titleKey: "admin.import.browserBookmarks",
      descKey: "admin.import.browserBookmarksDesc",
      icon: (
        <svg className="h-7 w-7" viewBox="0 0 20 20" fill="currentColor">
          <path d="M5 4a2 2 0 012-2h6a2 2 0 012 2v14l-5-2.5L5 18V4z" />
        </svg>
      ),
      tag: "T8",
      href: "/admin/import/bookmarks",
      status: "wip",
    },
    {
      titleKey: "admin.import.jsonImportExport",
      descKey: "admin.import.jsonImportExportDesc",
      icon: (
        <svg className="h-7 w-7" viewBox="0 0 20 20" fill="currentColor">
          <path
            fillRule="evenodd"
            d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111 0V3a1 1 0 112 0v5a1 1 0 01-1 1H6a1 1 0 01-1-1V2zM3 9a1 1 0 000 2v4a3 3 0 006 0v-1a1 1 0 112 0v1a5 5 0 01-10 0V9zm11.293-2.293a1 1 0 011.414 0l2 2a1 1 0 010 1.414l-2 2a1 1 0 01-1.414-1.414l.586-.586H8.414l1.586 1.586a1 1 0 01-1.414 1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 111.414 1.414L8.414 8H16.586l-.586-.586a1 1 0 010-1.414z"
            clipRule="evenodd"
          />
        </svg>
      ),
      tag: "T9",
      href: "/admin/import/json",
      status: "wip",
    },
    {
      titleKey: "admin.import.dockerScan",
      descKey: "admin.import.dockerScanDesc",
      icon: (
        <svg className="h-7 w-7" viewBox="0 0 20 20" fill="currentColor">
          <path d="M10 2a8 8 0 100 16 8 8 0 000-16z" />
          <path
            fillRule="evenodd"
            d="M10 4a6 6 0 100 12 6 6 0 000-12zm-1 5a1 1 0 112 0v3a1 1 0 11-2 0V9zm1 6a1 1 0 100-2 1 1 0 000 2z"
            clipRule="evenodd"
          />
        </svg>
      ),
      tag: "T10",
      href: "/admin/import/docker",
      status: "wip",
    },
    {
      titleKey: "admin.import.nginxScan",
      descKey: "admin.import.nginxScanDesc",
      icon: (
        <svg className="h-7 w-7" viewBox="0 0 20 20" fill="currentColor">
          <path d="M10 2a8 8 0 100 16 8 8 0 000-16zm-2.5 3v4h1.5V5h2.5v4h1.5l.5-4h2v8h-2l-.5-4h-1.5v4H7.5V5H6z" />
        </svg>
      ),
      tag: "T14",
      href: "/admin/import/nginx",
      status: "wip",
    },
  ];
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          {t('admin.import.title')}
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {t('admin.import.subtitle')}
        </p>
      </div>

      <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        {options.map((opt) => (
          <article key={opt.titleKey} className="card">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-900/30 dark:text-brand-400">
                {opt.icon}
              </div>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500 dark:bg-slate-700 dark:text-slate-300">
                {opt.tag}
              </span>
            </div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">
              {t(opt.titleKey)}
            </h3>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              {t(opt.descKey)}
            </p>
            <div className="mt-5">
              <Link
                href={opt.href}
                className={cn(
                  "block w-full rounded-lg px-4 py-2.5 text-center text-sm font-medium no-underline",
                  opt.status === "wip"
                    ? "border border-brand-300 bg-brand-50 text-brand-700 hover:bg-brand-100 dark:border-brand-700 dark:bg-brand-900/30 dark:text-brand-300 dark:hover:bg-brand-900/50"
                    : "border border-slate-300 bg-slate-50 text-slate-400 cursor-default dark:border-slate-600 dark:bg-slate-900 dark:text-slate-500",
                )}
              >
                {opt.status === "wip" ? t('admin.import.goToScanner') : t('admin.import.comingSoon')}
              </Link>
              <p className="mt-2 text-xs text-slate-400">
                {t('admin.import.route')}: <code className="rounded bg-slate-100 px-1 dark:bg-slate-700">{opt.href}</code>
              </p>
            </div>
          </article>
        ))}
      </section>

      <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-400">
        {t('admin.import.configNote')}{" "}
        <a href="/admin/settings" className="font-medium text-brand-600 hover:underline dark:text-brand-400">
          {t('admin.import.configNoteLink')}
        </a>{" "}
        {t('admin.import.configNoteSuffix')}
      </div>
    </div>
  );
}
