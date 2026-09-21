// LinkCard.tsx — client component that records a click via the API before
// navigating the user to the link URL. Keeps navigation snappy: the click
// request fires in the background (fire-and-forget) and the navigation
// starts immediately.
//
// Icon is fetched on-demand from /api/links/{id}/icon via client-side fetch,
// NOT passed through RSC serialization. This avoids embedding potentially
// large base64 data-URLs (up to 1.5MB each) into the HTML payload, which
// was ballooning the home page from ~400KB to 3.6MB.
'use client';

import { cn } from '@/lib/utils';
import { useState, useEffect } from 'react';

export function LinkCard({
  id,
  title,
  url,
  description,
}: {
  id: string;
  title: string;
  url: string;
  description: string | null;
}) {
  const [icon, setIcon] = useState<string | null>(null);
  const [iconError, setIconError] = useState(false);

  // Fetch icon on-demand — lazy so it doesn't block initial render.
  useEffect(() => {
    let mounted = true;
    fetch(`/api/links/${id}/icon`)
      .then((res) => {
        if (!res.ok) return null;
        return res.json();
      })
      .then((data) => {
        if (!mounted) return;
        if (data?.icon) {
          setIcon(data.icon);
        }
      })
      .catch(() => {
        if (mounted) setIconError(true);
      });
    return () => {
      mounted = false;
    };
  }, [id]);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();

    // Fire-and-forget: record click without blocking navigation.
    fetch(`/api/links/${id}/click`, {
      method: 'POST',
    }).catch(() => {
      // ignore — don't block navigation on failure.
    });

    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <a
      href={url}
      onClick={handleClick}
      className={cn(
        'group relative flex flex-col rounded-2xl border border-white/20 bg-white/15 backdrop-blur-sm p-3 sm:p-5 shadow-lg transition-all duration-300 hover:shadow-2xl hover:-translate-y-1 hover:bg-white/25 dark:border-white/10 dark:bg-slate-900/30 dark:hover:bg-slate-900/40',
        'block',
      )}
    >
      <div className="flex items-center gap-2 sm:gap-3">
        <div className="relative flex h-10 w-10 sm:h-12 sm:w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white/20 backdrop-blur-sm border border-white/30">
          {icon && !iconError ? (
            <img
              src={icon}
              alt=""
              width={40}
              height={40}
              loading="lazy"
              decoding="async"
              className="h-7 w-7 sm:h-8 sm:w-8 rounded-xl object-contain"
              onError={() => setIconError(true)}
            />
          ) : (
            <span className="text-lg sm:text-xl font-semibold text-white">{title.charAt(0).toUpperCase()}</span>
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col justify-between">
          <h3 className="truncate text-base font-semibold text-white drop-shadow-sm">
            {title}
          </h3>
          <span className="mt-auto text-xs text-white/60 group-hover:text-white/80 transition-colors">
            {new URL(url).host}
          </span>
        </div>
      </div>
    </a>
  );
}
