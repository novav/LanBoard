'use client';

import { useI18n } from './I18nProvider';

export function VersionDisplay() {
  const { t } = useI18n();
  const version = process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0';

  return (
    <div className="text-center text-sm text-white/60">
      {t('common.version')} {version}
    </div>
  );
}
