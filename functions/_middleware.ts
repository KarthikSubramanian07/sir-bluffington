/**
 * Cloudflare Pages middleware: Markdown content negotiation on every HTML page and real
 * 404s (Markdown for agents, HTML for browsers). All logic lives in src/edge so it is
 * unit-tested; this file only adapts the Pages context. Static assets under /assets/*
 * skip the Function entirely (see public/_routes.json).
 */
import { handleRequest } from "../src/edge/handler.ts";

interface PagesContext {
  request: Request;
  next: () => Promise<Response>;
  env: { ASSETS: { fetch: (input: Request | string | URL) => Promise<Response> } };
}

export const onRequest = (context: PagesContext): Promise<Response> =>
  handleRequest(context.request, {
    next: () => context.next(),
    fetchAsset: (path) => context.env.ASSETS.fetch(new URL(path, context.request.url)),
  });
