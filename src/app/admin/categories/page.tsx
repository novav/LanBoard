// T5 - Categories management: CRUD + HTML5 drag & drop reorder.
// Client component — fetches /api/categories and calls /api/categories, /api/settings etc.
"use client";

import { FormEvent, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/app/components/I18nProvider";

type Category = {
  id: string;
  name: string;
  path: string;
  depth: number;
  parentPath: string | null;
  icon: string | null;
  sortOrder: number;
  isPrivate: boolean;
  linkCount: number;
  createdAt: string;
};

// Built-in icons the user can pick from.
const ICONS = [
  "🏠", "💻", "🐳", "📂", "🎬", "🎵", "📷", "📥", "☁️", "🔧",
  "📡", "🔐", "📝", "📊", "🎮", "🤖", "📦", "⚙️", "🌐", "📱",
];

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function CategoriesPage() {
  const { t } = useI18n();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add/edit modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState("");
  const [formIcon, setFormIcon] = useState("");
  const [formSortOrder, setFormSortOrder] = useState(0);
  const [formPrivate, setFormPrivate] = useState(false);
  const [formParentPath, setFormParentPath] = useState("");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  // Delete confirmation
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Batch selection & delete
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchDeleting, setBatchDeleting] = useState(false);
  const [confirmBatchDelete, setConfirmBatchDelete] = useState(false);

  // Drag & drop
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [categories.length]);

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
      prev.size === categories.length ? new Set() : new Set(categories.map((c) => c.id)),
    );
  }

  async function handleBatchDelete() {
    if (selectedIds.size === 0) return;
    setBatchDeleting(true);
    const res = await fetch("/api/categories/batch-delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: Array.from(selectedIds) }),
    });
    setBatchDeleting(false);
    setConfirmBatchDelete(false);
    if (!res.ok) {
      setError(t('admin.categories.batchDeleteFailed'));
      return;
    }
    setSelectedIds(new Set());
    await fetchCategories();
  }

  async function fetchCategories() {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/categories");
    const data = await res.json().catch(() => ({ error: "unknown" }));
    if (!res.ok) {
      setError(data.error ?? t('admin.categories.loadFailed'));
    } else {
      setCategories(data);
    }
    setLoading(false);
  }

  // ----- CRUD -----

  function openAdd() {
    setEditingId(null);
    setFormName("");
    setFormIcon(ICONS[0]);
    setFormSortOrder(categories.length);
    setFormPrivate(false);
    setFormParentPath("");
    setFormError("");
    setModalOpen(true);
  }

  function openEdit(category: Category) {
    setEditingId(category.id);
    setFormName(category.name);
    setFormIcon(category.icon ?? ICONS[0]);
    setFormSortOrder(category.sortOrder);
    setFormPrivate(category.isPrivate);
    setFormParentPath(category.parentPath ?? "");
    setFormError("");
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setFormError("");
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const name = formName.trim();
    if (!name) {
      setFormError(t('admin.categories.nameRequired'));
      return;
    }

    setSaving(true);
    setFormError("");

    const body = {
      name,
      icon: formIcon || null,
      isPrivate: formPrivate,
      parentPath: formParentPath || undefined,
    };
    const url = editingId ? `/api/categories/${encodeURIComponent(editingId)}` : "/api/categories";
    const method = editingId ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    setSaving(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setFormError(data.error ?? t('admin.categories.saveFailed'));
      return;
    }

    closeModal();
    await fetchCategories();
  }

  async function handleDelete() {
    if (!deletingId) return;
    const res = await fetch(`/api/categories/${encodeURIComponent(deletingId)}`, {
      method: "DELETE",
    });
    setDeletingId(null);
    if (!res.ok) {
      setError(t('admin.categories.deleteFailed'));
      return;
    }
    await fetchCategories();
  }

  // ----- Drag & drop -----

  function handleDragStart(index: number) {
    setDragIndex(index);
  }

  function handleDragOver(index: number, e: React.DragEvent) {
    e.preventDefault();
    if (dragIndex === null) return;
    setHoverIndex(index);
  }

  function handleDragEnd() {
    if (dragIndex === null || hoverIndex === null) {
      setDragIndex(null);
      setHoverIndex(null);
      return;
    }
    setCategories((prev) => {
      const next = [...prev];
      const [removed] = next.splice(dragIndex, 1);
      next.splice(hoverIndex, 0, removed);
      return next;
    });
    setDragIndex(null);
    setHoverIndex(null);
    // Persist the new order via the sort API.
    persistOrder();
  }

  async function persistOrder() {
    const body = { ids: categories.map((c) => c.id) };
    const res = await fetch("/api/categories/reorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      setError(t('admin.categories.saveOrderFailed'));
      await fetchCategories();
    }
  }

  // ----- Render -----

  const dropHoverClass = (index: number) =>
    dragIndex !== null && hoverIndex === index ? "border-brand-400 bg-brand-50 dark:bg-brand-900/20" : "";

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-end justify-between">
          <div>
            <div className="mb-2 skeleton h-7 w-36" />
            <div className="skeleton h-4 w-64" />
          </div>
          <div className="skeleton h-10 w-32" />
        </div>
        <div className="card overflow-hidden">
          <div className="skeleton h-14 w-full" />
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="flex items-center gap-4 border-t border-slate-200 p-4 dark:border-slate-700"
            >
              <div className="skeleton h-8 w-8 rounded" />
              <div className="flex-1 skeleton h-4 w-28" />
              <div className="skeleton h-4 w-16" />
              <div className="skeleton h-4 w-20" />
              <div className="skeleton h-4 w-10" />
              <div className="skeleton h-8 w-20" />
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
            {t('admin.categories.title')}
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {t('admin.categories.subtitle')}
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
          {t('admin.categories.addCategory')}
        </button>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 dark:bg-red-900/30 dark:border-red-800 dark:text-red-300">
          {error}
          <button className="ml-2 font-medium" onClick={() => setError(null)}>
            {t('admin.categories.dismiss')}
          </button>
        </div>
      )}

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center justify-between rounded-lg border border-brand-200 bg-brand-50 px-4 py-2.5 text-sm dark:border-brand-800 dark:bg-brand-900/20">
          <span className="font-medium text-brand-700 dark:text-brand-300">
            {selectedIds.size} {t('admin.categories.selected')}
          </span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="text-slate-600 hover:underline dark:text-slate-300"
              onClick={() => setSelectedIds(new Set())}
            >
              {t('admin.categories.clear')}
            </button>
            <button
              type="button"
              className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
              onClick={() => setConfirmBatchDelete(true)}
            >
              {t('admin.categories.deleteSelected')}
            </button>
          </div>
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="hidden grid-cols-8 gap-4 border-b border-slate-200 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 lg:grid dark:border-slate-700">
          <div className="col-span-1 flex items-center">
            <input
              type="checkbox"
              checked={categories.length > 0 && selectedIds.size === categories.length}
              onChange={toggleSelectAll}
              aria-label="Select all categories"
              className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            />
          </div>
          <div className="col-span-1">{t('admin.categories.icon')}</div>
          <div className="col-span-2">{t('admin.categories.namePath')}</div>
          <div>{t('admin.categories.links')}</div>
          <div>{t('admin.categories.private')}</div>
          <div>{t('admin.categories.order')}</div>
          <div className="text-right">{t('admin.categories.actions')}</div>
        </div>

        {categories.length === 0 ? (
          <div className="px-4 py-12 text-center text-sm text-slate-500">
            {t('admin.categories.noCategories')}
          </div>
        ) : (
          categories.map((c, index) => (
            <div
              key={c.id}
              draggable
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => handleDragOver(index, e)}
              onDragEnd={handleDragEnd}
              className={cn(
                "flex flex-wrap items-center gap-4 border-t border-slate-200 p-4 transition dark:border-slate-700 lg:grid lg:grid-cols-8",
                dropHoverClass(index),
                dragIndex === index && "opacity-50",
                selectedIds.has(c.id) && "bg-brand-50/50 dark:bg-brand-900/10",
              )}
            >
              <div className="col-span-1 flex items-center">
                <input
                  type="checkbox"
                  checked={selectedIds.has(c.id)}
                  onClick={(e) => e.stopPropagation()}
                  onChange={() => toggleSelect(c.id)}
                  aria-label={`Select ${c.name}`}
                  className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                />
              </div>
              <div className="flex h-8 w-8 items-center justify-center rounded bg-brand-50 text-lg dark:bg-brand-900/30">
                {c.icon ?? "📂"}
              </div>
              <div className="col-span-2">
                <div className="flex items-center" style={{ paddingLeft: `${c.depth * 16}px` }}>
                  {c.depth > 0 && <span className="text-slate-400 mr-2">└</span>}
                  <span className="font-medium text-slate-900 dark:text-white">{c.name}</span>
                </div>
                <div className="text-xs text-slate-400 mt-0.5" style={{ paddingLeft: `${c.depth * 16}px` }}>
                  {c.path}
                </div>
              </div>
              <div className="text-sm text-slate-500">{c.linkCount} links</div>
              <div className="text-sm">
                {c.isPrivate ? (
                  <span className="inline-flex rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                    Private
                  </span>
                ) : (
                  <span className="text-xs text-slate-400">{t('admin.categories.public')}</span>
                )}
              </div>
              <div className="text-sm tabular-nums text-slate-500">#{c.sortOrder}</div>
              <div className="flex w-full justify-end gap-2 lg:w-auto">
                <button
                  type="button"
                  className="rounded-lg px-2.5 py-1.5 text-sm font-medium text-brand-600 hover:bg-brand-50 dark:text-brand-400 dark:hover:bg-brand-900/30"
                  onClick={() => openEdit(c)}
                >
                  {t('admin.categories.edit')}
                </button>
                <button
                  type="button"
                  className="rounded-lg px-2.5 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/30"
                  onClick={() => setDeletingId(c.id)}
                >
                  {t('admin.categories.delete')}
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {categories.length > 0 && (
        <p className="text-xs text-slate-400">
          {t('admin.categories.dragToReorder')}
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
          className="relative z-10 w-full max-w-md rounded-2xl bg-white shadow-xl dark:bg-slate-800"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-700">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              {editingId ? t('admin.categories.editCategory') : t('admin.categories.addCategory')}
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
                {t('admin.categories.name')} <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. Media"
                required
                autoFocus
                className={cn(
                  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:bg-slate-900 dark:border-slate-600 dark:text-white",
                  formError && "border-red-400",
                )}
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                {t('admin.categories.parentCategory')}
              </label>
              <select
                value={formParentPath}
                onChange={(e) => setFormParentPath(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:bg-slate-900 dark:border-slate-600 dark:text-white"
              >
                <option value="">{t('admin.categories.noneRootLevel')}</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.path}>
                    {"  ".repeat(cat.depth)}
                    {cat.name} ({cat.path})
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-slate-500">
                {t('admin.categories.selectParent')}
              </p>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                {t('admin.categories.icon')}
              </label>
              <div className="grid grid-cols-10 gap-1.5">
                {ICONS.map((ic) => (
                  <button
                    key={ic}
                    type="button"
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded text-lg",
                      formIcon === ic
                        ? "bg-brand-100 ring-2 ring-brand-500 dark:bg-brand-900/40"
                        : "bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600",
                    )}
                    onClick={() => setFormIcon(ic)}
                  >
                    {ic}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                {t('admin.categories.private')}
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

            {formError && (
              <p className="text-sm text-red-600">{formError}</p>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                className="btn-secondary"
                onClick={closeModal}
              >
                {t('admin.categories.cancel')}
              </button>
              <button
                type="submit"
                disabled={saving}
                className="btn-primary disabled:opacity-50"
              >
                {saving ? t('admin.categories.saving') : editingId ? t('admin.categories.saveChanges') : t('admin.categories.create')}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* ----- Delete confirmation modal ----- */}
      <div
        className={cn("fixed inset-0 z-50 flex items-center justify-center p-4", !deletingId && "hidden")}
        onClick={() => setDeletingId(null)}
      >
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm" />
        <div
          className="relative z-10 w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-800"
          onClick={(e) => e.stopPropagation()}
        >
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{t('admin.categories.deleteCategory')}</h2>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            {t('admin.categories.deleteConfirm')}
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setDeletingId(null)}
            >
              {t('admin.categories.cancel')}
            </button>
            <button
              type="button"
              className="btn-primary bg-red-600 hover:bg-red-700 focus:ring-red-500"
              onClick={handleDelete}
            >
              {t('admin.categories.delete')}
            </button>
          </div>
        </div>
      </div>

      {/* ----- Batch delete confirmation modal ----- */}
      <div
        className={cn("fixed inset-0 z-50 flex items-center justify-center p-4", !confirmBatchDelete && "hidden")}
        onClick={() => setConfirmBatchDelete(false)}
      >
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm" />
        <div
          className="relative z-10 w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-800"
          onClick={(e) => e.stopPropagation()}
        >
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            {t('admin.categories.delete')} {selectedIds.size} {t('admin.categories.title').toLowerCase()}
          </h2>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            {t('admin.categories.deleteBatchConfirm')}
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setConfirmBatchDelete(false)}
            >
              {t('admin.categories.cancel')}
            </button>
            <button
              type="button"
              disabled={batchDeleting}
              className="btn-primary bg-red-600 hover:bg-red-700 focus:ring-red-500 disabled:opacity-50"
              onClick={handleBatchDelete}
            >
              {batchDeleting ? t('admin.categories.deleting') : t('admin.categories.delete')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
