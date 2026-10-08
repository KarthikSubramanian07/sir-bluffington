/**
 * Site-level facts shared by the app, the build-time page generator, and the Pages
 * middleware. One place to change the canonical origin or the public contact channel.
 */
export const SITE_URL = "https://sirbluffington.pages.dev";
export const SITE_NAME = "Sir Bluffington's Poker";
export const REPO_URL = "https://github.com/KarthikSubramanian07/sir-bluffington";
export const ISSUES_URL = `${REPO_URL}/issues`;

/**
 * HTML pages that also have a Markdown twin at `<path>.md` (the homepage uses `/index.md`).
 * Agents get the twin by sending `Accept: text/markdown` to the HTML URL.
 */
export const PAGES = [
  { path: "/", markdown: "/index.md", title: "Home" },
  { path: "/about", markdown: "/about.md", title: "About" },
  { path: "/contact", markdown: "/contact.md", title: "Contact" },
  { path: "/privacy", markdown: "/privacy.md", title: "Privacy" },
] as const;

/** Links shown in the footer of every page (HTML and Markdown). */
export const FOOTER_LINKS = [
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
  { href: "/privacy", label: "Privacy" },
  { href: "/llms.txt", label: "llms.txt" },
] as const;
