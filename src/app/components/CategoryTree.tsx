'use client';

import { useState } from 'react';
import { LinkCard } from './LinkCard';

type Link = {
  id: string;
  title: string;
  url: string;
  description: string | null;
  // icon is fetched client-side by LinkCard to avoid bloating HTML.
};

type Category = {
  id: string;
  name: string;
  path: string;
  icon: string | null;
  links: Link[];
};

const CATEGORY_ICONS = [
  '📁', '💾', '🎬', '🐳', '🛠️', '🌐',
  '📊', '🎮', '🔒', '📷', '🎵', '☁️',
];

export function CategoryTree({ categories }: { categories: Category[] }) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const toggleCollapse = (path: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  // Build hierarchy: categoriesByParent[parentPath] = child categories
  const categoriesByParent = new Map<string, Category[]>();
  const rootCategories: Category[] = [];

  for (const cat of categories) {
    const depth = (cat.path.match(/\//g) || []).length;
    if (depth === 0) {
      rootCategories.push(cat);
    } else {
      const lastSlash = cat.path.lastIndexOf('/');
      const parentPath = cat.path.substring(0, lastSlash);
      if (!categoriesByParent.has(parentPath)) {
        categoriesByParent.set(parentPath, []);
      }
      categoriesByParent.get(parentPath)!.push(cat);
    }
  }

  const renderCategory = (category: Category, depth: number, ci: number) => {
    const hasChildren = categoriesByParent.has(category.path);
    const isCollapsed = collapsed.has(category.path);
    const icon = category.icon ?? CATEGORY_ICONS[ci % CATEGORY_ICONS.length];
    const indent = depth * 16;

    return (
      <div key={category.id} style={{ marginLeft: `${indent}px` }}>
        <div className="mb-4 sm:mb-6 flex items-center gap-2 sm:gap-3 bg-white/10 backdrop-blur-sm rounded-2xl px-3 sm:px-5 py-2.5 sm:py-3 border border-white/20">
          {hasChildren && (
            <button
              onClick={() => toggleCollapse(category.path)}
              className="flex h-6 w-6 items-center justify-center rounded-lg hover:bg-white/20 transition-colors"
              aria-label={isCollapsed ? 'Expand' : 'Collapse'}
            >
              <svg
                className={`h-4 w-4 text-white/80 transition-transform ${isCollapsed ? '' : 'rotate-90'}`}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
          )}
          {depth > 0 && !hasChildren && (
            <span className="w-6" />
          )}
          <span className="text-2xl">{icon}</span>
          <h2 className="text-xl font-bold text-white drop-shadow-md">
            {category.name}
          </h2>
          <span className="ml-2 rounded-full bg-white/20 px-2 sm:px-3 py-0.5 text-xs font-medium text-white/90">
            {category.links.length}
          </span>
        </div>

        {!isCollapsed && category.links.length > 0 && (
          <div className="mb-8 sm:mb-12 grid gap-4 sm:gap-6 grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
            {category.links.map((link) => (
              <LinkCard
                key={link.id}
                id={link.id}
                title={link.title}
                url={link.url}
                description={link.description}
              />
            ))}
          </div>
        )}

        {!isCollapsed && hasChildren && (
          <div className="mb-8 sm:mb-12">
            {categoriesByParent.get(category.path)!.map((child, idx) =>
              renderCategory(child, depth + 1, idx)
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <section className="mx-auto max-w-6xl px-4 sm:px-6 pb-8 sm:pb-16">
      {rootCategories.map((cat, idx) => renderCategory(cat, 0, idx))}
    </section>
  );
}
