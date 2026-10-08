import { describe, expect, it, vi } from "vitest";
import { handleRequest } from "../src/edge/handler.ts";

const ORIGIN = "https://sirbluffington.pages.dev";
const ASSETS: Record<string, string> = {
  "/index.md": "# Home\n\nHello agents.\n",
  "/about.md": "# About\n",
  "/404.md": "# 404: Page not found\n\nTry /llms.txt or /sitemap.xml.\n",
};
const KNOWN_HTML = new Set(["/", "/about", "/contact", "/privacy", "/llms.txt"]);

function deps(path: string, opts: { missingAssets?: boolean } = {}) {
  const next = vi.fn(async () =>
    KNOWN_HTML.has(path)
      ? new Response("<!doctype html><h1>page</h1>", {
          status: 200,
          headers: { "Content-Type": "text/html; charset=utf-8" },
        })
      : new Response("<!doctype html><h1>404</h1>", {
          status: 404,
          headers: { "Content-Type": "text/html; charset=utf-8" },
        }),
  );
  const fetchAsset = vi.fn(async (p: string) =>
    !opts.missingAssets && ASSETS[p]
      ? new Response(ASSETS[p], { status: 200 })
      : new Response("not found", { status: 404 }),
  );
  return { next, fetchAsset };
}

function req(path: string, accept?: string, method = "GET") {
  return new Request(`${ORIGIN}${path}`, {
    method,
    headers: accept ? { Accept: accept } : {},
  });
}

describe("handleRequest: Markdown negotiation on pages", () => {
  it("serves the homepage Markdown twin for Accept: text/markdown", async () => {
    const d = deps("/");
    const res = await handleRequest(req("/", "text/markdown"), d);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/markdown; charset=utf-8");
    expect(res.headers.get("Vary")).toBe("Accept");
    expect(res.headers.get("Link")).toBe(`<${ORIGIN}/>; rel="canonical"`);
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(await res.text()).toBe(ASSETS["/index.md"]);
    expect(d.fetchAsset).toHaveBeenCalledWith("/index.md");
    expect(d.next).not.toHaveBeenCalled();
  });

  it("keeps serving HTML for browsers, with Vary: Accept and an alternate link", async () => {
    const res = await handleRequest(req("/", "text/html,*/*;q=0.8"), deps("/"));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/html");
    expect(res.headers.get("Vary")).toBe("Accept");
    expect(res.headers.get("Link")).toBe('</index.md>; rel="alternate"; type="text/markdown"');
    expect(await res.text()).toContain("<h1>page</h1>");
  });

  it("returns 406 when neither HTML nor Markdown is acceptable", async () => {
    const res = await handleRequest(req("/about", "application/json"), deps("/about"));
    expect(res.status).toBe(406);
    expect(res.headers.get("Vary")).toBe("Accept");
    expect(await res.text()).toMatch(/text\/html or text\/markdown/);
  });

  it("answers HEAD with headers and no body", async () => {
    const res = await handleRequest(req("/about", "text/markdown", "HEAD"), deps("/about"));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/markdown; charset=utf-8");
    expect(res.body).toBeNull();
  });

  it("falls back to HTML if the Markdown twin is missing from the deploy", async () => {
    const res = await handleRequest(
      req("/about", "text/markdown"),
      deps("/about", { missingAssets: true }),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/html");
  });

  it("passes non-GET methods straight through", async () => {
    const d = deps("/");
    await handleRequest(req("/", "text/markdown", "POST"), d);
    expect(d.next).toHaveBeenCalledOnce();
    expect(d.fetchAsset).not.toHaveBeenCalled();
  });
});

describe("handleRequest: real 404s", () => {
  it("returns 404 with a Markdown body for Markdown clients", async () => {
    const res = await handleRequest(req("/does-not-exist", "text/markdown"), deps("/x"));
    expect(res.status).toBe(404);
    expect(res.headers.get("Content-Type")).toBe("text/markdown; charset=utf-8");
    const body = await res.text();
    expect(body.length).toBeGreaterThan(20);
    expect(body).toContain("llms.txt");
  });

  it("uses a built-in Markdown body if /404.md is missing", async () => {
    const res = await handleRequest(
      req("/does-not-exist", "text/markdown"),
      deps("/x", { missingAssets: true }),
    );
    expect(res.status).toBe(404);
    expect(await res.text()).toContain("/llms.txt");
  });

  it("keeps the HTML 404 page for browsers", async () => {
    const res = await handleRequest(req("/does-not-exist", "text/html"), deps("/x"));
    expect(res.status).toBe(404);
    expect(res.headers.get("Content-Type")).toContain("text/html");
    expect(res.headers.get("Vary")).toBe("Accept");
  });

  it("does not touch existing non-page assets", async () => {
    const res = await handleRequest(req("/llms.txt", "text/markdown"), deps("/llms.txt"));
    expect(res.status).toBe(200);
  });
});
