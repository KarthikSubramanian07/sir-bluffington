import { describe, expect, it } from "vitest";
import { renderApp, renderChrome } from "../src/prerender.tsx";

const text = (html: string) =>
  html
    .replace(/<svg[\s\S]*?<\/svg>/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

describe("build-time prerender", () => {
  it("renders the landing page with an H1 and 500+ chars of real copy", () => {
    const html = renderApp();
    expect(html.match(/<h1\b/g)).toHaveLength(1);
    expect(html).toContain("hero-title");
    expect(text(html).length).toBeGreaterThan(500);
    expect(text(html)).toContain("poker trainer");
  });

  it("keeps heading levels sequential", () => {
    const levels = [...renderApp().matchAll(/<h([1-6])\b/g)].map((m) => Number(m[1]));
    expect(levels[0]).toBe(1);
    for (let i = 1; i < levels.length; i++) {
      expect(levels[i]! - levels[i - 1]!).toBeLessThanOrEqual(1);
    }
  });

  it("links the trust pages and llms.txt from the shared footer", () => {
    const { header, footer } = renderChrome();
    expect(header).toContain('href="/"');
    for (const href of ["/about", "/contact", "/privacy", "/llms.txt"]) {
      expect(footer).toContain(`href="${href}"`);
      expect(renderApp()).toContain(`href="${href}"`);
    }
  });
});
