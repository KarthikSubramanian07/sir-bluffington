import { cardId, freshDeck } from "../engine/cards.ts";
import { type HandEvaluator, defaultEvaluator } from "../engine/handEval.ts";
import type { Rng } from "../engine/rng.ts";
import type { Card } from "../engine/types.ts";
import preflopTable from "./preflop-equity.json";

const PREFLOP: Record<string, number> = preflopTable as Record<string, number>;

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

/** Canonical 169-bucket code for two hole cards, e.g. "AKs", "AKo", "TT". */
export function canonicalPreflop(a: Card, b: Card): string {
  const [hi, lo] = a.rank >= b.rank ? [a, b] : [b, a];
  if (hi.rank === lo.rank) return `${RANK_CHAR[hi.rank]}${RANK_CHAR[lo.rank]}`;
  const suited = a.suit === b.suit ? "s" : "o";
  return `${RANK_CHAR[hi.rank]}${RANK_CHAR[lo.rank]}${suited}`;
}

/** Heads-up preflop equity vs a random hand, from the precomputed table (0..1). */
export function preflopEquity(hole: Card[]): number {
  if (hole.length !== 2) throw new Error("preflopEquity needs exactly 2 cards");
  const code = canonicalPreflop(hole[0]!, hole[1]!);
  return PREFLOP[code] ?? 0.5;
}

/**
 * Monte-Carlo equity: the fraction of showdowns hero wins (ties counted as fractional)
 * against `numOpponents` uniformly-random hands, completing the board over `iterations`
 * random rollouts (spec Section 05). Deterministic given the RNG seed.
 */
export function monteCarloEquity(
  hole: Card[],
  board: Card[],
  numOpponents: number,
  iterations: number,
  rng: Rng,
  evaluator: HandEvaluator = defaultEvaluator,
): number {
  if (numOpponents < 1) return 1;
  const known = new Set<string>([...hole, ...board].map(cardId));
  const stub = freshDeck().filter((c) => !known.has(cardId(c)));
  const boardNeeded = 5 - board.length;
  const drawCount = numOpponents * 2 + boardNeeded;

  let score = 0;
  for (let i = 0; i < iterations; i++) {
    const deck = stub.slice();
    // Partial Fisher-Yates draw of the cards we need this rollout.
    const drawn: Card[] = [];
    for (let k = 0; k < drawCount; k++) {
      const j = k + rng.int(deck.length - k);
      const tmp = deck[k]!;
      deck[k] = deck[j]!;
      deck[j] = tmp;
      drawn.push(deck[k]!);
    }
    const fullBoard = [...board, ...drawn.slice(numOpponents * 2)];
    const contenders = [{ playerId: "hero", holeCards: hole }];
    for (let o = 0; o < numOpponents; o++) {
      contenders.push({
        playerId: `opp${o}`,
        holeCards: [drawn[o * 2]!, drawn[o * 2 + 1]!],
      });
    }
    const winners = evaluator.winners(contenders, fullBoard);
    if (winners.includes("hero")) score += 1 / winners.length;
  }
  return score / iterations;
}

/**
 * Best available estimate of hero's equity given the current street. Uses the instant
 * preflop table when the board is empty, otherwise a Monte-Carlo rollout.
 */
export function estimateEquity(
  hole: Card[],
  board: Card[],
  numOpponents: number,
  rng: Rng,
  iterations = 300,
  evaluator: HandEvaluator = defaultEvaluator,
): number {
  if (board.length === 0) {
    // Preflop table is heads-up; approximate multiway by discounting for extra opponents
    // (equity of a given hand falls as more players can outdraw it).
    const heads = preflopEquity(hole);
    if (numOpponents <= 1) return heads;
    return heads ** Math.sqrt(Math.min(numOpponents, 4));
  }
  return monteCarloEquity(hole, board, Math.min(numOpponents, 4), iterations, rng, evaluator);
}
