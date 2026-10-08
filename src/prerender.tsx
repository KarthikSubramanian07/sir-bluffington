/**
 * Build-time server rendering (used by scripts/build-pages.ts through Vite's SSR loader).
 * The landing page is rendered with the default config and inlined into dist/index.html,
 * so crawlers and agents that do not run JavaScript still read the real homepage copy.
 * The client then mounts over it with createRoot (main.tsx), so saved settings still win.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { App } from "./ui/App.tsx";
import { SiteFooter } from "./ui/SiteFooter.tsx";
import { Wordmark } from "./ui/Wordmark.tsx";

export function renderApp(): string {
  return renderToStaticMarkup(<App />);
}

/** Header and footer markup for the static About/Contact/Privacy/404 pages. */
export function renderChrome(): { header: string; footer: string } {
  const header = renderToStaticMarkup(
    <header className="home-nav">
      <a href="/" aria-label="Sir Bluffington's Poker home" className="doc-brand">
        <Wordmark />
      </a>
      <a className="home-nav-link" href="/">
        Play now →
      </a>
    </header>,
  );
  return { header, footer: renderToStaticMarkup(<SiteFooter />) };
}
