# Accessibility

**Conformance target:** WCAG 2.2 Level AA.

## What was tested

- Automated: axe-core (`wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa`) on the home screen, live table, raise panel, showdown dialog, and static About / Contact / Privacy / 404 pages at 1440×900, 390×844 and 320×800.
- Manual: keyboard play (`F` fold, `C` check/call, `R`/`B` bet/raise, `A` all-in, `Enter` confirm / next hand, `P` pause, `Esc` leave showdown), focus order and visible focus, dialog focus trap and restore, skip links, landmarks, live-region announcements for turns / pot / outcomes, colour-independent action and net-chip cues (`+`/`−` and text labels), reflow at 320 px, `prefers-reduced-motion`, and pause for bot play and table motion.

## Known limitations

- Hole cards and board state are exposed with text alternatives (`aria-label` on cards and seats), but a screen-reader user still experiences a card game rather than a fully verbal strategy coach.
- Bot “thinking” pulse is decorative motion under 5 s per cycle; the Pause control stops bots and freezes that animation. Continuous decorative hero motion was removed so a separate pause control was not required on the landing page.
- Equity is computed in a worker; there is no separate live announcement of raw equity percentages (they are not shown in the UI).

## Report a barrier

Open an issue at https://github.com/KarthikSubramanian07/sir-bluffington/issues and describe the page, assistive technology, and what went wrong.
