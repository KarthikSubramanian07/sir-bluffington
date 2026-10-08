/**
 * Pure helpers for scripts/build-pages.ts: turn content/*.md into static HTML pages that
 * share the app's stylesheet, header, and footer, and inline the prerendered homepage.
 */
import { marked } from "marked";
import { SITE_NAME, SITE_URL } from "../../src/site.ts";

export interface DocSource {
  /** File stem in content/, e.g. "about". */
  slug: string;
  markdown: string;
}

export interface Shell {
  /** `<link rel="stylesheet">` and icon tags copied from the built index.html. */
  headAssets: string;
  header: string;
  footer: string;
}

const PAGE_TYPES: Record<string, string> = {
  about: "AboutPage",
  contact: "ContactPage",
};

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Strip inline Markdown (links, emphasis, code) to plain text. */
const plain = (s: string) =>
  s
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*_`]/g, "")
    .trim();

/** The H1 text and the first blockquote paragraph, used for <title> and the description. */
export function extractMeta(markdown: string): { title: string; description: string } {
  const h1 = markdown.match(/^# (.+)$/m)?.[1];
  const quote = markdown.match(/^> (.+)$/m)?.[1];
  if (!h1 || !quote) throw new Error("Content pages need an H1 and a > summary blockquote");
  return { title: plain(h1), description: plain(quote) };
}

export function markdownToHtml(markdown: string): string {
  return marked.parse(markdown, { async: false, gfm: true });
}

/** Stylesheet and icon tags from Vite's built index.html, so doc pages match the app. */
export function extractHeadAssets(indexHtml: string): string {
  const tags = indexHtml.match(/<link\b[^>]*rel="(?:stylesheet|icon)"[^>]*>/g) ?? [];
  if (!tags.some((t) => t.includes('rel="stylesheet"'))) {
    throw new Error("No stylesheet found in built index.html");
  }
  return tags.join("\n    ");
}

/** Inline the server-rendered app into the empty #root of the built index.html. */
export function injectPrerender(indexHtml: string, appHtml: string): string {
  const marker = '<div id="root"></div>';
  if (!indexHtml.includes(marker)) throw new Error("index.html has no empty #root");
  return indexHtml.replace(marker, `<div id="root">${appHtml}</div>`);
}

/** Public URL path for a content slug ("404" has no canonical URL). */
export const pathFor = (slug: string) => (slug === "index" ? "/" : `/${slug}`);

export function renderDocPage(doc: DocSource, shell: Shell): string {
  const { title, description } = extractMeta(doc.markdown);
  const isNotFound = doc.slug === "404";
  const url = `${SITE_URL}${pathFor(doc.slug)}`;
  const fullTitle = title.includes(SITE_NAME) ? title : `${title} | ${SITE_NAME}`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": PAGE_TYPES[doc.slug] ?? "WebPage",
    name: fullTitle,
    url,
    description,
    isPartOf: { "@type": "WebSite", name: SITE_NAME, url: `${SITE_URL}/` },
    publisher: { "@id": `${SITE_URL}/#organization` },
  };
  const seo = isNotFound
    ? '<meta name="robots" content="noindex" />'
    : [
        `<link rel="canonical" href="${url}" />`,
        `<link rel="alternate" type="text/markdown" href="/${doc.slug}.md" />`,
        '<meta property="og:type" content="website" />',
        `<meta property="og:site_name" content="${escapeHtml(SITE_NAME)}" />`,
        `<meta property="og:url" content="${url}" />`,
        `<meta property="og:title" content="${escapeHtml(fullTitle)}" />`,
        `<meta property="og:description" content="${escapeHtml(description)}" />`,
        `<meta property="og:image" content="${SITE_URL}/og.png" />`,
        '<meta name="twitter:card" content="summary_large_image" />',
        `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>`,
      ].join("\n    ");

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <meta name="theme-color" content="#0B0E0C" />
    <title>${escapeHtml(fullTitle)}</title>
    <meta name="description" content="${escapeHtml(description)}" />
    ${seo}
    ${shell.headAssets}
    <link rel="stylesheet" href="/doc.css" />
  </head>
  <body>
    <div class="home">
      ${shell.header}
      <main class="home-main doc-main">
        <article class="prose">
${markdownToHtml(doc.markdown)}
        </article>
      </main>
      ${shell.footer}
    </div>
  </body>
</html>
`;
}
