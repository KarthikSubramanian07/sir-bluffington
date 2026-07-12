import { describe, expect, it } from "vitest";
import {
  amountToCall,
  applyAction,
  isBettingRoundComplete,
  legalActions,
} from "../src/engine/betting.ts";
import { freshDeck } from "../src/engine/cards.ts";
import { type SeatConfig, advanceStreet, createHand } from "../src/engine/hand.ts";
import type { GameState } from "../src/engine/types.ts";

function seats(stacks: number[]): SeatConfig[] {
  return stacks.map((stack, i) => ({
    id: `p${i}`,
    name: `P${i}`,
    isHuman: i === 0,
    personalityId: "human",
    stack,
    seatIndex: i,
  }));
}

function newHand(stacks: number[], button = 0, bb = 2, sb = 1): GameState {
  return createHand(seats(stacks), freshDeck(), {
    blinds: { sb, bb, ante: 0 },
    button,
    handNumber: 1,
  });
}

const actorId = (s: GameState) => s.players.find((p) => p.seatIndex === s.actor)?.id;
const legalTypes = (s: GameState) => legalActions(s).map((a) => a.type);
const act = (s: GameState, type: Parameters<typeof applyAction>[1]["type"], amount?: number) =>
  applyAction(s, { type, playerId: actorId(s)!, ...(amount !== undefined ? { amount } : {}) });

describe("heads-up special case", () => {
  it("button posts the small blind and acts first preflop", () => {
    const s = newHand([200, 200], 0);
    const btn = s.players.find((p) => p.seatIndex === 0)!;
    const bb = s.players.find((p) => p.seatIndex === 1)!;
    expect(btn.committedThisRound).toBe(1); // small blind
    expect(bb.committedThisRound).toBe(2); // big blind
    expect(s.actor).toBe(0); // button acts first preflop
  });

  it("big blind acts first postflop in heads-up", () => {
    let s = newHand([200, 200], 0);
    s = act(s, "call"); // button completes
    s = act(s, "check"); // BB checks option
    expect(isBettingRoundComplete(s)).toBe(true);
    s = advanceStreet(s);
    expect(s.street).toBe("flop");
    expect(s.actor).toBe(1); // BB (non-button) acts first postflop
  });
});

describe("action order (6-max)", () => {
  it("UTG (left of big blind) acts first preflop", () => {
    const s = newHand([200, 200, 200, 200, 200, 200], 0);
    // button=0, SB=1, BB=2, UTG=3
    expect(s.actor).toBe(3);
  });

  it("small blind acts first postflop", () => {
    let s = newHand([200, 200, 200, 200, 200, 200], 0);
    // Everyone calls / checks around preflop.
    while (!isBettingRoundComplete(s)) {
      s =
        amountToCall(s, s.players.find((p) => p.seatIndex === s.actor)!) > 0
          ? act(s, "call")
          : act(s, "check");
    }
    s = advanceStreet(s);
    expect(s.actor).toBe(1); // SB first to act postflop
  });
});

describe("big blind option", () => {
  it("BB may check or raise when limped to", () => {
    let s = newHand([200, 200, 200], 0); // BTN=0, SB=1, BB=2, UTG? 3-handed: actor = BTN(0)
    // 3-handed order preflop: UTG is the button. actor should be seat 0.
    expect(s.actor).toBe(0);
    s = act(s, "call"); // BTN calls 2
    s = act(s, "call"); // SB completes to 2
    // Now BB has the option.
    expect(s.actor).toBe(2);
    expect(legalTypes(s)).toContain("check");
    expect(legalTypes(s)).toContain("raise");
    s = act(s, "check");
    expect(isBettingRoundComplete(s)).toBe(true);
  });
});

describe("min-raise sizing", () => {
  it("a raise must be at least the previous raise increment", () => {
    let s = newHand([200, 200, 200, 200, 200, 200], 0); // bb=2
    // UTG (seat3) raises to 6 (increment 4).
    s = act(s, "raise", 6);
    expect(s.currentBet).toBe(6);
    expect(s.minRaise).toBe(4);
    // Next actor's minimum raise-to is 6 + 4 = 10.
    const raise = legalActions(s).find((a) => a.type === "raise")!;
    expect(raise.min).toBe(10);
    expect(raise.max).toBe(200);
  });
});

describe("short all-in does NOT reopen betting (spec Section 04)", () => {
  it("already-acted players may only call or fold after a sub-minimum all-in", () => {
    // Postflop 3-way. Seat1 bets 10; C (short) can only shove to 15 (< a full raise-to of
    // 20), which does not reopen betting. C posts 2 preflop, so 15 behind on the flop.
    let s = newHand([200, 200, 17], 0);
    while (!isBettingRoundComplete(s)) {
      const p = s.players.find((x) => x.seatIndex === s.actor)!;
      s = amountToCall(s, p) > 0 ? act(s, "call") : act(s, "check");
    }
    s = advanceStreet(s);
    expect(s.street).toBe("flop");
    s = act(s, "bet", 10);
    expect(s.minRaise).toBe(10);
    const lvlAfterBet = s.aggressionLevel;
    // Next to act: seat2 (C, short with 15 behind). Only a short all-in raise is available.
    expect(s.actor).toBe(2);
    const cAllIn = legalActions(s).find((a) => a.type === "raise")!;
    expect(cAllIn.min).toBe(15); // 15 < full raise-to of 20 -> forced short all-in
    expect(cAllIn.max).toBe(15);
    s = act(s, "raise", 15);
    expect(s.currentBet).toBe(15);
    expect(s.aggressionLevel).toBe(lvlAfterBet); // NOT advanced -> betting not reopened
    // Action now to seat0 (BTN) who has not acted this street yet -> may still raise.
    expect(s.actor).toBe(0);
    expect(legalTypes(s)).toContain("raise");
    s = act(s, "call"); // BTN just calls 15
    // Back to seat1 who already bet 10 and owes 5 more. Must NOT be able to raise.
    expect(s.actor).toBe(1);
    expect(legalTypes(s)).toContain("call");
    expect(legalTypes(s)).not.toContain("raise");
  });

  it("a full all-in raise DOES reopen betting", () => {
    let s = newHand([200, 200, 200], 0);
    while (!isBettingRoundComplete(s)) {
      const p = s.players.find((x) => x.seatIndex === s.actor)!;
      s = amountToCall(s, p) > 0 ? act(s, "call") : act(s, "check");
    }
    s = advanceStreet(s); // flop, actor seat1
    s = act(s, "bet", 10); // seat1 bets 10
    const lvl = s.aggressionLevel;
    s = act(s, "raise", 20); // seat2 full raise to 20 (increment 10 == minRaise)
    expect(s.aggressionLevel).toBe(lvl + 1); // reopened
    s = act(s, "call"); // seat0 calls
    // seat1 acted before the reopen -> may raise again now.
    expect(s.actor).toBe(1);
    expect(legalTypes(s)).toContain("raise");
  });
});

describe("round-end detection", () => {
  it("completes when action checks around", () => {
    let s = newHand([200, 200], 0);
    s = act(s, "call");
    s = act(s, "check");
    expect(isBettingRoundComplete(s)).toBe(true);
    expect(s.actor).toBeNull();
  });

  it("an all-in caller for less than the bet does not owe further action", () => {
    let s = newHand([200, 8], 0, 2, 1); // seat1 short-stacked
    // Preflop HU: button(seat0) acts first. Raise to 20.
    s = act(s, "raise", 20);
    // seat1 (BB, 8 behind after posting 2 -> 6 left) can only call all-in for 6.
    expect(s.actor).toBe(1);
    const call = legalActions(s).find((a) => a.type === "call")!;
    expect(call.min).toBe(6); // all-in call for less than the 18 owed
    s = act(s, "call");
    const bbPlayer = s.players.find((p) => p.seatIndex === 1)!;
    expect(bbPlayer.isAllIn).toBe(true);
    expect(isBettingRoundComplete(s)).toBe(true); // no one left who can act
  });
});
