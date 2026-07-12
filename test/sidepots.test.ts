import { describe, expect, it } from "vitest";
import { type Contribution, computeSidePots, totalPot } from "../src/engine/sidepots.ts";

const c = (playerId: string, committedTotal: number, inHand = true): Contribution => ({
  playerId,
  committedTotal,
  inHand,
});

/** Chips are conserved: total across all pots equals total committed. */
function assertConserved(contribs: Contribution[]) {
  const committed = contribs.reduce((s, x) => s + x.committedTotal, 0);
  expect(totalPot(computeSidePots(contribs))).toBe(committed);
}

describe("computeSidePots", () => {
  it("single equal-contribution pot", () => {
    const pots = computeSidePots([c("A", 100), c("B", 100)]);
    expect(pots).toEqual([{ amount: 200, eligiblePlayerIds: ["A", "B"] }]);
  });

  it("ignores zero contributions", () => {
    const pots = computeSidePots([c("A", 100), c("B", 100), c("C", 0)]);
    expect(pots).toEqual([{ amount: 200, eligiblePlayerIds: ["A", "B"] }]);
  });

  // Spec test matrix: 3-way all-in with three different stack sizes.
  it("3-way all-in, three stack sizes -> main + two side pots", () => {
    const contribs = [c("A", 50), c("B", 100), c("C", 200)];
    const pots = computeSidePots(contribs);
    expect(pots).toEqual([
      { amount: 150, eligiblePlayerIds: ["A", "B", "C"] }, // main: 50*3
      { amount: 100, eligiblePlayerIds: ["B", "C"] }, //       side1: 50*2
      { amount: 100, eligiblePlayerIds: ["C"] }, //            side2 (C's uncalled): 100*1
    ]);
    assertConserved(contribs);
  });

  // Spec test matrix: uncalled overbet is returned as a solo-eligible top pot.
  it("uncalled overbet returns to its owner", () => {
    const contribs = [c("A", 200), c("B", 60)];
    const pots = computeSidePots(contribs);
    expect(pots).toEqual([
      { amount: 120, eligiblePlayerIds: ["A", "B"] },
      { amount: 140, eligiblePlayerIds: ["A"] },
    ]);
    assertConserved(contribs);
  });

  // Spec test matrix: all-in call for less than a full raise.
  it("all-in call for less than min-raise builds a clean side pot", () => {
    // A raises to 100, B all-in calls for 70 (< a full raise), C calls 100.
    const contribs = [c("A", 100), c("B", 70), c("C", 100)];
    const pots = computeSidePots(contribs);
    expect(pots).toEqual([
      { amount: 210, eligiblePlayerIds: ["A", "B", "C"] }, // 70*3
      { amount: 60, eligiblePlayerIds: ["A", "C"] }, //       30*2
    ]);
    assertConserved(contribs);
  });

  it("merges dead blind money from a folded short stack", () => {
    // C posts 10 then folds; A and B contest the rest. No separate 10-chip pot.
    const contribs = [c("A", 100), c("B", 100), c("C", 10, false)];
    const pots = computeSidePots(contribs);
    expect(pots).toEqual([{ amount: 210, eligiblePlayerIds: ["A", "B"] }]);
    assertConserved(contribs);
  });

  it("folded player's chips stay in the pot but they are not eligible", () => {
    const contribs = [c("A", 100), c("B", 100, false), c("C", 100)];
    const pots = computeSidePots(contribs);
    expect(pots).toEqual([{ amount: 300, eligiblePlayerIds: ["A", "C"] }]);
    assertConserved(contribs);
  });

  it("short all-in folded creates a base pot only bigger stacks can win", () => {
    // D all-in 30 then... (folded short stacks still add dead money to the layer they reach)
    const contribs = [c("A", 200), c("B", 200), c("C", 30, false)];
    const pots = computeSidePots(contribs);
    // level 30: A,B,C contribute -> 90, eligible {A,B}; then 170 level: A,B -> 340 eligible {A,B}
    // adjacent equal eligibility merges -> single 430 pot {A,B}
    expect(pots).toEqual([{ amount: 430, eligiblePlayerIds: ["A", "B"] }]);
    assertConserved(contribs);
  });

  it("four-way with two all-in levels", () => {
    const contribs = [c("A", 25), c("B", 25), c("C", 80), c("D", 80)];
    const pots = computeSidePots(contribs);
    expect(pots).toEqual([
      { amount: 100, eligiblePlayerIds: ["A", "B", "C", "D"] }, // 25*4
      { amount: 110, eligiblePlayerIds: ["C", "D"] }, //           55*2
    ]);
    assertConserved(contribs);
  });

  it("conserves chips across many randomized shapes", () => {
    const shapes: number[][] = [
      [1, 2, 3, 4, 5],
      [100, 100, 100],
      [7, 7, 7, 200],
      [50, 51, 52, 999],
      [3, 3, 3, 3, 3, 3, 3, 3, 3],
    ];
    for (const shape of shapes) {
      const contribs = shape.map((amt, i) => c(String(i), amt, i % 3 !== 0));
      assertConserved(contribs);
    }
  });
});
