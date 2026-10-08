/**
 * HTTP content negotiation for the Cloudflare Pages middleware (functions/_middleware.ts).
 *
 * Every HTML page has a Markdown twin. A request to the HTML URL with
 * `Accept: text/markdown` gets the twin (acceptmarkdown.com): `Content-Type:
 * text/markdown; charset=utf-8`, `Vary: Accept`, q-values honored, and `406` when the
 * client accepts neither representation. Unknown paths get a real 404, with a Markdown
 * body for Markdown clients.
 *
 * Pure functions only, so the routing rules are unit-tested without a Workers runtime.
 */
import { PAGES, SITE_URL } from "../site.ts";

export type Representation = "markdown" | "html" | "none";

interface MediaRange {
  type: string;
  subtype: string;
  q: number;
}

function parseAccept(header: string): MediaRange[] {
  const ranges: MediaRange[] = [];
  for (const part of header.split(",")) {
    const [media, ...params] = part.trim().split(";");
    const [type, subtype] = (media ?? "").trim().toLowerCase().split("/");
    if (!type || !subtype) continue;
    let q = 1;
    for (const param of params) {
      const [key, value] = param.trim().split("=");
      if (key?.trim().toLowerCase() === "q") {
        const parsed = Number(value);
        q = Number.isFinite(parsed) ? Math.min(1, Math.max(0, parsed)) : 0;
      }
    }
    ranges.push({ type, subtype, q });
  }
  return ranges;
}

/** The q-value and specificity (2 exact, 1 type/*, 0 wildcard, -1 unmatched) for a type. */
function quality(ranges: MediaRange[], type: string, subtype: string) {
  let best = { q: 0, specificity: -1 };
  for (const r of ranges) {
    let specificity = -1;
    if (r.type === type && r.subtype === subtype) specificity = 2;
    else if (r.type === type && r.subtype === "*") specificity = 1;
    else if (r.type === "*" && r.subtype === "*") specificity = 0;
    // RFC 9110 §12.5.1: the most specific matching range decides the q-value.
    if (specificity > best.specificity) best = { q: r.q, specificity };
  }
  return best;
}

/**
 * Pick the representation for a page given the request's Accept header.
 * Markdown wins when it has the higher q-value, or ties with HTML while being named
 * explicitly (`text/markdown`), so `Accept: text/markdown, text/html` means Markdown and a
 * browser's `*\/*` keeps getting HTML.
 */
export function negotiate(accept: string | null): Representation {
  if (accept === null || accept.trim() === "") return "html";
  const ranges = parseAccept(accept);
  if (ranges.length === 0) return "html";
  const md = quality(ranges, "text", "markdown");
  const html = quality(ranges, "text", "html");
  if (md.q <= 0 && html.q <= 0) return "none";
  if (md.q > html.q) return "markdown";
  if (md.q === html.q && md.specificity === 2) return "markdown";
  return "html";
}

/** True when a Markdown body is acceptable at all (used for the 404 body). */
export function acceptsMarkdown(accept: string | null): boolean {
  return negotiate(accept) === "markdown";
}

/** The Markdown twin for an HTML page path, or null when the path is not a page. */
export function markdownTwin(pathname: string): string | null {
  const normalized = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  const path = normalized === "/index.html" || normalized === "/index" ? "/" : normalized;
  return PAGES.find((p) => p.path === path)?.markdown ?? null;
}

/** Canonical HTML URL for a page path (used in the Markdown response's Link header). */
export function canonicalUrl(pathname: string): string {
  const twin = markdownTwin(pathname);
  const page = PAGES.find((p) => p.markdown === twin);
  return `${SITE_URL}${page?.path ?? pathname}`;
}

export const MARKDOWN_CONTENT_TYPE = "text/markdown; charset=utf-8";

/** Append a token to a comma-separated header (e.g. Vary) without duplicating it. */
export function appendHeaderToken(existing: string | null, token: string): string {
  const tokens = (existing ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  if (tokens.some((t) => t.toLowerCase() === token.toLowerCase() || t === "*")) {
    return tokens.join(", ");
  }
  return [...tokens, token].join(", ");
}

/** Fallback 404 body used if the generated /404.md asset is ever missing. */
export const FALLBACK_NOT_FOUND_MARKDOWN = `# 404: Page not found

There is no page at this address on ${SITE_URL}.
Start from the homepage (${SITE_URL}/), the site index for agents (${SITE_URL}/llms.txt),
or the sitemap (${SITE_URL}/sitemap.xml).
`;
