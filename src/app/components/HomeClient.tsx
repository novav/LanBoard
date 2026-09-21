'use client';

import { useI18n } from '@/app/components/I18nProvider';

interface HomeClientProps {
  children: React.ReactNode;
  siteName: string;
  defaultDescription: string;
}

export function HomeClient({ children, siteName, defaultDescription }: HomeClientProps) {
  const { t } = useI18n();

  return <>{children}</>;
}

export function EmptyState() {
  const { t } = useI18n();

  return (
    <section className="mx-auto flex max-w-4xl flex-1 flex-col items-center justify-center px-6 py-16">
      <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-brand-50 dark:bg-brand-900/30">
        <span className="text-4xl">🏠</span>
      </div>
      <h2 className="text-center text-2xl font-bold text-slate-900 dark:text-slate-100">
        {t('home.emptyTitle')}
      </h2>
      <p className="mt-3 max-w-md text-center text-slate-500 dark:text-slate-400">
        {t('home.emptyDescription')}
      </p>
      <a href="/admin" className="mt-6 inline-block">
        <span className="btn-primary">
          <span>{t('home.goToAdmin')}</span>
          <svg
            className="ml-2 h-4 w-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </span>
      </a>
    </section>
  );
}
