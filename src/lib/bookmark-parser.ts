// T8 - Browser bookmark (Netscape Bookmark HTML) parser.
//
// Netscape Bookmark HTML is a tree of <DL>/<DT>/<H3>/<A> elements. Unfortunately,
// node-html-parser and most DOM parsers collapse nested <DL> tags into a single
// flat list (e.g., 41 <DL> tags in source → 1 <dl> in parsed DOM), losing all
// hierarchy information.
//
// Solution: Parse the raw HTML line-by-line to track <DL> depth manually:
//   - Each <DL> increases depth (opening a folder)
//   - Each </DL> decreases depth (closing a folder)
//   - <H3> at depth N opens a folder at that depth
//   - <A> tags belong to the most recently opened folder at current depth
//
// This preserves the nested structure: "书签栏" (depth 1) → "NAS" (depth 2) → "11" (depth 3).

/** A parsed bookmark category (folder). */
export interface ParsedCategory {
  name: string;
  path: string;
}

/** A parsed bookmark link. */
export interface ParsedLink {
  title: string;
  url: string;
  categoryId: number; // index into ParsedCategory[]
  icon?: string;
}

function isHttpUrl(url: string): boolean {
  return url.startsWith("http://") || url.startsWith("https://");
}

/**
 * Parse a Netscape Bookmark HTML document into categories and links.
 * Uses line-by-line parsing to preserve nested <DL> structure.
 */
export function parseBookmarks(html: string): {
  categories: ParsedCategory[];
  links: ParsedLink[];
} {
  const categories: ParsedCategory[] = [];
  const links: ParsedLink[] = [];
  const pathToIndex = new Map<string, number>();

  function getOrCreateCategory(name: string, parentPath: string): number {
    const fullPath = parentPath ? `${parentPath}/${name}` : name;
    if (!pathToIndex.has(fullPath)) {
      categories.push({ name, path: fullPath });
      pathToIndex.set(fullPath, categories.length - 1);
    }
    return pathToIndex.get(fullPath)!;
  }

  // "Uncategorized" fallback for links that appear before any folder.
  const uncategorizedId = getOrCreateCategory("Uncategorized", "");

  // Track folder hierarchy: folderStack[depth] = full path at that depth
  const folderStack: string[] = [];
  let currentDepth = 0;

  // Parse line-by-line to track <DL> nesting
  const lines = html.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();

    // Track depth changes
    if (/<DL>/i.test(trimmed)) {
      currentDepth++;
    }
    if (/<\/DL>/i.test(trimmed)) {
      currentDepth--;
      // Pop folder stack when exiting a <DL>
      if (folderStack.length >= currentDepth) {
        folderStack.length = currentDepth;
      }
    }

    // Extract folder name from <H3>
    const h3Match = trimmed.match(/<H3[^>]*>(.*?)<\/H3>/i);
    if (h3Match) {
      const folderName = h3Match[1].trim();
      if (folderName) {
        // Pop stack to current depth (handle sibling folders)
        if (folderStack.length >= currentDepth) {
          folderStack.length = currentDepth - 1;
        }

        const parentPath = folderStack.length > 0 ? folderStack[folderStack.length - 1] : "";
        const folderId = getOrCreateCategory(folderName, parentPath);
        folderStack.push(categories[folderId].path);
      }
    }

    // Extract link from <A>
    const aMatch = trimmed.match(/<A\s+HREF="([^"]+)"[^>]*>(.*?)<\/A>/i);
    if (aMatch) {
      const url = aMatch[1].trim();
      const title = aMatch[2].trim();

      if (url && isHttpUrl(url)) {
        // Extract icon if present
        const iconMatch = trimmed.match(/ICON="([^"]+)"/i);
        const icon = iconMatch?.[1]?.startsWith("data:") ? iconMatch[1] : undefined;

        const currentPath = folderStack.length > 0 ? folderStack[folderStack.length - 1] : "";
        const categoryId = currentPath
          ? (pathToIndex.get(currentPath) ?? uncategorizedId)
          : uncategorizedId;

        links.push({
          title: title || url,
          url,
          categoryId,
          ...(icon ? { icon } : {}),
        });
      }
    }
  }

  // Clean up: if "Uncategorized" has no links, remove it.
  if (categories.length > 0 && categories[0]?.name === "Uncategorized") {
    const hasUncategorizedLinks = links.some((l) => l.categoryId === 0);
    if (!hasUncategorizedLinks) {
      categories.shift();
      for (const link of links) {
        link.categoryId = Math.max(0, link.categoryId - 1);
      }
    }
  }

  return { categories, links };
}
