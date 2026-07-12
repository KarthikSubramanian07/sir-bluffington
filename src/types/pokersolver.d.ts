/**
 * Minimal ambient types for `pokersolver` (no official @types package).
 * We only use the small surface documented below, all behind our HandEvaluator adapter.
 * https://github.com/goldfire/pokersolver
 */
declare module "pokersolver" {
  export class Hand {
    /** Human-readable category, e.g. "Full House", "Two Pair". */
    name: string;
    /** Full description, e.g. "Two Pair, A's & K's". */
    descr: string;
    /** Higher is better. Used for comparing categories. */
    rank: number;
    /** The 5 cards forming the best hand. */
    cards: Array<{ value: string; suit: string; toString(): string }>;

    /** Build the best hand from 5-7 card strings like ["As","Kd",...]. */
    static solve(cards: string[]): Hand;

    /**
     * Returns the winning hand(s) from a list. If multiple hands tie for best,
     * all tied hands are returned (used to detect split pots).
     */
    static winners(hands: Hand[]): Hand[];
  }

  const pokersolver: { Hand: typeof Hand };
  export default pokersolver;
}
