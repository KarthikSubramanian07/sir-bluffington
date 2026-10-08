# About Sir Bluffington's Poker

> Sir Bluffington's Poker is a free, open-source No-Limit Texas Hold'em trainer. You play against five AI opponents with distinct, readable personalities, directly in your browser.

## Why it exists

There isn't a good single-player poker trainer on the open web. The usual options are multiplayer rooms, where you need friends and a schedule; paid solver tools, which come with a subscription and a steep learning curve; or mobile apps, which need an install. Sir Bluffington's Poker opens in a browser tab. You sit down, play hands, and practise against opponents you can learn to read.

The five bots each have their own leaks. You improve by spotting and exploiting them, which is the skill that actually transfers to real games, rather than by memorising a chart.

## How the AI works

Every bot decision is a rule-based function of four inputs: hand equity (from a precomputed 169-hand preflop table and Monte-Carlo rollouts after the flop), pot odds, table position, and the bot's personality parameters (how often it plays a hand, how often it raises, and how aggressive it is). A small amount of noise keeps the bots from being beaten by rote. There is no large language model, no server, and no network call while you play.

## How it is built

The game is a static web app written in TypeScript and React, built with Vite, and hosted on Cloudflare Pages. The betting engine, the side-pot maths, and the bots are original and covered by an automated test suite, including a chip-conservation fuzz test across hundreds of random hands. Hand ranking uses the MIT-licensed `pokersolver` library. The full source code, design decisions, and setup guide are public on [GitHub](https://github.com/KarthikSubramanian07/sir-bluffington) under the MIT license.

## What it is not

It is not a gambling site. There is no real money, no purchasable chips, no prizes, and no accounts. It is a practice tool for learning poker strategy.

## More

- [Play the game](https://sirbluffington.pages.dev/)
- [Contact](https://sirbluffington.pages.dev/contact)
- [Privacy](https://sirbluffington.pages.dev/privacy)
- [llms.txt for AI agents](https://sirbluffington.pages.dev/llms.txt)
