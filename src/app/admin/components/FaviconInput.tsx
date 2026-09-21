// T7 - Reusable 'use client' FaviconInput for link add/edit forms.
// Shows an icon preview and provides three ways to set it:
//   1. Auto-fetch from the link URL (/api/favicons/extract)
//   2. Manual file upload (/api/favicons/upload)
//   3. Direct icon URL paste (/api/favicons/convert)
// Writes the resulting base64 data URL back to the parent via onIconChange.

"use client";

import { ChangeEvent, SyntheticEvent, useCallback, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface FaviconInputProps {
  /** Current icon base64 data URL (or null). */
  value: string | null;
  /** Callback when a new icon is selected/fetched. */
  onIconChange: (icon: string) => void;
  /** Link URL to use for auto-fetch. Optional. */
  linkUrl?: string;
}

const PLACEHOLDER = (
  <svg
    className="h-5 w-5 text-slate-400"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" stroke="none" />
    <path d="M21 15l-5-5L5 21" />
  </svg>
);

export default function FaviconInput({
  value,
  onIconChange,
  linkUrl,
}: FaviconInputProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const urlInputRef = useRef<HTMLInputElement | null>(null);

  const [fetching, setFetching] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [converting, setConverting] = useState(false);
  const [error, setError] = useState("");
  const [urlValue, setUrlValue] = useState("");

  const clearError = useCallback(() => setError(""), []);

  async function handleFetch() {
    if (!linkUrl) return;
    setError("");
    setFetching(true);
    try {
      const res = await fetch(`/api/favicons/extract?url=${encodeURIComponent(linkUrl)}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Favicon fetch failed.");
        return;
      }
      const json = await res.json();
      if (json.dataUrl) onIconChange(json.dataUrl);
      else setError("Favicon fetch failed.");
    } catch {
      setError("Network error while fetching favicon.");
    } finally {
      setFetching(false);
    }
  }

  function handleUploadClick() {
    fileInputRef.current?.click();
  }

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset so the same file can be selected again.
    if (fileInputRef.current) fileInputRef.current.value = "";
    setError("");
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/favicons/upload", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Upload failed.");
        return;
      }
      const json = await res.json();
      if (json.dataUrl) onIconChange(json.dataUrl);
      else setError("Upload failed.");
    } catch {
      setError("Network error while uploading.");
    } finally {
      setUploading(false);
    }
  }

  async function handleConvert(e: SyntheticEvent) {
    e.preventDefault();
    const url = urlValue.trim();
    if (!url) return;
    setError("");
    setConverting(true);
    try {
      const res = await fetch("/api/favicons/convert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ iconUrl: url }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Conversion failed.");
        return;
      }
      const json = await res.json();
      if (json.dataUrl) onIconChange(json.dataUrl);
      else setError("Conversion failed.");
    } catch {
      setError("Network error during conversion.");
    } finally {
      setConverting(false);
    }
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Icon preview */}
        <div
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-white shadow-sm dark:bg-slate-800",
            value && "p-1",
          )}
        >
          {value ? (
            <img src={value} alt="icon" className="h-9 w-9 object-contain" />
          ) : (
            PLACEHOLDER
          )}
        </div>

        {/* Controls */}
        <div className="flex flex-1 flex-wrap items-center gap-2">
          {linkUrl ? (
            <button
              type="button"
              disabled={fetching}
              className="btn-secondary text-xs"
              onClick={handleFetch}
            >
              {fetching ? "Fetching…" : "Auto-fetch"}
            </button>
          ) : null}
          <button
            type="button"
            disabled={uploading}
            className="btn-secondary text-xs"
            onClick={handleUploadClick}
          >
            {uploading ? "Uploading…" : "Upload file"}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>
      </div>

      {/* Direct icon URL */}
      <div className="flex items-center gap-2 border-t border-slate-200 px-4 py-2.5 dark:border-slate-700">
        <input
          ref={urlInputRef}
          type="url"
          value={urlValue}
          onChange={(e) => {
            setUrlValue(e.target.value);
            clearError();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleConvert(e);
          }}
          placeholder="Or paste an icon URL…"
          className="flex-1 min-w-0 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs shadow-sm outline-none transition focus:border-brand-500 focus:ring-1 focus:ring-brand-500/40 dark:bg-slate-800 dark:border-slate-600 dark:text-white"
        />
        <button
          type="button"
          disabled={converting || !urlValue.trim()}
          onClick={handleConvert}
          className="btn-secondary text-xs"
        >
          {converting ? "…" : "Apply"}
        </button>
      </div>

      {error && <p className="border-t border-red-200 px-4 py-2 text-xs text-red-600 dark:border-red-800">{error}</p>}
    </div>
  );
}
