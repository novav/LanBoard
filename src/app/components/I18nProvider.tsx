'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type Locale = 'zh' | 'en';
interface Messages {
  [key: string]: string | Messages;
}

interface I18nContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string) => string;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

const LOCALE_FILES: Record<Locale, string> = {
  zh: '/i18n/locales/zh.json',
  en: '/i18n/locales/en.json',
};

function deepGet(obj: Messages | null | undefined, key: string): string | undefined {
  const parts = key.split('.');
  let cur: any = obj;
  for (const p of parts) {
    cur = cur?.[p];
  }
  return typeof cur === 'string' ? cur : undefined;
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('zh');
  const [messages, setMessages] = useState<Messages | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem('locale') as Locale | null;
    const initial = (stored === 'zh' || stored === 'en') ? stored : 'zh';
    if (initial !== locale) {
      setLocaleState(initial);
    }
  }, [locale]);

  useEffect(() => {
    let mounted = true;
    fetch(LOCALE_FILES[locale])
      .then((res) => res.json())
      .then((m) => {
        if (!mounted) return;
        setMessages(m);
      })
      .catch(() => {
        if (!mounted) return;
        setMessages(null);
      });
    return () => {
      mounted = false;
    };
  }, [locale]);

  const setLocale = (newLocale: Locale) => {
    setLocaleState(newLocale);
    localStorage.setItem('locale', newLocale);
  };

  const t = (key: string): string => {
    return deepGet(messages, key) || key;
  };

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within I18nProvider');
  }
  return context;
}