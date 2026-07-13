/**
 * Precompute the 169-bucket preflop equity table (spec Section 05/09).
 *
 * For every canonical starting hand (13 pairs + 78 suited + 78 offsuit = 169) we estimate
 * heads-up all-in equity vs a single uniformly-random hand by Monte-Carlo rollout, then
 * write it to src/ai/preflop-equity.json. This runs at build time so the bots' preflop
 * strength lookups are instant and deterministic at runtime.
 *
 * Run with: npm run gen:preflop
 */
import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
// pokersolver is CommonJS; use the default import so this runs under tsx (Node ESM).
import pokersolver from "pokersolver";
import { freshDeck } from "../src/engine/cards.ts";
import { makeRng } from "../src/engine/rng.ts";
import type { Card, Rank } from "../src/engine/types.ts";

const { Hand } = pokersolver;

// 4000 rollouts/bucket gives ~±0.008 equity accuracy, ample for rule-based bots, and
// keeps the whole 169-bucket build under ~2.5 minutes. The output is committed in-tree, so
// this only re-runs when intentionally regenerating the table.
const ITERATIONS = 4000;
const RANKS: Rank[] = [14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2];
const RANK_CHAR: Record<number, string> = {
  14: "A",
  13: "K",
  12: "Q",
  11: "J",
  10: "T",
  9: "9",
  8: "8",
  7: "7",
  6: "6",
  5: "5",
  4: "4",
  3: "3",
  2: "2",
};

function cardStr(c: Card): string {
  return `${RANK_CHAR[c.rank]}${c.suit}`;
}

/** Representative hole cards for a canonical bucket. */
function representative(hi: Rank, lo: Rank, suited: boolean): [Card, Card] {
  if (hi === lo)
    return [
      { rank: hi, suit: "s" },
      { rank: lo, suit: "h" },
    ];
  if (suited)
    return [
      { rank: hi, suit: "s" },
      { rank: lo, suit: "s" },
    ];
  return [
    { rank: hi, suit: "s" },
    { rank: lo, suit: "h" },
  ];
}

/** Canonical code, e.g. "AKs", "AKo", "TT". */
function code(hi: Rank, lo: Rank, suited: boolean): string {
  if (hi === lo) return `${RANK_CHAR[hi]}${RANK_CHAR[lo]}`;
  return `${RANK_CHAR[hi]}${RANK_CHAR[lo]}${suited ? "s" : "o"}`;
}

function equityVsRandom(hole: [Card, Card], rng: ReturnType<typeof makeRng>): number {
  const heroStrs = [cardStr(hole[0]), cardStr(hole[1])];
  const usedIds = new Set(heroStrs);
  const remaining = freshDeck().filter((c) => !usedIds.has(cardStr(c)));

  let score = 0;
  for (let i = 0; i < ITERATIONS; i++) {
    // Partial Fisher-Yates: draw 7 cards (2 opp + 5 board) from the remaining 50.
    const deck = remaining.slice();
    const drawn: Card[] = [];
    for (let k = 0; k < 7; k++) {
      const j = k + rng.int(deck.length - k);
      const tmp = deck[k]!;
      deck[k] = deck[j]!;
      deck[j] = tmp;
      drawn.push(deck[k]!);
    }
    const oppHole = [cardStr(drawn[0]!), cardStr(drawn[1]!)];
    const board = drawn.slice(2).map(cardStr);

    const heroHand = Hand.solve([...heroStrs, ...board]);
    const oppHand = Hand.solve([...oppHole, ...board]);
    const winners = Hand.winners([heroHand, oppHand]);
    if (winners.length === 2) score += 0.5;
    else if (winners[0] === heroHand) score += 1;
  }
  return score / ITERATIONS;
}

function main(): void {
  const table: Record<string, number> = {};
  const rng = makeRng(0x5eed_1234); // fixed seed -> deterministic table
  let done = 0;
  for (let i = 0; i < RANKS.length; i++) {
    for (let j = i; j < RANKS.length; j++) {
      const hi = RANKS[i]!;
      const lo = RANKS[j]!;
      if (hi === lo) {
        table[code(hi, lo, false)] = round(equityVsRandom(representative(hi, lo, false), rng));
        done++;
      } else {
        table[code(hi, lo, true)] = round(equityVsRandom(representative(hi, lo, true), rng));
        table[code(hi, lo, false)] = round(equityVsRandom(representative(hi, lo, false), rng));
        done += 2;
      }
      process.stdout.write(`\r  computed ${done}/169 buckets`);
    }
  }
  process.stdout.write("\n");

  const __dirname = dirname(fileURLToPath(import.meta.url));
  const out = resolve(__dirname, "../src/ai/preflop-equity.json");
  writeFileSync(out, `${JSON.stringify(table, null, 0)}\n`);
  console.log(`Wrote ${Object.keys(table).length} buckets to ${out}`);
}

function round(x: number): number {
  return Math.round(x * 1000) / 1000;
}

main();
