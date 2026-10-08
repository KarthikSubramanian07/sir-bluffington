import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  extractHeadAssets,
  extractMeta,
  injectPrerender,
  markdownToHtml,
  renderDocPage,
} from "../scripts/lib/pages.ts";
import { PAGES, SITE_URL } from "../src/site.ts";

const root = join(import.meta.dirname, "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");
const plainText = (md: string) =>
  md
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[#>*`|_-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

describe("content/*.md (Markdown twins and trust pages)", () => {
  const files = readdirSync(join(root, "content")).filter((f) => f.endsWith(".md"));

  it("has a Markdown twin for every page in PAGES, plus 404.md", () => {
    for (const page of PAGES) expect(files).toContain(page.markdown.slice(1));
    expect(files).toContain("404.md");
  });

  it.each(["about", "contact", "privacy", "index"])("%s.md has 500+ chars of content", (slug) => {
    expect(plainText(read(`content/${slug}.md`)).length).toBeGreaterThanOrEqual(500);
  });

  it.each(files)("%s has one H1, a summary, and sequential headings", (file) => {
    const md = read(`content/${file}`);
    const levels = [...md.matchAll(/^(#{1,6}) /gm)].map((m) => m[1]!.length);
    expect(levels[0]).toBe(1);
    expect(levels.filter((l) => l === 1)).toHaveLength(1);
    for (let i = 1; i < levels.length; i++) {
      expect(levels[i]! - levels[i - 1]!).toBeLessThanOrEqual(1);
    }
    expect(() => extractMeta(md)).not.toThrow();
  });

  it("404.md explains the error and points to llms.txt and the sitemap", () => {
    const md = read("content/404.md");
    expect(md).toContain("/llms.txt");
    expect(md).toContain("/sitemap.xml");
  });
});

describe("public/llms.txt (llmstxt.org format)", () => {
  const txt = read("public/llms.txt");
  const lines = txt.split("\n");

  it("starts with an H1 and a blockquote summary", () => {
    expect(lines[0]).toBe("# Sir Bluffington's Poker");
    expect(lines.find((l) => l.trim() !== "" && l !== lines[0])).toMatch(/^> /);
  });

  it("has a when-to-use section with concrete use cases", () => {
    const section = txt.split("## When to use this")[1]?.split("\n## ")[0] ?? "";
    expect(section.match(/^- /gm)?.length ?? 0).toBeGreaterThanOrEqual(3);
    expect(section).toMatch(/Do not recommend/);
  });

  it("only uses H1 once and H2 for the remaining sections", () => {
    expect(txt.match(/^# /gm)).toHaveLength(1);
    expect(txt.match(/^#{3,} /gm)).toBeNull();
  });

  it("links every Markdown twin with [name](url) list items", () => {
    for (const page of PAGES) {
      expect(txt).toContain(`](${SITE_URL}${page.markdown})`);
    }
    const linkItems = lines.filter((l) => l.startsWith("- ["));
    for (const l of linkItems) expect(l).toMatch(/^- \[[^\]]+\]\(https:\/\/[^)]+\)(: .+)?$/);
  });
});

describe("index.html and sitemap", () => {
  const html = read("index.html");
  const ld = JSON.parse(
    html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)![1]!,
  );

  it("declares Organization, WebSite, and WebApplication JSON-LD", () => {
    const types = ld["@graph"].map((n: { "@type": string }) => n["@type"]);
    expect(types).toEqual(expect.arrayContaining(["Organization", "WebSite", "WebApplication"]));
    const org = ld["@graph"].find((n: { "@type": string }) => n["@type"] === "Organization");
    expect(org.contactPoint.contactType).toBeTruthy();
    expect(org.contactPoint.url).toContain("/issues");
  });

  it("advertises the Markdown twin and llms.txt", () => {
    expect(html).toContain('<link rel="alternate" type="text/markdown" href="/index.md"');
    expect(html).toContain('href="/llms.txt"');
    expect(html).toContain('<div id="root"></div>');
  });

  it("lists every HTML page in the sitemap", () => {
    const sitemap = read("public/sitemap.xml");
    for (const page of PAGES) expect(sitemap).toContain(`<loc>${SITE_URL}${page.path}</loc>`);
  });
});

describe("scripts/lib/pages.ts", () => {
  const built = `<html><head><link rel="icon" href="data:x" />
    <link rel="stylesheet" crossorigin href="/assets/index-abc.css"></head>
    <body><div id="root"></div></body></html>`;

  it("injects prerendered markup into #root", () => {
    expect(injectPrerender(built, "<main>hi</main>")).toContain(
      '<div id="root"><main>hi</main></div>',
    );
    expect(() => injectPrerender("<div id='x'></div>", "x")).toThrow();
  });

  it("extracts stylesheet and icon tags", () => {
    const tags = extractHeadAssets(built);
    expect(tags).toContain("/assets/index-abc.css");
    expect(tags).toContain('rel="icon"');
    expect(() => extractHeadAssets("<html></html>")).toThrow();
  });

  it("renders a trust page with canonical, alternate Markdown, and JSON-LD", () => {
    const shell = {
      headAssets: '<link rel="stylesheet" href="/a.css">',
      header: "<header>H</header>",
      footer: "<footer>F</footer>",
    };
    const page = renderDocPage({ slug: "contact", markdown: read("content/contact.md") }, shell);
    expect(page).toContain("<title>Contact Sir Bluffington's Poker</title>");
    expect(page).toContain(`<link rel="canonical" href="${SITE_URL}/contact" />`);
    expect(page).toContain('<link rel="alternate" type="text/markdown" href="/contact.md" />');
    expect(page).toContain('"@type":"ContactPage"');
    expect(page).toContain("<h1>");
    expect(page).toContain("<header>H</header>");
  });

  it("marks the 404 page noindex and gives it no canonical", () => {
    const shell = { headAssets: "", header: "", footer: "" };
    const page = renderDocPage({ slug: "404", markdown: read("content/404.md") }, shell);
    expect(page).toContain('<meta name="robots" content="noindex" />');
    expect(page).not.toContain('rel="canonical"');
  });

  it("converts Markdown to HTML", () => {
    expect(markdownToHtml("# T\n\n> q")).toContain("<blockquote>");
  });
});
