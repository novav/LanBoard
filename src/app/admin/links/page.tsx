// T5 - Links management: table view, search, filters (by category / isPrivate),
// CRUD, HTML5 drag & drop reorder, and favicon extraction call-point (T7).
"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import FaviconInput from "@/app/admin/components/FaviconInput";
import { useI18n } from "@/app/components/I18nProvider";

type Category = { id: string; name: string };
type Link = {
  id: string;
  title: string;
  url: string;
  description: string | null;
  icon: string | null;
  categoryId: string;
  category: { id: string; name: string };
  sortOrder: number;
  isPrivate: boolean;
  clickCount: number;
  createdAt: string;
};

export default function LinksPage() {
  const { t } = useI18n();
  const [links, setLinks] = useState<Link[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterPrivate, setFilterPrivate] = useState(""); // "" | "true" | "false"

  // Add/edit modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formTitle, setFormTitle] = useState("");
  const [formUrl, setFormUrl] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formCategory, setFormCategory] = useState("");
  const [formPrivate, setFormPrivate] = useState(false);
  const [formSortOrder, setFormSortOrder] = useState(0);
  const [formError, setFormError] = useState("");
  const [formIcon, setFormIcon] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Inline "new category" in the add/edit modal
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [newCatIcon, setNewCatIcon] = useState("");
  const [newCatPrivate, setNewCatPrivate] = useState(false);
  const [newCatSaving, setNewCatSaving] = useState(false);

  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Batch selection & delete
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchDeleting, setBatchDeleting] = useState(false);
  const [confirmBatchDelete, setConfirmBatchDelete] = useState(false);

  // Drag & drop (operate on the *filtered* list)
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  // Categories are fetched from /api/categories so even empty (link-less)
  // categories appear in the add-link dropdown.
  const sortedCategories = useMemo(
    () => [...categories].sort((a, b) => a.name.localeCompare(b.name)),
    [categories],
  );

  async function fetchData() {
    setLoading(true);
    setError(null);
    await Promise.all([
      (async () => {
        const r = await fetch("/api/links");
        const j = await r.json().catch(() => ({ error: "unknown" }));
        if (!r.ok) setError(j.error ?? t('admin.links.loadFailed'));
        else setLinks(j);
      })(),
      (async () => {
        const r = await fetch("/api/categories");
        const j = await r.json().catch(() => []);
        if (r.ok) setCategories(Array.isArray(j) ? j : []);
      })(),
    ]);
    setLoading(false);
  }

  function categoryName(id: string) {
    return links.find((l) => l.categoryId === id)?.category?.name ?? "—";
  }

  // Filtered list
  const filtered = links.filter((l) => {
    if (filterCategory && l.categoryId !== filterCategory) return false;
    if (filterPrivate === "true" && !l.isPrivate) return false;
    if (filterPrivate === "false" && l.isPrivate) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        l.title.toLowerCase().includes(q) ||
        l.url.toLowerCase().includes(q) ||
        categoryName(l.categoryId).toLowerCase().includes(q) ||
        (l.description ?? "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Clear selection whenever the filtered set changes shape (search/filter change or refetch)
  useEffect(() => {
    setSelectedIds(new Set());
  }, [search, filterCategory, filterPrivate, links]);

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelectedIds((prev) =>
      prev.size === filtered.length ? new Set() : new Set(filtered.map((l) => l.id)),
    );
  }

  async function handleBatchDelete() {
    if (selectedIds.size === 0) return;
    setBatchDeleting(true);
    const res = await fetch("/api/links/batch-delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: Array.from(selectedIds) }),
    });
    setBatchDeleting(false);
    setConfirmBatchDelete(false);
    if (!res.ok) {
      setError(t('admin.links.batchDeleteFailed'));
      return;
    }
    setSelectedIds(new Set());
    await fetchData();
  }

  // ----- CRUD -----

  function openAdd() {
    setEditingId(null);
    setFormTitle("");
    setFormUrl("");
    setFormDesc("");
    setFormCategory(sortedCategories[0]?.id ?? "");
    setFormPrivate(false);
    setFormIcon(null);
    setFormSortOrder(0);
    setFormError("");
    setShowNewCategory(false);
    setNewCatName("");
    setNewCatIcon("");
    setNewCatPrivate(false);
    setNewCatSaving(false);
    setModalOpen(true);
  }

  function openEdit(link: Link) {
    setEditingId(link.id);
    setFormTitle(link.title);
    setFormUrl(link.url);
    setFormDesc(link.description ?? "");
    setFormCategory(link.categoryId);
    setFormPrivate(link.isPrivate);
    setFormIcon(link.icon);
    setFormSortOrder(link.sortOrder);
    setFormError("");
    setShowNewCategory(false);
    setNewCatSaving(false);
    setNewCatName("");
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setFormError("");
    setShowNewCategory(false);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const title = formTitle.trim();
    const url = formUrl.trim();
    if (!title) {
      setFormError(t('admin.links.titleRequired'));
      return;
    }
    if (!url) {
      setFormError(t('admin.links.urlRequired'));
      return;
    }

    setSaving(true);
    setFormError("");

    const body = {
      title,
      url,
      description: formDesc.trim() || null,
      categoryId: formCategory,
      isPrivate: formPrivate,
      sortOrder: formSortOrder,
      ...(formIcon ? { icon: formIcon } : {}),
    };
    const urlPath = editingId ? `/api/links/${encodeURIComponent(editingId)}` : "/api/links";
    const method = editingId ? "PUT" : "POST";

    const res = await fetch(urlPath, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    setSaving(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setFormError(data.error ?? t('admin.links.saveFailed'));
      return;
    }

    closeModal();
    await fetchData();
  }

  async function handleDelete() {
    if (!deletingId) return;
    const res = await fetch(`/api/links/${encodeURIComponent(deletingId)}`, {
      method: "DELETE",
    });
    setDeletingId(null);
    if (!res.ok) {
      setError(t('admin.links.deleteFailed'));
      return;
    }
    await fetchData();
  }

  // ----- Drag & drop within filtered list -----
  function handleDragStart(index: number) {
    setDragIndex(index);
  }

  function handleDragOver(index: number, e: React.DragEvent) {
    e.preventDefault();
    if (dragIndex === null) return;
    setHoverIndex(index);
  }

  async function handleDragEnd() {
    if (dragIndex === null || hoverIndex === null) {
      setDragIndex(null);
      setHoverIndex(null);
      return;
    }

    const ids = filtered.map((l) => l.id);
    const [removed] = ids.splice(dragIndex, 1);
    ids.splice(hoverIndex, 0, removed);

    setDragIndex(null);
    setHoverIndex(null);

    const res = await fetch("/api/links/reorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    });

    if (!res.ok) {
      setError(t('admin.links.saveFailed'));
      await fetchData();
      return;
    }
    await fetchData();
  }

  // Helper: extract domain for display
  function domain(url: string) {
    try {
      return new URL(url).hostname.replace(/^www\./, "");
    } catch {
      return url;
    }
  }

  // ----- Render -----

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-end justify-between">
          <div>
            <div className="mb-2 skeleton h-7 w-28" />
            <div className="skeleton h-4 w-56" />
          </div>
          <div className="skeleton h-10 w-28" />
        </div>
        <div className="flex flex-wrap gap-3">
          <div className="skeleton h-10 w-64" />
          <div className="skeleton h-10 w-40" />
          <div className="skeleton h-10 w-32" />
        </div>
        <div className="card overflow-hidden">
          <div className="skeleton h-12 w-full" />
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="grid grid-cols-12 gap-3 border-t border-slate-200 p-4 dark:border-slate-700"
            >
              <div className="col-span-1 skeleton h-8 w-8 rounded" />
              <div className="col-span-2 skeleton h-4 w-24" />
              <div className="col-span-2 skeleton h-4 w-20" />
              <div className="col-span-1 skeleton h-4 w-14" />
              <div className="col-span-1 skeleton h-4 w-12" />
              <div className="col-span-1 skeleton h-4 w-10" />
              <div className="col-span-1 skeleton h-4 w-10" />
              <div className="col-span-1 skeleton h-8 w-20" />
              <div className="col-span-1 skeleton h-8 w-20" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            {t('admin.links.title')}
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {t('admin.links.subtitle')}
          </p>
        </div>
        <button type="button" className="btn-primary" onClick={openAdd}>
          <svg className="mr-1.5 h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
              clipRule="evenodd"
            />
          </svg>
          {t('admin.links.addLink')}
        </button>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 dark:bg-red-900/30 dark:border-red-800 dark:text-red-300">
          {error}
          <button className="ml-2 font-medium" onClick={() => setError(null)}>
            {t('admin.links.dismiss')}
          </button>
        </div>
      )}

      {/* Filters bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <input
            type="text"
            placeholder={t('admin.links.search')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 pl-9 text-sm shadow-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:bg-slate-900 dark:border-slate-600 dark:text-white"
          />
          <span className="pointer-events-none absolute left-3 top-2.5 text-slate-400">
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M8 4a4 4 0 100 8 4 4 0 000-8zM2.318 8.218a4.837 4.837 0 010-6.796l3.657 3.657A1.976 1.976 0 018 8h3.586l-1.293 1.293A1 1 0 019.414 10H8a1 1 0 01-.707-.293L3.707 5.985 2.318 7.384a4.837 4.837 0 010 6.796l-1.061-1.06a6.77 6.77 0 000-9.534L2.318 8.218z"
                clipRule="evenodd"
              />
            </svg>
          </span>
        </div>
        <select
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm outline-none transition focus:border-brand-500 dark:bg-slate-900 dark:border-slate-600 dark:text-white"
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
        >
          <option value="">{t('admin.links.allCategories')}</option>
          {sortedCategories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm outline-none transition focus:border-brand-500 dark:bg-slate-900 dark:border-slate-600 dark:text-white"
          value={filterPrivate}
          onChange={(e) => setFilterPrivate(e.target.value)}
        >
          <option value="">{t('admin.links.allVisibility')}</option>
          <option value="false">{t('admin.links.publicOnly')}</option>
          <option value="true">{t('admin.links.privateOnly')}</option>
        </select>
      </div>

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center justify-between rounded-lg border border-brand-200 bg-brand-50 px-4 py-2.5 text-sm dark:border-brand-800 dark:bg-brand-900/20">
          <span className="font-medium text-brand-700 dark:text-brand-300">
            {selectedIds.size} {t('admin.links.selected')}
          </span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="text-slate-600 hover:underline dark:text-slate-300"
              onClick={() => setSelectedIds(new Set())}
            >
              {t('admin.links.clear')}
            </button>
            <button
              type="button"
              className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
              onClick={() => setConfirmBatchDelete(true)}
            >
              {t('admin.links.deleteSelected')}
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="hidden grid-cols-12 gap-3 border-b border-slate-200 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 lg:grid dark:border-slate-700">
          <div className="col-span-1 flex items-center">
            <input
              type="checkbox"
              checked={filtered.length > 0 && selectedIds.size === filtered.length}
              onChange={toggleSelectAll}
              aria-label="Select all links"
              className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            />
          </div>
          <div className="col-span-2">{t('admin.links.linkTitle')}</div>
          <div className="col-span-2">{t('admin.links.url')}</div>
          <div className="col-span-1">{t('admin.links.category')}</div>
          <div>{t('admin.links.private')}</div>
          <div>{t('admin.links.clicks')}</div>
          <div>{t('admin.categories.order')}</div>
          <div className="col-span-1 text-right">{t('admin.links.actions')}</div>
        </div>

        {filtered.length === 0 ? (
          <div className="px-4 py-12 text-center text-sm text-slate-500">
            {links.length === 0
              ? t('admin.links.noLinks')
              : t('admin.links.showingResults').replace('{{count}}', '0')}
          </div>
        ) : (
          filtered.map((l, index) => (
            <div
              key={l.id}
              draggable
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => handleDragOver(index, e)}
              onDragEnd={handleDragEnd}
              className={cn(
                "grid grid-cols-2 gap-3 border-t border-slate-200 p-4 transition lg:grid-cols-12 dark:border-slate-700",
                dragIndex === index && "opacity-50",
                selectedIds.has(l.id) && "bg-brand-50/50 dark:bg-brand-900/10",
              )}
            >
              <div className="col-span-1 flex items-center">
                <input
                  type="checkbox"
                  checked={selectedIds.has(l.id)}
                  onClick={(e) => e.stopPropagation()}
                  onChange={() => toggleSelect(l.id)}
                  aria-label={`Select ${l.title}`}
                  className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                />
              </div>
              <div className="col-span-2 flex items-center gap-3 font-medium text-slate-900 dark:text-white">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center text-sm">
                  {l.icon ? (
                    <img src={l.icon} alt="" className="h-5 w-5 object-contain" />
                  ) : (
                    "🔗"
                  )}
                </span>
                <span className="truncate">{l.title}</span>
              </div>
              <div className="col-span-2 flex items-center text-xs text-slate-500">
                <span className="truncate" title={l.url}>
                  {domain(l.url)}
                </span>
              </div>
              <div className="flex items-center text-sm text-slate-500">
                {categoryName(l.categoryId)}
              </div>
              <div className="flex items-center">
                {l.isPrivate ? (
                  <span className="inline-flex rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                    {t('admin.links.private')}
                  </span>
                ) : (
                  <span className="text-xs text-slate-400">{t('admin.links.public')}</span>
                )}
              </div>
              <div className="flex items-center text-sm tabular-nums text-slate-500">
                {l.clickCount}
              </div>
              <div className="flex items-center text-sm tabular-nums text-slate-500">
                #{l.sortOrder}
              </div>
              <div className="col-span-1 flex items-center justify-end gap-2">
                <button
                  type="button"
                  className="rounded-lg px-2 py-1.5 text-sm font-medium text-brand-600 hover:bg-brand-50 dark:text-brand-400 dark:hover:bg-brand-900/30"
                  onClick={() => openEdit(l)}
                >
                  {t('admin.links.edit')}
                </button>
                <button
                  type="button"
                  className="rounded-lg px-2 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/30"
                  onClick={() => setDeletingId(l.id)}
                >
                  {t('admin.links.delete')}
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {filtered.length > 0 && (
        <p className="text-xs text-slate-400">
          {t('admin.links.showingResults').replace('{{count}}', String(filtered.length))}
        </p>
      )}

      {/* ----- Add/Edit modal ----- */}
      <div
        className={cn("fixed inset-0 z-50 flex items-center justify-center p-4", !modalOpen && "hidden")}
        onClick={closeModal}
        role="dialog"
        aria-modal="true"
      >
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm" />
        <div
          className="relative z-10 w-full max-w-lg rounded-2xl bg-white shadow-xl dark:bg-slate-800"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-700">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              {editingId ? t('admin.links.editLink') : t('admin.links.addLink')}
            </h2>
            <button
              type="button"
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700"
              onClick={closeModal}
            >
              <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                {t('admin.links.linkTitle')} <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="e.g. Plex"
                required
                autoFocus
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:bg-slate-900 dark:border-slate-600 dark:text-white"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                {t('admin.links.url')} <span className="text-red-500">*</span>
              </label>
              <input
                type="url"
                value={formUrl}
                onChange={(e) => setFormUrl(e.target.value)}
                placeholder="https://example.com"
                required
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:bg-slate-900 dark:border-slate-600 dark:text-white"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                {t('admin.links.description')}
              </label>
              <input
                type="text"
                value={formDesc}
                onChange={(e) => setFormDesc(e.target.value)}
                placeholder={t('admin.links.descriptionOptional')}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:bg-slate-900 dark:border-slate-600 dark:text-white"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    {t('admin.links.category')}
                  </label>
                  {!showNewCategory && (
                    <button
                      type="button"
                      className="text-xs font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400"
                      onClick={() => setShowNewCategory(true)}
                    >
                      {t('admin.links.newCategory')}
                    </button>
                  )}
                </div>
                {showNewCategory ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={newCatName}
                        onChange={(e) => setNewCatName(e.target.value)}
                        placeholder={t('admin.links.categoryName')}
                        className="flex-1 rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm outline-none transition focus:border-brand-500 dark:bg-slate-900 dark:border-slate-600 dark:text-white"
                      />
                      <input
                        type="text"
                        value={newCatIcon}
                        onChange={(e) => setNewCatIcon(e.target.value)}
                        placeholder={t('admin.links.categoryIcon')}
                        className="w-24 rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm outline-none transition focus:border-brand-500 dark:bg-slate-900 dark:border-slate-600 dark:text-white"
                      />
                      <label className="inline-flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
                        <input
                          type="checkbox"
                          checked={newCatPrivate}
                          onChange={(e) => setNewCatPrivate(e.target.checked)}
                          className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                        />
                        {t('admin.links.private')}
                      </label>
                      <button
                        type="button"
                        disabled={newCatSaving}
                        className="btn-primary disabled:opacity-50"
                        onClick={async (e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          // Automa extension may intercept React onChange, so read from DOM siblings as fallback.
                          // The button's parent is the .flex row containing: name input, icon input, private checkbox, button.
                          const parent = e.currentTarget.parentElement;
                          const inputs = parent?.querySelectorAll<HTMLInputElement>('input') ?? [];
                          console.log("[create-cat] inputs found:", inputs.length,
                            "values:", Array.from(inputs).map(i => i.value));
                          const name = (inputs[0]?.value ?? newCatName).trim();
                          const icon = (inputs[1]?.value ?? newCatIcon).trim();
                          const isPrivate = inputs[2]?.checked ?? newCatPrivate;
                          console.log("[create-cat] parsed: name=", name, "icon=", icon, "private=", isPrivate);
                          if (!name) {
                            setFormError(t('admin.links.nameRequired') || 'Category name is required');
                            return;
                          }
                          setNewCatSaving(true);
                          setFormError("");
                          try {
                            const r = await fetch("/api/categories", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                name,
                                icon: icon || null,
                                isPrivate,
                              }),
                            });
                            if (!r.ok) {
                              const j = await r.json().catch(() => ({}));
                              setNewCatSaving(false);
                              setFormError(j.error ?? t('admin.links.saveFailed'));
                              return;
                            }
                            const c = await r.json();
                            setFormCategory(c.id);
                            setShowNewCategory(false);
                            setNewCatSaving(false);
                            // Refresh categories list so the new one appears
                            const rc = await fetch("/api/categories");
                            const jc = await rc.json().catch(() => []);
                            if (rc.ok) setCategories(Array.isArray(jc) ? jc : []);
                          } catch {
                            setNewCatSaving(false);
                            setFormError(t('admin.links.networkError'));
                          }
                        }}
                      >
                        {newCatSaving ? t('admin.links.creatingCategory') : t('admin.links.createCategory')}
                      </button>
                    </div>
                    <p className="text-xs text-slate-400">
                      Creating a new category, then select from the list below.
                    </p>
                  </div>
                ) : (
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm shadow-sm outline-none transition focus:border-brand-500 dark:bg-slate-900 dark:border-slate-600 dark:text-white"
                  >
                    <option value="">{t('admin.links.selectCategory')}</option>
                    {sortedCategories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <div className="flex items-end">
                <div className="flex w-full items-center justify-between rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-600">
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    {t('admin.links.private')}
                  </span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={formPrivate}
                    className={cn(
                      "relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition",
                      formPrivate ? "bg-brand-600" : "bg-slate-200 dark:bg-slate-600",
                    )}
                    onClick={() => setFormPrivate((v) => !v)}
                  >
                    <span
                      className={cn(
                        "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition",
                        formPrivate ? "translate-x-5" : "translate-x-0",
                      )}
                    />
                  </button>
                </div>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                {t('admin.links.sortOrder') || t('admin.categories.order') || '权重'}
                <span className="ml-1 font-normal text-slate-400">
                  ({t('admin.links.sortHint') || '越大越靠前'})
                </span>
              </label>
              <input
                type="number"
                value={formSortOrder}
                onChange={(e) => setFormSortOrder(Number(e.target.value) || 0)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm shadow-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:bg-slate-900 dark:border-slate-600 dark:text-white"
              />
            </div>

            {/* Favicon input (T7) */}
            <FaviconInput value={formIcon} onIconChange={setFormIcon} linkUrl={formUrl || undefined} />

            {formError && <p className="text-sm text-red-600">{formError}</p>}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                className="btn-secondary"
                onClick={closeModal}
              >
                {t('admin.links.cancel')}
              </button>
              <button
                type="submit"
                disabled={saving}
                className="btn-primary disabled:opacity-50"
              >
                {saving ? t('admin.links.saving') : editingId ? t('admin.links.saveChanges') : t('admin.links.create')}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* ----- Delete confirmation ----- */}
      <div
        className={cn("fixed inset-0 z-50 flex items-center justify-center p-4", !deletingId && "hidden")}
        onClick={() => setDeletingId(null)}
      >
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm" />
        <div
          className="relative z-10 w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-800"
          onClick={(e) => e.stopPropagation()}
        >
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{t('admin.links.deleteLink')}</h2>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            {t('admin.links.deleteConfirm')}
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setDeletingId(null)}
            >
              {t('admin.links.cancel')}
            </button>
            <button
              type="button"
              className="btn-primary bg-red-600 hover:bg-red-700 focus:ring-red-500"
              onClick={handleDelete}
            >
              {t('admin.links.delete')}
            </button>
          </div>
        </div>
      </div>

      {/* ----- Batch delete confirmation ----- */}
      <div
        className={cn("fixed inset-0 z-50 flex items-center justify-center p-4", !confirmBatchDelete && "hidden")}
        onClick={() => setConfirmBatchDelete(false)}
      >
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm" />
        <div
          className="relative z-10 w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-800"
          onClick={(e) => e.stopPropagation()}
        >
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{t('admin.links.deleteLink')}</h2>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            {t('admin.links.deleteBatchConfirm').replace('{{count}}', String(selectedIds.size))}
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setConfirmBatchDelete(false)}
              disabled={batchDeleting}
            >
              {t('admin.links.cancel')}
            </button>
            <button
              type="button"
              className="btn-primary bg-red-600 hover:bg-red-700 focus:ring-red-500 disabled:opacity-50"
              onClick={handleBatchDelete}
              disabled={batchDeleting}
            >
              {batchDeleting ? t('admin.links.deleting') : t('admin.links.delete')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
