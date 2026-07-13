# Architecture & Decisions

The choices behind the code: what was reused, what was built, and where money would start (it doesn't).

## Cost boundary: $0

This is a pure client-side app. There is no backend, database, auth, account system, or API key. The engine, the bots, and the equity math all run in the browser; the only persisted state is stats and config in `localStorage`. The build is static files served by [Cloudflare Pages](https://pages.cloudflare.com) on the free tier, which has unlimited requests and zero egress cost.

There are no paid external dependencies, so the "isolate every paid dependency behind a mock adapter" rule is satisfied by default: there is nothing to mock. With no keys set (there are none), the app runs fully and the test suite passes. The only possible cost is a custom domain, and even that is optional because `*.pages.dev` is free.

### Substitutions from the spec's tech section

Section 09 of the spec lists "Cloudflare Pages / GitHub Pages / Vercel free." Anything with a fixed monthly floor or an egress bill is out:

| Spec suggested | Used instead | Why |
| --- | --- | --- |
| Vercel (free) | Cloudflare Pages | No egress billing, no per-project ceiling, $0 at scale |
| (a build host) | Static build only | There is no server to run |

## Reuse vs. build: the OSS audit

Each core component was evaluated against proven open source before writing anything.

### Hand evaluation: adopted `pokersolver` (MIT)

Seven-card hand ranking (kickers, board-plays, split-pot detection) is a solved problem with subtle edge cases. `pokersolver` is MIT-licensed, browser-ready, zero-dependency, and ships `Hand.winners()`, which returns all tied hands, so split pots fall out for free. It sits behind a thin [`HandEvaluator`](src/engine/handEval.ts) interface so the implementation is swappable. A short hand-written `.d.ts` covers the types, since there is no `@types/pokersolver`.

Alternatives considered: `phe` (frozen since 2018, no tie helper, so you would rebuild the split logic), and `poker-evaluator` (a 130 MB Two-Plus-Two table, Node-only `fs`, ruled out for the browser).

> One sharp edge: pokersolver renders the wheel's low ace as the string `"1"` and a ten as `"10"`. The card parser accepts both so the evaluator's output round-trips back into the `Card` type. There is a test for the wheel.

### The NLHE betting engine and side pots: built, test-first

This was the most-researched decision. The mature candidate was `poker-ts` (MIT, maintained, typed, with multiway side pots). Its source was read. It was not adopted, for two reasons that are precisely the acceptance criteria:

1. **It implements the incomplete-all-in rule incorrectly.** In `poker-ts`, every raise, including a short all-in for less than a full raise, unconditionally advances the min-raise and reopens the betting to players who already acted. Correct NLHE: a sub-minimum all-in raises the price but does not reopen the action. This is the bug the spec flags ("All-in for less than a full raise does NOT reopen betting"), and it is the product's headline correctness requirement.
2. **No deterministic deck seeding through its public API**, so the spec's side-pot matrix could not be driven reproducibly.

Since the reopen rule and deterministic pot-math tests are the Definition of Done, the engine is original. It is built as pure functions over an authoritative [`GameState`](src/engine/types.ts):

- [`betting.ts`](src/engine/betting.ts): legal-action computation, the min-raise no-reopen rule (a monotonic `aggressionLevel` counter that advances only on full raises), and round-end detection.
- [`sidepots.ts`](src/engine/sidepots.ts): layered pot construction, the hardest logic, tested against the spec's matrix.
- [`showdown.ts`](src/engine/showdown.ts): independent per-pot award, with odd chips going to the first seat left of the button.
- [`hand.ts`](src/engine/hand.ts): blind posting, the heads-up exception (button posts the small blind and acts first preflop), and street progression.
- [`game.ts`](src/engine/game.ts): orchestration from deal through streets and run-out to settlement.

Chip conservation is fuzz-tested across 400 random hands of varying table sizes, and a scripted multiway all-in verifies exact side-pot payouts.

### Seeded RNG: built (`mulberry32`, ~7 lines)

A tiny, dependency-free, deterministic generator beats pulling `seedrandom` plus its separate `@types`. Determinism matters for reproducible tests and Monte-Carlo rollouts. See [`rng.ts`](src/engine/rng.ts).

### Card art: built as minimal SVG, not a deck library

`@letele/playing-cards` (CC0 React components) and the David Bellot `svg-cards` sprite (LGPL, avoided) were evaluated. A custom minimal SVG card was chosen instead. For this Offsuit-inspired, tech-minimal look, clean corner-index cards read better than realistic court art, and building them gives full control over the four-color and two-color toggle, the gold palette, and the monocle card back that is the brand's signature. Card rendering is presentation, not the risky ranking logic, and the ranking logic is what `pokersolver` covers.

## The bots are rule-based

Per the spec (Section 05), there is no LLM. An LLM would add cost, latency, and non-determinism to a $0 offline trainer. The five personalities are parameterized decision functions ([`personalities.ts`](src/ai/personalities.ts) and [`decide.ts`](src/ai/decide.ts)), tuned to be exploitable but not trivial:

- Preflop selection gates on VPIP and PFR against a precomputed 169-bucket equity table ([`gen-preflop.ts`](scripts/gen-preflop.ts), committed as JSON, deterministic with a fixed seed).
- Postflop uses a Monte-Carlo rollout (200 to 320 iterations) run in a web worker so the table stays smooth.
- Every threshold carries ±10% noise, so the bots cannot be beaten by pure pattern memorization.

Personality distinctness (the Rock tighter than the Shark, the Shark tighter than the Maniac; the Calling Station limps but rarely raises) is asserted by tests that measure emergent VPIP and PFR over thousands of simulated hands.

## Engineering standards

- TypeScript strict everywhere (`strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`, and the rest).
- Pure, I/O-free core logic, kept separate from React and from the runtime controller.
- Vitest, 38 tests: side pots, betting legality and the reopen rule, heads-up order, showdown award, a chip-conservation fuzz, AI distinctness and determinism, and a full-session controller integration test.
- Biome for lint and format. Lefthook runs pre-commit (typecheck, lint) and pre-push (test).
- GitHub Actions CI: typecheck, lint, test, build.
- All state changes flow through pure engine functions. The [`GameController`](src/game/controller.ts) is the only stateful, async, I/O-touching layer.

## IP and legal

Poker and "Texas Hold'em" are generic and public-domain. No branded marks (WSOP, PokerStars). The bot names are original. Play-money only, with no purchasable chips, so it is not gambling. `pokersolver` is MIT; the SVG cards are original.
