import { describe, expect, it } from "vitest";
import { strToCard } from "../src/engine/cards.ts";
import { defaultEvaluator } from "../src/engine/handEval.ts";

describe("HandEvaluator wheel ace round-trip", () => {
  it("evaluates a wheel straight and parses pokersolver's low ace ('1') back to Ace", () => {
    // A2345 of mixed suits: the classic wheel. pokersolver may emit the low ace as "1s".
    const cards = ["As", "2h", "3d", "4c", "5s"].map(strToCard);
    const result = defaultEvaluator.evaluate(cards);
    expect(result.name.toLowerCase()).toMatch(/straight/);
    expect(result.cards).toHaveLength(5);
    // Every returned card must be a valid Card; the wheel ace must round-trip as rank 14.
    const ranks = result.cards.map((c) => c.rank).sort((a, b) => a - b);
    expect(ranks).toEqual([2, 3, 4, 5, 14]);
  });

  it("parses pokersolver ten ('10') and wheel ace ('1') card strings", () => {
    expect(strToCard("10h")).toEqual({ rank: 10, suit: "h" });
    expect(strToCard("1d")).toEqual({ rank: 14, suit: "d" });
  });
});
