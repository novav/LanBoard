import './globals.css';

import type { Metadata, Viewport } from 'next';
import { ThemeToggle } from '@/app/components/ThemeToggle';
import { ThemeColorProvider } from '@/app/components/ThemeColorProvider';
import { LanguageSwitcher } from '@/app/components/LanguageSwitcher';
import { VersionDisplay } from '@/app/components/VersionDisplay';
import { I18nProvider } from '@/app/components/I18nProvider';

export const metadata: Metadata = {
  title: {
    default: 'NavBox',
    template: '%s | NavBox',
  },
  description: 'Your personal NAS navigation hub',
  applicationName: 'NavBox',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0f172a' },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon-32x32.png" sizes="32x32" type="image/png" />
        <link rel="icon" href="/favicon-16x16.png" sizes="16x16" type="image/png" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        {/*
          Anti-flicker script: read the stored theme preference before the
          page paints and apply the `dark` class to <html> immediately.
          Without this the page would briefly render in light mode then
          switch, producing a flash of unstyled/wrong-themed content.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function(){
                var root = document.documentElement;
                var stored = localStorage.getItem('theme');
                if (stored === 'dark') {
                  root.classList.add('dark');
                } else if (stored === 'light') {
                  root.classList.remove('dark');
                } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
                  root.classList.add('dark');
                }
              })();
            `,
          }}
        />
      </head>
      <body className="min-h-screen antialiased" suppressHydrationWarning>
        <I18nProvider>
          <ThemeColorProvider />
          <div className="relative flex min-h-screen flex-col">
            <header className="sticky top-0 z-50 border-b border-white/10 bg-white/10 backdrop-blur-md">
              <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6 sm:py-4">
                <a
                  href="/"
                  className="flex items-center gap-2 text-lg font-bold tracking-tight"
                >
                  <img src="/favicon.svg" alt="NavBox" className="h-7 w-7 sm:h-8 sm:w-8" />
                  <span className="text-white">NavBox</span>
                </a>
                <div className="flex items-center gap-2 sm:gap-4">
                  <a href="/" className="text-white/80 hover:text-white transition-colors duration-200 text-sm font-medium px-1 sm:px-0">
                    Home
                  </a>
                  <a href="/admin" className="text-white/80 hover:text-white transition-colors duration-200 text-sm font-medium px-1 sm:px-0">
                    Admin
                  </a>
                  <LanguageSwitcher />
                  <ThemeToggle />
                </div>
              </nav>
            </header>
            <main className="flex-1">{children}</main>
            <footer className="border-t border-white/10 bg-white/5 backdrop-blur-sm py-6">
              <VersionDisplay />
              <div className="text-center text-xs text-white/60 mt-2">
                NavBox &copy; 2026 — NAS Navigation Hub
              </div>
            </footer>
          </div>
        </I18nProvider>
      </body>
    </html>
  );
}
