<div align="center">

# ♠ Sir Bluffington's Poker

**A free, browser-based No-Limit Hold'em trainer with five distinct AI opponents.**

Play against hand-tuned personalities, from the nitty *Rock* to the monocled boss himself. No account, no download, no money.

[**▶ Play it**](https://sirbluffington.pages.dev) · [Decisions](DECISIONS.md) · [Setup](SETUP.md)

</div>

## Why this exists

There isn't a good single-player poker trainer on the open web. The options are multiplayer rooms (you need friends and a schedule), paid GTO tools (a subscription and a learning curve), or mobile apps (an install). This one opens in a tab: sit down, play hands, and practice against opponents you can read.

The five bots each have their own leaks. You learn by exploiting them, which is the skill that actually transfers, rather than by memorizing a chart.

## Meet the table

| Bot | Style | How to beat it |
| --- | --- | --- |
| **The Rock** | Folds unless he has a premium hand | Steal his blinds and fold when he finally raises. |
| **The Calling Station** | Calls almost anything, rarely raises | Value bet relentlessly and never bluff her. |
| **The Maniac** | Raises constantly, bluffs often | Wait for a real hand and let him pay you off. |
| **The Shark** | Balanced, positional, patient | The tough one. Respect his aggression. |
| **Sir Bluffington** | Adaptive, tricky, and full of it | The boss. He bluffs, he adjusts, he levels you. |

Each decision is a rule-based function of hand equity, pot odds, position, and personality, with a little noise so the bots can't be beaten by rote. There is no LLM, no server, and no latency. See [how the AI works](DECISIONS.md#the-bots-are-rule-based).

## Features

- **Full No-Limit Hold'em.** Heads-up, 6-max, or full ring. Cash or escalating-blind (tournament) structure.
- **A correct engine.** Multiway side pots, the min-raise "no-reopen" rule, the heads-up button exception, and split pots with odd-chip distribution, all verified by tests.
- **Post-hand review.** Every showdown reveals the bots' cards, the pot distribution including each side pot, and a one-line reason for the notable plays.
- **Live equity** from Monte-Carlo rollouts, computed in a web worker so the table stays smooth.
- **Stats that persist.** Hands played, showdown win rate, biggest pot, net chips, and your record against each bot, stored in your browser.
- **Keyboard-first.** `F` fold, `C` check/call, `R` raise, `Enter` to confirm and to deal the next hand.
- Dark, engineered UI. Four-color or two-color deck. Reduced-motion respected.

## Pot math

Side pots are the part most poker engines get wrong, so they are the acceptance test here. The [side-pot layering](src/engine/sidepots.ts) and [showdown award](src/engine/showdown.ts) were written test-first against the spec's matrix, and chip conservation is fuzz-tested across 400 random hands:

```
3-way all-in, three stack sizes, main plus two side pots
uncalled overbet returned to its owner
all-in call for less than a full raise
short all-in does NOT reopen betting (the classic bug)
heads-up: button posts the small blind and acts first preflop
split side pot with the odd chip to the first seat left of the button
chip conservation across 400 random hands of 2 to 9 players
```

40+ tests, zero pot-math errors.

## Run it locally

Requires Node 20+.

```bash
npm install
npm run dev          # http://localhost:5173
```

No env file, no keys, no services. The app is entirely client-side.

Other scripts:

```bash
npm test             # run the Vitest suite
npm run check        # typecheck, lint, test
npm run build        # production build to dist/
npm run gen:preflop  # regenerate the 169-bucket preflop equity table (only when re-tuning)
```

## Deploy

The build is static files, so any static host works. For [Cloudflare Pages](https://pages.cloudflare.com) (free, zero egress):

```bash
npm run deploy       # builds, then runs `wrangler pages deploy`
```

Full walkthrough in [SETUP.md](SETUP.md). It lands at `https://<project>.pages.dev` with no origin server.

## How it's built

```
src/
  engine/    Pure NLHE rules: cards, betting state machine, side pots, showdown, hand loop
  ai/        Personalities, preflop equity table, Monte-Carlo, decision function, worker
  game/      Runtime controller, localStorage stats/config, React hook (the only stateful layer)
  ui/        React components: felt table, seats, action bar, post-hand review, mascot, cards
  styles/    Design tokens and base styles
test/        Vitest suite: engine correctness, AI distinctness, full-session integration
```

**Stack:** React, TypeScript (strict), Vite. [`pokersolver`](https://github.com/goldfire/pokersolver) (MIT) handles hand ranking behind a swappable interface. The betting engine, side-pot math, and the bots are original and deterministic. Biome for lint and format, Vitest for tests, GitHub Actions for CI. The full rationale, including the adopt-vs-build audit, is in [DECISIONS.md](DECISIONS.md).

## Not gambling

Play money only. No real currency, no purchasable chips, no accounts, no data collection. Poker and "Texas Hold'em" are generic; the bots and art are original.

## License

MIT, see [LICENSE](LICENSE). `pokersolver` is MIT.
