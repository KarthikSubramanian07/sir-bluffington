import { isHandFoldedOut, playersInHand } from "./betting.ts";
import { shuffledDeck } from "./cards.ts";
import { type HandConfig, type SeatConfig, advanceStreet, createHand } from "./hand.ts";
import { type HandEvaluator, defaultEvaluator } from "./handEval.ts";
import type { Rng } from "./rng.ts";
import { type Contender, type ShowdownResult, settleShowdown } from "./showdown.ts";
import type { GameState } from "./types.ts";

/** Deal a fresh hand with a freshly shuffled, seeded deck. */
export function startHand(seats: SeatConfig[], config: HandConfig, rng: Rng): GameState {
  return createHand(seats, shuffledDeck(rng), config);
}

/** Start a hand from an explicit deck — used by deterministic tests. */
export function startHandWithDeck(
  seats: SeatConfig[],
  config: HandConfig,
  deck: Parameters<typeof createHand>[1],
): GameState {
  return createHand(seats, deck, config);
}

export type Progress =
  | { kind: "action"; state: GameState }
  | { kind: "settled"; state: GameState; result: ShowdownResult };

/**
 * Resolve the transitions that happen *between* player actions: settle a fold-out, advance
 * to the next street, run out the board when everyone is all-in, and settle at showdown.
 * Call this whenever the current street's betting is complete (`state.actor === null`) or
 * the hand has folded out. It never applies a player action itself.
 */
export function progressHand(
  state: GameState,
  evaluator: HandEvaluator = defaultEvaluator,
): Progress {
  if (isHandFoldedOut(state)) {
    return settleHand(state, evaluator);
  }
  if (state.actor !== null) {
    return { kind: "action", state }; // betting continues on this street
  }
  if (state.street === "river" || state.street === "showdown") {
    return settleHand(state, evaluator);
  }

  // Betting for this street is done. Deal the next street; if no one can bet (all-in
  // run-out), keep dealing until the river, then settle.
  let s = advanceStreet(state);
  while (s.actor === null && s.street !== "river" && !isHandFoldedOut(s)) {
    s = advanceStreet(s);
  }
  if (s.actor === null) {
    return settleHand(s, evaluator);
  }
  return { kind: "action", state: s };
}

/** Award all pots, credit winners' stacks, and mark the hand complete. */
export function settleHand(
  state: GameState,
  evaluator: HandEvaluator = defaultEvaluator,
): { kind: "settled"; state: GameState; result: ShowdownResult } {
  const contenders: Contender[] = state.players.map((p) => ({
    playerId: p.id,
    holeCards: p.holeCards,
    inHand: p.inHand,
    committedTotal: p.committedTotal,
    seatIndex: p.seatIndex,
  }));

  const result = settleShowdown(
    contenders,
    state.board,
    state.button,
    state.players.length,
    evaluator,
  );

  const players = state.players.map((p) => ({
    ...p,
    stack: p.stack + (result.winningsByPlayer[p.id] ?? 0),
    committedThisRound: 0,
    committedTotal: 0,
  }));

  return {
    kind: "settled",
    state: { ...state, players, street: "showdown", actor: null, sidePots: result.pots },
    result,
  };
}

/** Whether the hand reached a real multi-way showdown (as opposed to a fold-out). */
export function isShowdown(state: GameState): boolean {
  return state.board.length === 5 && playersInHand(state).length > 1;
}
