import { describe, expect, it } from "vitest";
import { amountToCall, applyAction, legalActions } from "../src/engine/betting.ts";
import { freshDeck, strToCard } from "../src/engine/cards.ts";
import { progressHand, startHandWithDeck } from "../src/engine/game.ts";
import type { SeatConfig } from "../src/engine/hand.ts";
import { makeRng } from "../src/engine/rng.ts";
import type { Card, GameState } from "../src/engine/types.ts";

function seats(stacks: number[]): SeatConfig[] {
  return stacks.map((stack, i) => ({
    id: `p${i}`,
    name: `P${i}`,
    isHuman: false,
    personalityId: "human",
    stack,
    seatIndex: i,
  }));
}

/** Build a deck whose first cards are the given ones; the rest is a fresh deck minus them. */
function deckFrom(cardStrs: string[]): Card[] {
  const front = cardStrs.map(strToCard);
  const used = new Set(cardStrs);
  const rest = freshDeck().filter((c) => !used.has(`${rankChar(c.rank)}${c.suit}`));
  return [...front, ...rest];
}
function rankChar(r: number): string {
  return r === 14
    ? "A"
    : r === 13
      ? "K"
      : r === 12
        ? "Q"
        : r === 11
          ? "J"
          : r === 10
            ? "T"
            : `${r}`;
}

const actorOf = (s: GameState) => s.players.find((p) => p.seatIndex === s.actor)!;
const totalChips = (s: GameState) => s.players.reduce((sum, p) => sum + p.stack, 0);

describe("full hand: multiway all-in side pots (acceptance test)", () => {
  it("awards main + two side pots with correct final stacks", () => {
    // 3-handed, button seat0. Stacks 200/100/50 (seat2 all-in for the least).
    // Deal: ordered = [seat0(BTN), seat1(SB), seat2(BB)].
    // seat0 KK, seat1 QQ, seat2 AA. Board bricks -> seat2 best, seat0 second, seat1 worst.
    const deck = deckFrom([
      "Ks",
      "Qs",
      "As", // first hole card to seat0, seat1, seat2
      "Kh",
      "Qh",
      "Ah", // second hole card
      "2c",
      "7d",
      "9s",
      "3h",
      "5c", // flop, turn, river
    ]);
    let s = startHandWithDeck(
      seats([200, 100, 50]),
      { blinds: { sb: 1, bb: 2, ante: 0 }, button: 0, handNumber: 1 },
      deck,
    );

    // Preflop: seat0 shoves 200, seat1 all-in call 100, seat2 all-in call 50.
    expect(s.actor).toBe(0);
    s = applyAction(s, { type: "raise", playerId: actorOf(s).id, amount: 200 });
    s = applyAction(s, { type: "call", playerId: actorOf(s).id });
    s = applyAction(s, { type: "call", playerId: actorOf(s).id });

    // All-in run-out to showdown.
    const prog = progressHand(s);
    expect(prog.kind).toBe("settled");
    if (prog.kind !== "settled") return;

    // Pots: main 150 {all}, side1 100 {seat0,seat1}, side2 100 {seat0} (uncalled, returned).
    expect(prog.result.pots).toEqual([
      { amount: 150, eligiblePlayerIds: ["p0", "p1", "p2"] },
      { amount: 100, eligiblePlayerIds: ["p0", "p1"] },
      { amount: 100, eligiblePlayerIds: ["p0"] },
    ]);
    // seat2 (AA) wins main; seat0 (KK) wins side1 + gets side2 back.
    expect(prog.result.winningsByPlayer).toEqual({ p2: 150, p0: 200 });

    const stacks = Object.fromEntries(prog.state.players.map((p) => [p.id, p.stack]));
    expect(stacks).toEqual({ p0: 200, p1: 0, p2: 150 });
    expect(totalChips(prog.state)).toBe(350); // chips conserved
  });
});

/**
 * Fuzz test: play many full random hands where every actor takes a random legal action.
 * The invariant that must never break is total-chip conservation and non-negative stacks -
 * a direct guard on the Definition of Done ("zero errors in pot math").
 */
describe("chip-conservation fuzz", () => {
  it("conserves chips across 400 random hands of varying table sizes", () => {
    for (let trial = 0; trial < 400; trial++) {
      const rng = makeRng(trial * 2654435761 + 12345);
      const size = 2 + (trial % 8); // 2..9 players
      const stacks = Array.from({ length: size }, () => 20 + rng.int(300));
      const startTotal = stacks.reduce((a, b) => a + b, 0);

      let s = startHandWithDeck(
        seats(stacks),
        {
          blinds: { sb: 1, bb: 2, ante: trial % 3 === 0 ? 1 : 0 },
          button: trial % size,
          handNumber: trial,
        },
        shuffleDeck(rng),
      );

      let guard = 0;
      while (true) {
        if (++guard > 2000) throw new Error("hand did not terminate");
        if (s.actor === null) {
          const prog = progressHand(s);
          if (prog.kind === "settled") {
            expect(totalChips(prog.state)).toBe(startTotal);
            for (const p of prog.state.players) expect(p.stack).toBeGreaterThanOrEqual(0);
            break;
          }
          s = prog.state;
          continue;
        }
        s = randomAction(s, rng);
      }
    }
  });
});

function shuffleDeck(rng: ReturnType<typeof makeRng>): Card[] {
  const d = freshDeck();
  for (let i = d.length - 1; i > 0; i--) {
    const j = rng.int(i + 1);
    [d[i], d[j]] = [d[j]!, d[i]!];
  }
  return d;
}

function randomAction(s: GameState, rng: ReturnType<typeof makeRng>): GameState {
  const actor = actorOf(s);
  const legal = legalActions(s);
  const choice = legal[rng.int(legal.length)]!;
  if (choice.type === "bet" || choice.type === "raise") {
    const min = choice.min ?? 0;
    const max = choice.max ?? min;
    const amount = min + rng.int(Math.max(1, max - min + 1));
    return applyAction(s, { type: choice.type, playerId: actor.id, amount });
  }
  // Avoid always folding: if fold was picked but calling is free (check), prefer check.
  if (choice.type === "fold" && amountToCall(s, actor) === 0) {
    return applyAction(s, { type: "check", playerId: actor.id });
  }
  return applyAction(s, { type: choice.type, playerId: actor.id });
}
