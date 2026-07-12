import { describe, expect, it } from "vitest";
import { strToCard } from "../src/engine/cards.ts";
import { defaultEvaluator } from "../src/engine/handEval.ts";
import { type Contender, settleShowdown } from "../src/engine/showdown.ts";

const board = (...cs: string[]) => cs.map(strToCard);

const player = (
  playerId: string,
  seatIndex: number,
  cards: string[],
  committedTotal: number,
  inHand = true,
): Contender => ({
  playerId,
  seatIndex,
  holeCards: [strToCard(cards[0]!), strToCard(cards[1]!)],
  committedTotal,
  inHand,
});

describe("settleShowdown", () => {
  it("awards a simple heads-up pot to the best hand", () => {
    const contenders = [
      player("A", 0, ["Ah", "Ad"], 100), // pair of aces
      player("B", 1, ["Kh", "Kd"], 100), // pair of kings
    ];
    const res = settleShowdown(
      contenders,
      board("2c", "7d", "9s", "Jh", "3c"),
      0,
      2,
      defaultEvaluator,
    );
    expect(res.winningsByPlayer).toEqual({ A: 200 });
    expect(res.awards[0]!.handName).toBe("Pair");
  });

  it("splits a tied pot and gives the odd chip to the first seat left of the button", () => {
    // Two players tie playing the board's broadway straight (equal contributions). A dead
    // chip from a folded dealer makes the pot odd (101), so exactly one odd chip exists.
    const contenders = [
      player("DEALER", 0, ["7c", "8d"], 1, false), // folded button; 1 dead chip
      player("A", 1, ["2c", "3d"], 50),
      player("B", 2, ["4c", "5d"], 50),
    ];
    // Board A K Q J T -> A and B both play the straight (board plays). Pot = 101.
    // Button is seat 0; first live seat to its left is seat 1 (A) -> A gets the odd chip.
    const res = settleShowdown(
      contenders,
      board("Ah", "Kh", "Qs", "Jd", "Tc"),
      0,
      3,
      defaultEvaluator,
    );
    expect(res.winningsByPlayer).toEqual({ A: 51, B: 50 });
  });

  it("awards main and side pots independently (short stack wins main, big stack wins side)", () => {
    // A (short, all-in 50) has the best hand -> wins main only.
    // B and C contest the side pot; C wins it.
    const contenders = [
      player("A", 0, ["Ah", "As"], 50), // trip/quad aces -> best overall
      player("B", 1, ["Kh", "Ks"], 200), // kings
      player("C", 2, ["Qh", "Qs"], 200), // queens
    ];
    // Board pairs the aces for A; K and Q also present but A dominates.
    const res = settleShowdown(
      contenders,
      board("Ac", "Kd", "Qc", "5s", "2h"),
      0,
      3,
      defaultEvaluator,
    );
    // Pots: main 150 {A,B,C}, side 300 {B,C}.
    // A wins main (150). Side: B (three kings? no, KK + Kd = trips) vs C (QQ + Qc = trips). Kings win.
    expect(res.pots).toEqual([
      { amount: 150, eligiblePlayerIds: ["A", "B", "C"] },
      { amount: 300, eligiblePlayerIds: ["B", "C"] },
    ]);
    expect(res.winningsByPlayer.A).toBe(150);
    expect(res.winningsByPlayer.B).toBe(300);
    expect(res.winningsByPlayer.C).toBeUndefined();
  });

  it("splits a side pot between tied eligible players", () => {
    // B and C tie for the side pot playing the same board straight; A wins main.
    const contenders = [
      player("A", 0, ["Ah", "As"], 40), // trip aces -> main
      player("B", 1, ["2c", "2d"], 120),
      player("C", 2, ["3c", "3d"], 120),
    ];
    // Board: A T J Q K -> B and C both play A-high broadway straight (board plays) for side.
    const res = settleShowdown(
      contenders,
      board("Ad", "Tc", "Js", "Qh", "Kc"),
      0,
      3,
      defaultEvaluator,
    );
    // main 120 {A,B,C}: A has trip aces vs broadway straight -> straight wins!
    // Recompute: A's best = A A A ... but board A T J Q K -> A plays straight too (A-K-Q-J-T),
    // so ALL THREE play the same straight in the main pot -> three-way split of 120 = 40 each.
    // Side pot 160 {B,C}: both play the straight -> split 80 each.
    expect(res.pots).toEqual([
      { amount: 120, eligiblePlayerIds: ["A", "B", "C"] },
      { amount: 160, eligiblePlayerIds: ["B", "C"] },
    ]);
    expect(res.winningsByPlayer).toEqual({ A: 40, B: 40 + 80, C: 40 + 80 });
  });

  it("fold-out: single remaining player wins everything without evaluation", () => {
    const contenders = [
      player("A", 0, ["Ah", "Ad"], 30, true),
      player("B", 1, ["Kh", "Kd"], 10, false),
      player("C", 2, ["Qh", "Qd"], 5, false),
    ];
    // Board incomplete (folded preflop) — no hand names, A scoops.
    const res = settleShowdown(contenders, [], 0, 3, defaultEvaluator);
    expect(res.winningsByPlayer).toEqual({ A: 45 });
    expect(res.awards.every((a) => a.handName === null)).toBe(true);
  });
});
