'use client';

import { useState, useEffect } from 'react';
import { SearchBar } from './SearchBar';
import { useI18n } from './I18nProvider';

export function HeroHeader({ siteName }: { siteName: string }) {
  const { t } = useI18n();
  const [time, setTime] = useState('');
  const [date, setDate] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }));
      setDate(now.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric', weekday: 'short' }));
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <section className="relative mx-auto max-w-6xl px-6 py-14 sm:py-20 lg:py-24">
      <div className="absolute top-8 right-8 flex items-center gap-3 bg-white/10 backdrop-blur-md rounded-2xl px-5 py-3 border border-white/20">
        <div className="text-right">
          <div className="text-2xl font-bold text-white">{time}</div>
          <div className="text-xs text-white/70">{date}</div>
        </div>
      </div>
      <h1 className="text-center text-5xl font-bold tracking-tight text-white drop-shadow-lg sm:text-6xl lg:text-7xl">
        {siteName}
      </h1>
      <p className="mx-auto mt-4 max-w-2xl text-center text-lg text-white/80">
        {t('home.defaultDescription')}
      </p>
      <div className="mt-8 flex justify-center">
        <SearchBar />
      </div>
    </section>
  );
}
