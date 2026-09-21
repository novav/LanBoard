'use client';

import { useI18n } from './I18nProvider';

export function LanguageSwitcher() {
  const { locale, setLocale } = useI18n();

  return (
    <div className="flex items-center gap-2 rounded-lg bg-white/10 p-1 backdrop-blur-sm border border-white/20">
      <button
        onClick={() => setLocale('zh')}
        className={`px-3 py-1 rounded-md text-sm font-medium transition-all ${
          locale === 'zh'
            ? 'bg-white/20 text-white'
            : 'text-white/60 hover:text-white hover:bg-white/10'
        }`}
      >
        中文
      </button>
      <button
        onClick={() => setLocale('en')}
        className={`px-3 py-1 rounded-md text-sm font-medium transition-all ${
          locale === 'en'
            ? 'bg-white/20 text-white'
            : 'text-white/60 hover:text-white hover:bg-white/10'
        }`}
      >
        English
      </button>
    </div>
  );
}
