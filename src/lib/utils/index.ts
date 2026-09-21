// Lightweight cn helper — no external deps. Returns a deduplicated,
// space-joined class string. Used across components for conditional classes.
export function cn(...inputs: (string | undefined | boolean | null)[]): string {
  return inputs
    .filter(Boolean)
    .map((s) => String(s).trim())
    .filter(Boolean)
    .join(' ');
}
