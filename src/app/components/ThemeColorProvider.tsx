'use client';

import { useEffect } from 'react';
import { useSettings } from './useSettings';

export function ThemeColorProvider() {
  const { data } = useSettings();

  useEffect(() => {
    if (!data) return;
    const themeColor = data.themeColor || 'indigo';
    document.documentElement.setAttribute('data-theme', themeColor);
  }, [data]);

  return null;
}