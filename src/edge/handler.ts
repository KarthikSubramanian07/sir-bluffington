/**
 * Request handler behind functions/_middleware.ts, written against plain Fetch API types
 * so tests can drive it with fake `next()` and asset fetchers.
 */
import {
  FALLBACK_NOT_FOUND_MARKDOWN,
  MARKDOWN_CONTENT_TYPE,
  acceptsMarkdown,
  appendHeaderToken,
  canonicalUrl,
  markdownTwin,
  negotiate,
} from "./negotiate.ts";

/** Mirrors public/_headers so responses generated here carry the same policy. */
export const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Frame-Options": "DENY",
  "Permissions-Policy": "geolocation=(), microphone=(), camera=()",
  "Content-Security-Policy":
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; connect-src 'self'; worker-src 'self' blob:; frame-ancestors 'none'; base-uri 'self'; object-src 'none'",
};

export interface HandlerDeps {
  /** Continue to the static asset (Pages `context.next()`). */
  next: () => Promise<Response>;
  /** Fetch a static asset by absolute path, e.g. "/about.md" (Pages `env.ASSETS`). */
  fetchAsset: (path: string) => Promise<Response>;
}

function withHeaders(res: Response, patch: (h: Headers) => void): Response {
  const out = new Response(res.body, res);
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) {
    if (!out.headers.has(k)) out.headers.set(k, v);
  }
  patch(out.headers);
  return out;
}

function markdownResponse(
  body: string,
  status: number,
  method: string,
  extra: Record<string, string> = {},
): Response {
  const headers = new Headers({
    ...SECURITY_HEADERS,
    "Content-Type": MARKDOWN_CONTENT_TYPE,
    Vary: "Accept",
    "Cache-Control": "public, max-age=0, must-revalidate",
    ...extra,
  });
  return new Response(method === "HEAD" ? null : body, { status, headers });
}

export async function handleRequest(request: Request, deps: HandlerDeps): Promise<Response> {
  const method = request.method.toUpperCase();
  if (method !== "GET" && method !== "HEAD") return deps.next();

  const url = new URL(request.url);
  const accept = request.headers.get("Accept");
  const twin = markdownTwin(url.pathname);

  if (twin) {
    const representation = negotiate(accept);
    if (representation === "none") {
      return new Response(
        method === "HEAD"
          ? null
          : "406 Not Acceptable: this page is available as text/html or text/markdown.\n",
        {
          status: 406,
          headers: {
            ...SECURITY_HEADERS,
            "Content-Type": "text/plain; charset=utf-8",
            Vary: "Accept",
          },
        },
      );
    }
    if (representation === "markdown") {
      const asset = await deps.fetchAsset(twin);
      if (asset.ok) {
        return markdownResponse(await asset.text(), 200, method, {
          Link: `<${canonicalUrl(url.pathname)}>; rel="canonical"`,
        });
      }
      // Twin missing from the deploy: fall back to HTML rather than failing the page.
    }
    const res = await deps.next();
    return withHeaders(res, (h) => {
      h.set("Vary", appendHeaderToken(h.get("Vary"), "Accept"));
      h.append("Link", `<${twin}>; rel="alternate"; type="text/markdown"`);
    });
  }

  const res = await deps.next();
  if (res.status === 404) {
    if (acceptsMarkdown(accept)) {
      const asset = await deps.fetchAsset("/404.md");
      const body = asset.ok ? await asset.text() : FALLBACK_NOT_FOUND_MARKDOWN;
      return markdownResponse(body, 404, method);
    }
    return withHeaders(res, (h) => h.set("Vary", appendHeaderToken(h.get("Vary"), "Accept")));
  }
  return res;
}
