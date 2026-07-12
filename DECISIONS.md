# Architecture & Decisions

Why the code looks the way it does — the choices, the trade-offs, and where money would start (spoiler: it doesn't).

## Cost boundary: genuinely $0, forever

This is a **pure client-side app**. No backend, no database, no auth, no accounts, no API keys. The engine, the bots, and the equity math all run in the browser; the only persisted state is stats + config in `localStorage`. The build is static files served by **Cloudflare Pages** (free tier, unlimited requests, zero egress).

There are **no paid external dependencies**, so the standing "isolate every paid dependency behind a mock adapter" rule is satisfied trivially — there is nothing to mock. With no keys set (there are no keys), the app runs fully and the entire test suite passes. The only conceivable cost is a custom domain, and even that is optional (`*.pages.dev` is free).

### Substitutions from the spec's tech section

The spec's Section 09 lists "Cloudflare Pages / GitHub Pages / Vercel free." Per the standing build rules, anything with a fixed monthly floor or egress bill is out:

| Spec suggested | Used instead | Why |
| --- | --- | --- |
| Vercel (free) | **Cloudflare Pages** | No egress billing, no per-project ceiling, truly $0 at scale |
| (implicit build host) | Static build only | There is no server to run |

## Reuse vs. build — the OSS audit

Per the directive to adopt proven OSS wherever it beats hand-rolling, each core component was evaluated:

### Hand evaluation → **adopted `pokersolver`** (MIT)

7-card hand ranking (kickers, board-plays, split-pot detection) is a solved problem with subtle edge cases. `pokersolver` is MIT-licensed, browser-ready, zero-dependency, and — critically — ships `Hand.winners()`, which returns *all* tied hands, so split pots fall out for free. It's wrapped behind a thin [`HandEvaluator`](src/engine/handEval.ts) interface so the implementation is swappable. We ship a ~25-line hand-written `.d.ts` since there's no `@types/pokersolver`.

Alternatives considered: `phe` (frozen since 2018, no tie helper — you'd rebuild split logic), `poker-evaluator` (~130 MB Two-Plus-Two table, Node-only `fs` — disqualified for the browser).

> One sharp edge worth documenting: pokersolver renders the wheel's low ace as the string `"1"` and a ten as `"10"`. Our card parser accepts both so the evaluator's output round-trips back into our `Card` type. There's a test for the wheel.

### The NLHE betting engine + side pots → **built from scratch** (test-first)

The most-researched decision. The mature candidate was **`poker-ts`** (MIT, actively maintained, typed, correct multiway side pots). We read its source. It was **not** adopted, for two reasons that are precisely the spec's acceptance criteria:

1. **It implements the incomplete-all-in rule incorrectly.** In `poker-ts`, every raise — including a short all-in for *less* than a full raise — unconditionally advances the min-raise and reopens the betting to players who already acted. Correct NLHE: a sub-minimum all-in raises the price but does **not** reopen the action. This is the exact bug the spec flags ("All-in for less than a full raise does NOT reopen betting — track this"), and it's the product's headline correctness requirement.
2. **No deterministic deck seeding through its public API**, so the spec's exact side-pot test matrix couldn't be driven reproducibly.

Since the reopen rule and deterministic pot-math tests *are* the Definition of Done, we own the engine. It's built as **pure functions** over an authoritative [`GameState`](src/engine/types.ts):

- [`betting.ts`](src/engine/betting.ts) — legal-action computation, the min-raise no-reopen rule (via a monotonic `aggressionLevel` counter that only advances on full raises), round-end detection.
- [`sidepots.ts`](src/engine/sidepots.ts) — layered pot construction, the hardest logic, tested against the spec's exact matrix.
- [`showdown.ts`](src/engine/showdown.ts) — independent per-pot award with odd-chip-to-first-left-of-button.
- [`hand.ts`](src/engine/hand.ts) — blind posting, the heads-up exception (button posts SB and acts first preflop), street progression.
- [`game.ts`](src/engine/game.ts) — orchestration (deal → streets → run-out → settle).

Chip conservation is fuzz-tested across **400 random hands** of varying table sizes and a scripted multiway all-in verifies exact side-pot payouts.

### Seeded RNG → **built** (`mulberry32`, ~7 lines)

A tiny, dependency-free, deterministic generator beats pulling `seedrandom` + its separate `@types`. Determinism matters for reproducible tests and Monte-Carlo rollouts. See [`rng.ts`](src/engine/rng.ts).

### Card art → **built minimal SVG** (not a deck library)

Evaluated `@letele/playing-cards` (CC0 React components) and the David Bellot `svg-cards` sprite (LGPL — copyleft, avoided). Chose a **custom minimal SVG card** instead: for this Offsuit-inspired, tech-minimal aesthetic, clean corner-index cards read better than realistic court art, and it gives full control over the four-color/two-color toggle, the gold palette, and the monocle card back — the brand's signature. Card *rendering* is presentation, not the risky ranking logic (that's what we reuse pokersolver for).

## The bots are rule-based on purpose

Per the spec (Section 05) and the project direction, there is **no LLM**. An LLM would add cost, latency, and non-determinism to a $0 offline trainer. The five personalities are parameterized decision functions ([`personalities.ts`](src/ai/personalities.ts) + [`decide.ts`](src/ai/decide.ts)) tuned so they're *exploitable but not trivial*:

- Preflop selection is gated by VPIP/PFR against a precomputed **169-bucket equity table** ([`gen-preflop.ts`](scripts/gen-preflop.ts), committed as JSON — deterministic, fixed seed).
- Postflop uses **Monte-Carlo rollout** (200–320 iterations), run in a **web worker** so the table never janks.
- Every threshold carries **±10% noise** so bots can't be beaten by pure pattern memorization.

Personality distinctness (Rock tighter than Shark tighter than Maniac; Calling Station limps but rarely raises) is asserted by tests that measure emergent VPIP/PFR over thousands of simulated hands.

## Engineering standards

- **TypeScript strict** everywhere (`strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`, …).
- Pure, I/O-free core logic separated from React and the runtime controller.
- **Vitest** — 37 tests: side pots, betting legality/reopen rule, heads-up order, showdown award, a chip-conservation fuzz, AI distinctness/determinism, and a full-session controller integration test.
- **Biome** for lint + format; **lefthook** pre-commit (typecheck + lint) and pre-push (test).
- **GitHub Actions** CI: typecheck, lint, test, build.
- All state changes flow through pure engine functions; the [`GameController`](src/game/controller.ts) is the only stateful, async, I/O-touching layer.

## IP / legal

Poker and "Texas Hold'em" are generic/public-domain. No branded marks (WSOP, PokerStars). Original bot names. Play-money only, no purchasable chips → not gambling. `pokersolver` is MIT; the SVG cards are original.
