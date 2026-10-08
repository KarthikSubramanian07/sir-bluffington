import { FOOTER_LINKS, SITE_NAME } from "../site.ts";

/** Footer shared by the app's landing page and the static About/Contact/Privacy pages. */
export function SiteFooter() {
  return (
    <footer className="home-footer">
      <span className="serif">{SITE_NAME}</span>
      <nav className="home-footer-links" aria-label="Site">
        {FOOTER_LINKS.map((l) => (
          <a key={l.href} href={l.href}>
            {l.label}
          </a>
        ))}
      </nav>
      <span className="home-footer-note">
        Play money only. Not gambling. A free poker practice tool with no account and no cost.
      </span>
    </footer>
  );
}
