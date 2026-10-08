import { describe, expect, it } from "vitest";
import {
  acceptsMarkdown,
  appendHeaderToken,
  canonicalUrl,
  markdownTwin,
  negotiate,
} from "../src/edge/negotiate.ts";

describe("negotiate (Accept header → representation)", () => {
  it.each([
    [null, "html"],
    ["", "html"],
    ["*/*", "html"],
    ["text/html", "html"],
    ["text/*", "html"],
    ["text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8", "html"],
    ["text/markdown", "markdown"],
    ["text/markdown, text/html", "markdown"],
    ["text/markdown, text/html;q=0.9, */*;q=0.8", "markdown"],
    ["text/html;q=0.5, text/markdown", "markdown"],
    ["text/markdown;q=0.5, text/html", "html"],
    ["text/markdown;q=0, */*", "html"],
    ["TEXT/MARKDOWN", "markdown"],
    ["application/json", "none"],
    ["text/html;q=0, text/markdown;q=0", "none"],
    ["image/png, text/plain", "none"],
  ] as const)("%s → %s", (accept, expected) => {
    expect(negotiate(accept)).toBe(expected);
  });

  it("uses the most specific range for the q-value (RFC 9110)", () => {
    // text/html is explicitly refused even though */* would allow it.
    expect(negotiate("text/html;q=0, */*")).toBe("markdown");
  });

  it("acceptsMarkdown mirrors negotiate", () => {
    expect(acceptsMarkdown("text/markdown")).toBe(true);
    expect(acceptsMarkdown("*/*")).toBe(false);
  });
});

describe("markdownTwin", () => {
  it.each([
    ["/", "/index.md"],
    ["/index.html", "/index.md"],
    ["/about", "/about.md"],
    ["/about/", "/about.md"],
    ["/contact", "/contact.md"],
    ["/privacy", "/privacy.md"],
    ["/nope", null],
    ["/about.md", null],
    ["/llms.txt", null],
  ])("%s → %s", (path, twin) => {
    expect(markdownTwin(path)).toBe(twin);
  });

  it("builds canonical URLs for pages", () => {
    expect(canonicalUrl("/")).toBe("https://sirbluffington.pages.dev/");
    expect(canonicalUrl("/about/")).toBe("https://sirbluffington.pages.dev/about");
  });
});

describe("appendHeaderToken", () => {
  it("adds without duplicating", () => {
    expect(appendHeaderToken(null, "Accept")).toBe("Accept");
    expect(appendHeaderToken("Accept-Encoding", "Accept")).toBe("Accept-Encoding, Accept");
    expect(appendHeaderToken("accept", "Accept")).toBe("accept");
    expect(appendHeaderToken("*", "Accept")).toBe("*");
  });
});
