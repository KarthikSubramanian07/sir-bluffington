/**
 * Post-build step (runs after `vite build`):
 *   1. Prerenders the landing page into dist/index.html so it has real content without JS.
 *   2. Renders content/{about,contact,privacy,404}.md into static HTML pages.
 *   3. Copies every content/*.md into dist/ as the Markdown twin of its page, which the
 *      Pages middleware serves for `Accept: text/markdown`.
 */
import { readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createServer } from "vite";
import { extractHeadAssets, injectPrerender, renderDocPage } from "./lib/pages.ts";

const root = join(import.meta.dirname, "..");
const dist = join(root, "dist");
const content = join(root, "content");

const vite = await createServer({
  root,
  logLevel: "error",
  appType: "custom",
  server: { middlewareMode: true, hmr: false },
  // pokersolver is CommonJS with named imports; let Vite transform it instead of Node.
  ssr: { noExternal: ["pokersolver"] },
});

try {
  const { renderApp, renderChrome } = (await vite.ssrLoadModule("/src/prerender.tsx")) as {
    renderApp: () => string;
    renderChrome: () => { header: string; footer: string };
  };

  const indexPath = join(dist, "index.html");
  const builtIndex = await readFile(indexPath, "utf8");
  await writeFile(indexPath, injectPrerender(builtIndex, renderApp()));

  const shell = { headAssets: extractHeadAssets(builtIndex), ...renderChrome() };
  const files = (await readdir(content)).filter((f) => f.endsWith(".md"));
  for (const file of files) {
    const slug = file.replace(/\.md$/, "");
    const markdown = await readFile(join(content, file), "utf8");
    await writeFile(join(dist, file), markdown);
    if (slug !== "index") {
      await writeFile(join(dist, `${slug}.html`), renderDocPage({ slug, markdown }, shell));
    }
  }
  console.log(`build-pages: prerendered index.html, wrote ${files.length} Markdown twins`);
} finally {
  await vite.close();
}
