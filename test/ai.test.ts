import { describe, expect, it } from "vitest";
import { decide } from "../src/ai/decide.ts";
import { canonicalPreflop, estimateEquity, preflopEquity } from "../src/ai/equity.ts";
import { PERSONALITIES } from "../src/ai/personalities.ts";
import { freshDeck } from "../src/engine/cards.ts";
import { createHand } from "../src/engine/hand.ts";
import { makeRng } from "../src/engine/rng.ts";
import type { Card, GameState } from "../src/engine/types.ts";

function seats6() {
  return Array.from({ length: 6 }, (_, i) => ({
    id: `p${i}`,
    name: `P${i}`,
    isHuman: false,
    personalityId: "human" as const,
    stack: 200,
    seatIndex: i,
  }));
}

/** Deck where UTG (seat 3, button 0) receives the two given hole cards. */
function deckWithUtgHand(a: Card, b: Card): Card[] {
  const key = (c: Card) => `${c.rank}${c.suit}`;
  const used = new Set([key(a), key(b)]);
  const rest = freshDeck().filter((c) => !used.has(key(c)));
  const deck: Card[] = [];
  let ri = 0;
  for (let i = 0; i < 52; i++) {
    if (i === 3) deck.push(a);
    else if (i === 9) deck.push(b);
    else deck.push(rest[ri++]!);
  }
  return deck;
}

function utgPreflopState(a: Card, b: Card): GameState {
  return createHand(seats6(), deckWithUtgHand(a, b), {
    blinds: { sb: 1, bb: 2, ante: 0 },
    button: 0,
    handNumber: 1,
  });
}

function randomHole(rng: ReturnType<typeof makeRng>): [Card, Card] {
  const deck = freshDeck();
  const i = rng.int(52);
  let j = rng.int(52);
  while (j === i) j = rng.int(52);
  return [deck[i]!, deck[j]!];
}

interface Freq {
  vpip: number;
  pfr: number;
}

/** Measured VPIP/PFR for a personality over many random UTG hands. */
function measure(personalityId: keyof typeof PERSONALITIES, trials = 1500): Freq {
  const p = PERSONALITIES[personalityId];
  let played = 0;
  let raised = 0;
  for (let t = 0; t < trials; t++) {
    const rng = makeRng(0xa11ce + t * 7919);
    const [a, b] = randomHole(rng);
    const s = utgPreflopState(a, b);
    const actor = s.players.find((x) => x.seatIndex === s.actor)!;
    const eq = preflopEquity(actor.holeCards);
    const d = decide(s, actor, p, eq, rng);
    if (d.action.type !== "fold") played++;
    if (d.action.type === "raise" || d.action.type === "bet") raised++;
  }
  return { vpip: played / trials, pfr: raised / trials };
}

describe("preflop equity table", () => {
  it("ranks premium hands above trash", () => {
    expect(
      preflopEquity([
        { rank: 14, suit: "s" },
        { rank: 14, suit: "h" },
      ]),
    ).toBeGreaterThan(0.8);
    expect(
      preflopEquity([
        { rank: 7, suit: "c" },
        { rank: 2, suit: "d" },
      ]),
    ).toBeLessThan(0.4);
    expect(
      preflopEquity([
        { rank: 14, suit: "s" },
        { rank: 13, suit: "s" },
      ]),
    ).toBeGreaterThan(
      preflopEquity([
        { rank: 14, suit: "h" },
        { rank: 13, suit: "s" },
      ]),
    ); // suited > offsuit
  });

  it("produces canonical codes", () => {
    expect(canonicalPreflop({ rank: 14, suit: "s" }, { rank: 13, suit: "s" })).toBe("AKs");
    expect(canonicalPreflop({ rank: 13, suit: "h" }, { rank: 14, suit: "s" })).toBe("AKo");
    expect(canonicalPreflop({ rank: 10, suit: "c" }, { rank: 10, suit: "d" })).toBe("TT");
  });
});

describe("personality distinctness (spec Section 05)", () => {
  it("VPIP ordering: Rock < Shark < Sir Bluffington < Calling Station <= Maniac", () => {
    const rock = measure("rock");
    const shark = measure("shark");
    const bluff = measure("sir-bluffington");
    const station = measure("calling-station");
    const maniac = measure("maniac");

    expect(rock.vpip).toBeLessThan(shark.vpip);
    expect(shark.vpip).toBeLessThan(bluff.vpip);
    expect(bluff.vpip).toBeLessThan(station.vpip);
    expect(station.vpip).toBeLessThan(maniac.vpip + 0.1);
    // Rock is genuinely tight; Maniac is genuinely loose.
    expect(rock.vpip).toBeLessThan(0.35);
    expect(maniac.vpip).toBeGreaterThan(0.5);
  });

  it("the Calling Station rarely raises but plays many hands", () => {
    const station = measure("calling-station");
    expect(station.pfr).toBeLessThan(0.18);
    expect(station.vpip).toBeGreaterThan(0.45);
    expect(station.vpip - station.pfr).toBeGreaterThan(0.3); // mostly limps/calls
  });

  it("the Maniac raises far more than the Rock", () => {
    expect(measure("maniac").pfr).toBeGreaterThan(measure("rock").pfr + 0.2);
  });
});

describe("decision determinism", () => {
  it("same state + same seed -> same action", () => {
    const s = utgPreflopState({ rank: 14, suit: "s" }, { rank: 14, suit: "h" });
    const actor = s.players.find((x) => x.seatIndex === s.actor)!;
    const eq = preflopEquity(actor.holeCards);
    const d1 = decide(s, actor, PERSONALITIES.shark, eq, makeRng(42));
    const d2 = decide(s, actor, PERSONALITIES.shark, eq, makeRng(42));
    expect(d1.action).toEqual(d2.action);
  });

  it("Monte-Carlo equity is reproducible for a fixed seed", () => {
    const hole: Card[] = [
      { rank: 14, suit: "s" },
      { rank: 14, suit: "h" },
    ];
    const board: Card[] = [
      { rank: 14, suit: "d" },
      { rank: 7, suit: "c" },
      { rank: 2, suit: "s" },
    ];
    const e1 = estimateEquity(hole, board, 1, makeRng(1), 200);
    const e2 = estimateEquity(hole, board, 1, makeRng(1), 200);
    expect(e1).toBe(e2);
    expect(e1).toBeGreaterThan(0.85); // trip aces crush one opponent
  });
});
