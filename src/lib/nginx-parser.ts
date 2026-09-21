// T13 - Lightweight Nginx config parser.
// Recursively walks a config directory, follows `include` directives (depth <= 3),
// splits files into `server { ... }` blocks via bracket matching (with # comment
// filtering), and extracts server_name / listen / first location's proxy_pass.
//
// Upstream resolution: scans `upstream <name> { server <addr>[:port]; }` blocks
// first, building a name->address map. When a proxy_pass target (minus scheme)
// matches an upstream name, it is replaced with the real address.
// Variable fallback: proxy_pass containing Nginx variables ($host, ${var}, etc.)
// is treated as unresolvable and falls back to server_name + listen, with
// fallbackReason recorded for the preview UI.
//
// Known limitations (by design, no third-party parser):
// - Parentheses/braces inside quoted strings are NOT handled; simple string-aware
//   bracket counting is used, but deeply nested or oddly quoted values may break.
// - Only file: glob patterns with a trailing `/*.conf`-style suffix are expanded;
//   arbitrary regex globs are not.
// - `server` blocks nested inside `http` are also picked up (top-level or not).
// - upstream is assumed to be a simple `name { server <addr>; ... }` shape.

import * as fs from "node:fs";
import * as path from "node:path";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface NginxSite {
  /** Derived display name: first server_name value. */
  name: string;
  /** Final URL with protocol + host. */
  url: string;
  protocol: "http" | "https";
  port: number;
  hasProxyPass: boolean;
  /** The raw proxy_pass target, if one was found. */
  proxyPassTarget?: string;
  /** Why the final URL is a fallback rather than the proxy_pass target. */
  fallbackReason?: string;
  /** Whether this came from a default/catch-all server (server_name _). */
  isDefaultServer?: boolean;
}

/** Errors surfaced from scan when the directory is reachable but parse issues occur. */
export interface ParseError {
  /** Source file involved. */
  file: string;
  /** Human-readable message. */
  message: string;
}

/** Result of a parseNginxConf call. */
export interface NginxParseResult {
  /** Parsed sites. */
  sites: NginxSite[];
  /** Partial parse errors (files that failed individually). */
  errors: ParseError[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_NGINX_ROOT = "/etc/nginx";
const MAX_INCLUDE_DEPTH = 3;

// ---------------------------------------------------------------------------
// Core entry
// ---------------------------------------------------------------------------

export async function parseNginxConf(rootPath: string): Promise<NginxParseResult> {
  const actualRoot = path.resolve(rootPath ?? DEFAULT_NGINX_ROOT);

  const seen = new Set<string>();
  const sites: NginxSite[] = [];
  const errors: ParseError[] = [];
  const upstreams = new Map<string, string>();

  if (!fs.existsSync(actualRoot) || !fs.statSync(actualRoot).isDirectory()) {
    return { sites: [], errors: [] };
  }

  const rootFiles = collectFiles(actualRoot);
  for (const f of rootFiles) {
    const abs = path.resolve(actualRoot, f);
    await processFile(abs, MAX_INCLUDE_DEPTH, seen, upstreams, sites, errors);
  }

  return { sites, errors };
}

// ---------------------------------------------------------------------------
// File collection
// ---------------------------------------------------------------------------

function collectFiles(dirPath: string): string[] {
  try {
    return fs
      .readdirSync(dirPath, { withFileTypes: true })
      .filter((e) => e.isFile() && (e.name.endsWith(".conf") || e.name === "nginx.conf"))
      .map((e) => e.name);
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Single-file processing (logs downgrades, never throws out)
// ---------------------------------------------------------------------------

async function processFile(
  filePath: string,
  depth: number,
  seen: Set<string>,
  upstreams: Map<string, string>,
  sites: NginxSite[],
  errors: ParseError[],
): Promise<void> {
  const real = resolveRealPath(filePath);
  if (!real) {
    errors.push({ file: filePath, message: "path could not be resolved" });
    return;
  }
  if (seen.has(real)) return;
  seen.add(real);

  let content: string;
  try {
    content = fs.readFileSync(real, "utf8");
  } catch (err) {
    const msg = (err as Error).message ?? "unreadable";
    console.error(`[nginx-parser] failed to read ${real}: ${msg}`);
    errors.push({ file: filePath, message: `read error: ${msg}` });
    return;
  }

  // Follow include directives.
  if (depth > 0) {
    const includes = extractIncludePaths(content);
    for (const inc of includes) {
      const resolved = resolveGlob(inc, real);
      for (const target of resolved) {
        try {
          const st = fs.statSync(target);
          if (st.isDirectory()) {
            for (const name of collectFiles(target)) {
              await processFile(path.join(target, name), depth - 1, seen, upstreams, sites, errors);
            }
          } else {
            await processFile(target, depth - 1, seen, upstreams, sites, errors);
          }
        } catch (err) {
          const msg = (err as Error).message ?? "include resolution failed";
          console.error(`[nginx-parser] failed to include ${target}: ${msg}`);
          errors.push({ file: filePath, message: `include ${target}: ${msg}` });
        }
      }
    }
  }

  // Parse upstream blocks (builds name->address map), then server blocks.
  try {
    for (const u of splitUpstreamBlocks(content)) {
      const entry = parseUpstreamBlock(u);
      if (entry) upstreams.set(entry.name, entry.address);
    }
    const blocks = splitServerBlocks(content);
    for (const block of blocks) {
      const site = parseServerBlock(block, real, upstreams);
      if (site) sites.push(site);
    }
  } catch (err) {
    const msg = (err as Error).message ?? "parse error";
    console.error(`[nginx-parser] failed to parse ${real}: ${msg}`);
    errors.push({ file: filePath, message: msg });
  }
}

function resolveRealPath(p: string): string | null {
  try {
    return fs.realpathSync(p);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Include directive extraction
// ---------------------------------------------------------------------------

function extractIncludePaths(content: string): string[] {
  const result: string[] = [];
  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    const stripped = stripLineComment(line);
    const match = stripped.match(/^\s*include\s+"?(.+?)"?\s*;/);
    if (match) {
      result.push(match[1].trim());
    }
  }
  return result;
}

function resolveGlob(includeArg: string, includingFile: string): string[] {
  const arg = includeArg.replace(/\\/g, "/");
  const filePath = path.dirname(includingFile);
  let candidate = path.resolve(filePath, arg);

  if (candidate.indexOf("*") === -1 && candidate.indexOf("?") === -1) {
    return [candidate];
  }

  const dir = path.dirname(candidate);
  const base = path.basename(candidate);
  if (!dir || base === "") return [candidate];

  try {
    const entries = fs.readdirSync(dir);
    const files = entries.filter(
      (e) => {
        try {
          return fs.statSync(path.join(dir, e)).isFile();
        } catch {
          return false;
        }
      },
    );
    return files.filter((e) => matchGlob(e, base)).map((e) => path.join(dir, e));
  } catch {
    return [candidate];
  }
}

function matchGlob(filename: string, pattern: string): boolean {
  if (pattern === "*" || pattern === "*.*") return true;
  if (pattern.startsWith("*")) {
    const suffix = pattern.slice(1);
    if (suffix.startsWith(".")) {
      return filename.endsWith(suffix) && filename.lastIndexOf(suffix) > 0;
    }
    return filename.endsWith(suffix);
  }
  return filename === pattern;
}

// ---------------------------------------------------------------------------
// Comment stripping
// ---------------------------------------------------------------------------

function stripLineComment(line: string): string {
  let inSingle = false;
  let inDouble = false;
  let escaped = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (escaped) { escaped = false; continue; }
    if (c === "\\") { escaped = true; continue; }
    if (c === "'" && !inDouble) { inSingle = !inSingle; continue; }
    if (c === '"' && !inSingle) { inDouble = !inDouble; continue; }
    if (c === "#" && !inSingle && !inDouble) return line.slice(0, i);
  }
  return line;
}

function stripComments(content: string): string {
  return content.split(/\r?\n/).map(stripLineComment).join("\n");
}

// ---------------------------------------------------------------------------
// Block extraction (string-aware bracket matching)
// ---------------------------------------------------------------------------

function splitUpstreamBlocks(content: string): string[] {
  const clean = stripComments(content);
  const blocks: string[] = [];
  let i = 0;
  const len = clean.length;

  while (i < len) {
    const match = matchKeywordAt(clean, i, "upstream", "{");
    if (!match) break;
    const blockEnd = findMatchingBrace(clean, match.braceIndex + 1, len);
    if (blockEnd === -1) {
      i = match.keywordIndex + "upstream".length;
      continue;
    }
    blocks.push(clean.slice(match.keywordIndex, blockEnd + 1));
    i = blockEnd + 1;
  }
  return blocks;
}

function splitServerBlocks(content: string): string[] {
  const clean = stripComments(content);
  const blocks: string[] = [];
  let i = 0;
  const len = clean.length;

  while (i < len) {
    const match = matchKeywordAt(clean, i, "server", "{");
    if (!match) break;
    const blockEnd = findMatchingBrace(clean, match.braceIndex + 1, len);
    if (blockEnd === -1) {
      i = match.keywordIndex + "server".length;
      continue;
    }
    blocks.push(clean.slice(match.keywordIndex, blockEnd + 1));
    i = blockEnd + 1;
  }
  return blocks;
}

function blockContent(block: string): string {
  const firstOpen = block.indexOf("{");
  const clean = stripComments(block);
  const end = findMatchingBrace(clean, firstOpen + 1, clean.length);
  if (end === -1 || firstOpen === -1) return "";
  return clean.slice(firstOpen + 1, end);
}

function matchKeywordAt(
  text: string,
  i: number,
  kw: string,
  _open: string,
): { keywordIndex: number; braceIndex: number } | null {
  const len = text.length;
  let j = i;
  while (j < len) {
    const candidate = text.slice(j).search(new RegExp(`\\b${kw}\\b`));
    if (candidate === -1) return null;
    const kwIndex = j + candidate;
    let after = kwIndex + kw.length;
    while (after < len && (text[after] === " " || text[after] === "\t" || text[after] === "\n")) after++;
    if (after < len && text[after] === "{") {
      return { keywordIndex: kwIndex, braceIndex: after };
    }
    j = kwIndex + kw.length;
  }
  return null;
}

function findMatchingBrace(text: string, pos: number, limit: number): number {
  let depth = 1;
  let i = pos;
  let inDouble = false;
  let inSingle = false;
  let escaped = false;
  while (i < Math.min(pos + 200000, limit) && depth > 0) {
    const c = text[i];
    if (escaped) { escaped = false; i++; continue; }
    if (c === "\\") { escaped = true; i++; continue; }
    if (c === "'" && !inDouble) { inSingle = !inSingle; i++; continue; }
    if (c === '"' && !inSingle) { inDouble = !inDouble; i++; continue; }
    if (!inSingle && !inDouble) {
      if (c === "{") depth++;
      if (c === "}") depth--;
    }
    if (depth > 0) i++;
  }
  return depth === 0 ? i : -1;
}

// ---------------------------------------------------------------------------
// Upstream parsing
// ---------------------------------------------------------------------------

/** Upstream block => first `server <addr>[:port];` inside it. */
function parseUpstreamBlock(block: string): { name: string; address: string } | null {
  const inner = blockContent(block);
  // First token after `upstream` is the name.
  const nameMatch = block.match(/^\s*upstream\s+([^\s{]+)\s*{/);
  const name = nameMatch ? nameMatch[1].trim() : null;
  if (!name) return null;

  // First server directive inside.
  const serverMatch = inner.match(/^\s*server\s+([^;\s]+);/m);
  if (!serverMatch) return null;
  return { name, address: serverMatch[1].trim() };
}

// ---------------------------------------------------------------------------
// Server block field extraction
// ---------------------------------------------------------------------------

function parseServerBlock(
  block: string,
  _sourceFile: string,
  upstreams: Map<string, string>,
): NginxSite | null {
  const inner = blockContent(block);
  const rawServerName = extractDirectiveValue(inner, "server_name");

  // server_name "_" is Nginx's default catch-all. Display it as
  // "Default" and mark it so the import route builds http://<nasHost>:<port>.
  if (!rawServerName || /^_+$/i.test(rawServerName)) {
    const listenLine = extractDirectiveValue(inner, "listen");
    const { protocol, port } = parseListen(listenLine);
    return {
      name: "Default",
      url: `${protocol}://_:${port}`,
      protocol,
      port,
      hasProxyPass: false,
      isDefaultServer: true,
    };
  }
  const firstServerName = rawServerName;
  const listenLine = extractDirectiveValue(inner, "listen");
  const { protocol, port } = parseListen(listenLine);

  const proxyPass = extractFirstLocationProxyPass(inner);

  const name = firstServerName ?? "localhost";

  // Resolve final URL.
  let url: string;
  let fallbackReason: string | undefined;
  const rawProxyPass = proxyPass ? stripTrailingUriVars(proxyPass) : null;

  if (proxyPass) {
    // Detect Nginx variables -> fallback.
    if (containsNginxVariable(proxyPass)) {
      fallbackReason = "proxy_pass contains variables";
      const host = resolveHostForUrl(firstServerName);
      url = `${protocol}://${host}:${port}`;
    } else {
      // Try upstream name resolution, then use raw (normalized).
      const resolved = resolveProxyPass(rawProxyPass, upstreams);
      url = resolved;
    }
  } else {
    const host = resolveHostForUrl(firstServerName);
    url = `${protocol}://${host}:${port}`;
  }

  const result: NginxSite = {
    name,
    url,
    protocol,
    port,
    hasProxyPass: !!proxyPass,
    ...(proxyPass ? { proxyPassTarget: proxyPass } : {}),
  };
  if (fallbackReason) result.fallbackReason = fallbackReason;
  return result;
}

/** Does the value contain Nginx variable references: $name or ${name}. */
function containsNginxVariable(value: string): boolean {
  // ${...} or $<alpha/_><alphanum/_> (not $http_ is fine; we count any $).
  return /\$\{[^}]+\}|(?<![\\])\$\w/.test(value);
}

/** Strip a trailing URI-like variable fragment e.g. "http://.../$request_uri" for
 *  resolution; the raw value (with the variable) is kept for proxyPassTarget. */
function stripTrailingUriVars(value: string): string {
  return value.replace(/\/\$\w+$/, "");
}

/**
 * Resolve a proxy_pass value against the upstream map.
 * Steps:
 *  1. If the value (with or without scheme) is exactly an upstream name -> replace
 *     with the upstream address (preserving original scheme).
 *  2. Otherwise treat it as a real URL and normalize it.
 */
function resolveProxyPass(value: string | null, upstreams: Map<string, string>): string {
  if (!value) return "http://localhost:80";

  let scheme = "http://";
  let target = value.trim();
  if (target.startsWith("http://")) { scheme = "http://"; target = target.slice(7); }
  else if (target.startsWith("https://")) { scheme = "https://"; target = target.slice(8); }
  else if (target.startsWith("unix:")) { return value.trim(); }

  // Exact match to an upstream name (e.g. "backend" or "api").
  if (upstreams.has(target)) {
    const addr = upstreams.get(target)!;
    // addr may be "host:port". Reassemble with original scheme.
    return scheme + addr;
  }

  return normalizeUrl(target, scheme);
}

function extractDirectiveValue(block: string, directive: string): string | null {
  const re = new RegExp(`^\\s*${directive}\\s+([^;]+);`, "im");
  const m = block.match(re);
  return m ? m[1].trim() : null;
}

function parseListen(value: string | null): { protocol: "http" | "https"; port: number; ssl: boolean } {
  if (!value) return { protocol: "http", port: 80, ssl: false };
  let ssl = false;
  const parts = value.split(/\s+/);
  let port = 80;
  for (const p of parts) {
    const low = p.toLowerCase();
    if (low === "ssl") ssl = true;
    else if (low === "443") { port = 443; ssl = true; }
    else if (/^\d+$/.test(p)) port = Number(p);
  }
  return { protocol: ssl ? "https" : "http", port, ssl };
}

function extractFirstLocationProxyPass(block: string): string | null {
  const locMatch = matchKeywordAt(block, 0, "location", "{");
  if (!locMatch) return null;
  const end = findMatchingBrace(block, locMatch.braceIndex + 1, block.length);
  if (end === -1) return null;
  const locContent = block.slice(locMatch.keywordIndex, end + 1);
  return extractDirectiveValue(locContent, "proxy_pass");
}

function resolveHostForUrl(serverName: string | null): string {
  if (!serverName) return "localhost";
  const first = serverName.split(/\s+/)[0];
  const m = first.match(/^(?:https?:\/\/)?(.+)$/);
  return m ? m[1] : first;
}

function normalizeUrl(candidate: string, scheme = "http://"): string {
  let s = candidate.trim().replace(/\/+$/, "");
  if (!s.startsWith("http://") && !s.startsWith("https://")) s = scheme + s;
  try {
    const u = new URL(s);
    return u.toString().replace(/\/$/, "");
  } catch {
    return s;
  }
}
