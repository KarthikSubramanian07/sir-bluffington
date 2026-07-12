import type { Rng } from "./rng.ts";
import type { Card, Rank, Suit } from "./types.ts";

export const SUITS: readonly Suit[] = ["c", "d", "h", "s"];
export const RANKS: readonly Rank[] = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];

const RANK_TO_CHAR: Record<Rank, string> = {
  2: "2",
  3: "3",
  4: "4",
  5: "5",
  6: "6",
  7: "7",
  8: "8",
  9: "9",
  10: "T",
  11: "J",
  12: "Q",
  13: "K",
  14: "A",
};

const CHAR_TO_RANK: Record<string, Rank> = {
  // "1" and "10" are how pokersolver renders the wheel-low ace and the ten respectively;
  // accepted here so we can parse the evaluator's output back into our Card type.
  "1": 14,
  "10": 10,
  "2": 2,
  "3": 3,
  "4": 4,
  "5": 5,
  "6": 6,
  "7": 7,
  "8": 8,
  "9": 9,
  T: 10,
  J: 11,
  Q: 12,
  K: 13,
  A: 14,
};

/** A fresh, ordered 52-card deck. */
export function freshDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ rank, suit });
    }
  }
  return deck;
}

/**
 * Fisher-Yates shuffle using the supplied RNG. Returns a NEW array; does not mutate input.
 * Determinism comes entirely from the RNG seed.
 */
export function shuffle(cards: readonly Card[], rng: Rng): Card[] {
  const out = cards.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = rng.int(i + 1);
    const a = out[i]!;
    const b = out[j]!;
    out[i] = b;
    out[j] = a;
  }
  return out;
}

/** A shuffled 52-card deck from a seeded RNG. */
export function shuffledDeck(rng: Rng): Card[] {
  return shuffle(freshDeck(), rng);
}

/** Two-character string for pokersolver, e.g. {rank:14,suit:'s'} -> "As", {10,'h'} -> "Th". */
export function cardToStr(card: Card): string {
  return `${RANK_TO_CHAR[card.rank]}${card.suit}`;
}

/** Parse a pokersolver-style two-char string, e.g. "As" -> {rank:14,suit:'s'}. */
export function strToCard(str: string): Card {
  const rankChar = str.slice(0, -1);
  const suitChar = str.slice(-1) as Suit;
  const rank = CHAR_TO_RANK[rankChar];
  if (rank === undefined || !SUITS.includes(suitChar)) {
    throw new Error(`Invalid card string: "${str}"`);
  }
  return { rank, suit: suitChar };
}

export function cardsToStr(cards: readonly Card[]): string[] {
  return cards.map(cardToStr);
}

/** Stable identity string for a card, useful as a map/set key. */
export function cardId(card: Card): string {
  return cardToStr(card);
}

export function cardsEqual(a: Card, b: Card): boolean {
  return a.rank === b.rank && a.suit === b.suit;
}
