import { Hand } from "pokersolver";
import { cardsToStr, strToCard } from "./cards.ts";
import type { Card } from "./types.ts";

/** The evaluated best 5-card hand for a set of 5-7 cards. */
export interface HandResult {
  /** Category name, e.g. "Full House", "Two Pair", "High Card". */
  name: string;
  /** Full description, e.g. "Two Pair, A's & K's". */
  descr: string;
  /** The five cards that make the best hand (may be board-only, i.e. "board plays"). */
  cards: Card[];
}

export interface RankedPlayer {
  playerId: string;
  holeCards: Card[];
}

/**
 * Thin interface over a proven 7-card evaluator so the implementation is swappable
 * (spec Section 04/09: "Use pokersolver or a proven evaluator. Do not hand-roll ranking").
 */
export interface HandEvaluator {
  /** Best 5-of-N from 5..7 cards. */
  evaluate(cards: Card[]): HandResult;
  /**
   * Given a shared board and each contender's hole cards, return the id(s) of the
   * player(s) holding the best hand. More than one id means a tie (split pot).
   */
  winners(contenders: RankedPlayer[], board: Card[]): string[];
}

/** Adapter backed by the `pokersolver` library. */
export class PokersolverEvaluator implements HandEvaluator {
  evaluate(cards: Card[]): HandResult {
    if (cards.length < 5 || cards.length > 7) {
      throw new Error(`evaluate expects 5-7 cards, got ${cards.length}`);
    }
    const solved = Hand.solve(cardsToStr(cards));
    return {
      name: solved.name,
      descr: solved.descr,
      cards: solved.cards.map((c) => strToCard(`${c.value}${c.suit}`)),
    };
  }

  winners(contenders: RankedPlayer[], board: Card[]): string[] {
    if (contenders.length === 0) return [];
    if (contenders.length === 1) return [contenders[0]!.playerId];

    // Solve each contender's best hand, keeping a stable link back to the player id.
    const solvedByPlayer = contenders.map((c) => ({
      playerId: c.playerId,
      hand: Hand.solve(cardsToStr([...c.holeCards, ...board])),
    }));

    const winningHands = Hand.winners(solvedByPlayer.map((s) => s.hand));
    // Hand.winners returns the same object references it was given; match by identity.
    const winningSet = new Set(winningHands);
    return solvedByPlayer.filter((s) => winningSet.has(s.hand)).map((s) => s.playerId);
  }
}

/** Shared default instance. */
export const defaultEvaluator: HandEvaluator = new PokersolverEvaluator();
