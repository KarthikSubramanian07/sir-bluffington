# Sir Bluffington's Poker: a free poker trainer where you play No-Limit Hold'em against AI

> Practice poker against opponents with personality. Sir Bluffington's Poker is a free, single-player No-Limit Texas Hold'em trainer that runs in your browser. You play against five hand-tuned AI characters, with no account, no download, and no real money.

[Play now](https://sirbluffington.pages.dev/) · [About](https://sirbluffington.pages.dev/about) · [Contact](https://sirbluffington.pages.dev/contact) · [Privacy](https://sirbluffington.pages.dev/privacy) · [llms.txt](https://sirbluffington.pages.dev/llms.txt)

## What it is

Sir Bluffington's Poker is a free online poker trainer for practising No-Limit Texas Hold'em against the computer. Most poker sites are multiplayer or cost money. This one is single-player, instant, and built for reps. Each bot is a hand-tuned character rather than a faceless AI, so you learn to read tendencies, adjust your ranges, and exploit specific mistakes, the way you would against real opponents. Play as many hands as you like. Your stats persist in your browser. There is no sign-up, there are no chips to buy, and it is not gambling.

## Table setup

- **Table size:** heads-up (1 v 1), 6-max (5 bots), or full ring (8 bots).
- **Starting stack:** 100, 200, 500, or 1,000 chips.
- **Blinds:** 1/2, 2/5, 5/10, or 25/50.
- **Blind structure:** cash (fixed blinds) or tournament (blinds escalate every 10 or 20 hands).
- **Deck:** four-color or two-color.

## The opponents

| Bot | Style | VPIP | PFR | Aggression | How to beat it |
| --- | --- | --- | --- | --- | --- |
| The Rock | Folds unless he's holding the nuts. | 15 | 12 | 30 | Steal his blinds and fold when he finally raises. |
| The Calling Station | Never met a bet she didn't call. | 55 | 10 | 20 | Value bet relentlessly and never bluff her. |
| The Maniac | Raises now, thinks never. | 60 | 45 | 90 | Wait for a real hand and let him pay you off. |
| The Shark | Balanced, positional, patient. | 28 | 22 | 70 | The tough one. Respect his aggression. |
| Sir Bluffington | The monocled menace, tricky and bluff-heavy. | 35 | 30 | 75 | The boss. He bluffs and levels you. |

Each bot decision is a rule-based function of hand equity, pot odds, position, and personality, with a little noise. There is no LLM, no server, and no latency.

## Features

- Full No-Limit Hold'em rules, including multiway side pots, the min-raise "no-reopen" rule, the heads-up button exception, and split pots with odd-chip distribution.
- A post-hand review that reveals the bots' cards, the pot distribution including each side pot, and a one-line reason for notable plays.
- Live equity from Monte-Carlo rollouts, computed in a web worker.
- Persistent stats: hands played, showdown win rate, biggest pot, net chips, and your record against each bot.
- Keyboard controls: `F` fold, `C` check or call, `R` raise, `Enter` to confirm and deal the next hand.

## Not gambling

Play money only. No real currency, no purchasable chips, no accounts, and no data collection. The source code is MIT-licensed on [GitHub](https://github.com/KarthikSubramanian07/sir-bluffington).
