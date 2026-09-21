'use client';

import { useI18n } from '@/app/components/I18nProvider';

interface OverviewClientProps {
  categoryCount: number;
  linkCount: number;
  userCount: number;
}

export default function OverviewClient({
  categoryCount,
  linkCount,
  userCount,
}: OverviewClientProps) {
  const { t } = useI18n();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          {t('admin.overview.title')}
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {t('admin.overview.subtitle')}
        </p>
      </div>

      <section className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon="📂"
          label={t('admin.overview.categories')}
          value={categoryCount}
          href="/admin/categories"
        />
        <StatCard
          icon="🔗"
          label={t('admin.overview.links')}
          value={linkCount}
          href="/admin/links"
        />
        <StatCard icon="🔐" label={t('admin.overview.adminUsers')} value={userCount} />
        <StatCard
          icon="🐳"
          label={t('admin.overview.imports')}
          value="—"
          href="/admin/import"
        />
      </section>

      <section className="card">
        <h2 className="mb-4 text-sm font-semibold text-slate-900 dark:text-white">
          {t('admin.overview.quickLinks')}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <QuickLink href="/admin/categories" label={t('admin.overview.manageCategories')} />
          <QuickLink href="/admin/links" label={t('admin.overview.manageLinks')} />
          <QuickLink href="/admin/import" label={t('admin.overview.importExport')} />
          <QuickLink href="/admin/settings" label={t('admin.overview.siteSettings')} />
        </div>
      </section>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  href,
}: {
  icon: string;
  label: string;
  value: number | string;
  href?: string;
}) {
  const wrap = href ? (
    <a href={href} className="block rounded-xl p-5">
      <Content icon={icon} label={label} value={value} />
    </a>
  ) : (
    <div className="rounded-xl p-5">
      <Content icon={icon} label={label} value={value} />
    </div>
  );

  return (
    <div className="card transition-all duration-200 hover:shadow-md">
      {wrap}
    </div>
  );
}

function Content({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: number | string;
}) {
  return (
    <>
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-lg dark:bg-brand-900/30">
        {icon}
      </div>
      <p className="mt-3 text-3xl font-bold text-slate-900 dark:text-white">{value}</p>
      <p className="mt-1 text-sm text-slate-500">{label}</p>
    </>
  );
}

function QuickLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      className="group flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-brand-50 hover:text-brand-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-brand-900/30 dark:hover:text-brand-300"
    >
      <span>{label}</span>
      <span className="text-slate-400 transition group-hover:text-brand-600 group-hover:translate-x-1">
        &rarr;
      </span>
    </a>
  );
}
