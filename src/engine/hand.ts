import { isBettingRoundComplete, playersInHand } from "./betting.ts";
import type { Blinds, Card, GameState, PersonalityId, Player, Position, Street } from "./types.ts";

export interface SeatConfig {
  id: string;
  name: string;
  isHuman: boolean;
  personalityId: PersonalityId;
  stack: number;
  seatIndex: number;
}

export interface HandConfig {
  blinds: Blinds;
  button: number;
  handNumber: number;
}

/** Position labels clockwise from the button, chosen by table size. */
function positionsForSeats(n: number): Position[] {
  switch (n) {
    case 2:
      return ["BTN", "BB"]; // heads-up: button is the small blind
    case 3:
      return ["BTN", "SB", "BB"];
    case 4:
      return ["BTN", "SB", "BB", "UTG"];
    case 5:
      return ["BTN", "SB", "BB", "UTG", "CO"];
    case 6:
      return ["BTN", "SB", "BB", "UTG", "MP", "CO"];
    case 7:
      return ["BTN", "SB", "BB", "UTG", "MP", "HJ", "CO"];
    case 8:
      return ["BTN", "SB", "BB", "UTG", "UTG+1", "MP", "HJ", "CO"];
    default:
      return ["BTN", "SB", "BB", "UTG", "UTG+1", "MP", "MP+1", "HJ", "CO"];
  }
}

/** Seats in clockwise order starting immediately left of the button. */
function seatsFromButton(seats: SeatConfig[], button: number): SeatConfig[] {
  const sorted = [...seats].sort((a, b) => a.seatIndex - b.seatIndex);
  const n = sorted.length;
  const btnPos = sorted.findIndex((s) => s.seatIndex === button);
  const ordered: SeatConfig[] = [];
  for (let i = 0; i < n; i++) {
    ordered.push(sorted[(btnPos + i) % n]!);
  }
  return ordered; // ordered[0] = button, ordered[1] = SB seat, ...
}

/**
 * Build the initial state for a hand: assign positions, post antes and blinds, deal hole
 * cards, and set the first player to act — including the heads-up exception where the
 * button posts the small blind and acts first preflop (spec Section 04).
 */
export function createHand(seats: SeatConfig[], deck: Card[], config: HandConfig): GameState {
  const n = seats.length;
  if (n < 2) throw new Error("Need at least 2 players");
  const ordered = seatsFromButton(seats, config.button);
  const posLabels = positionsForSeats(n);

  const workingDeck = deck.slice();
  const players: Player[] = ordered.map((s, i) => ({
    id: s.id,
    name: s.name,
    isHuman: s.isHuman,
    personalityId: s.personalityId,
    stack: s.stack,
    holeCards: [],
    inHand: true,
    isAllIn: false,
    committedThisRound: 0,
    committedTotal: 0,
    seatIndex: s.seatIndex,
    position: posLabels[i] ?? null,
    actedAtLevel: -1,
  }));

  const bySeatIndexInOrder = players; // ordered[0]=button ... same order

  // Heads-up: button (index 0) is the small blind; otherwise SB is index 1, BB index 2.
  const isHeadsUp = n === 2;
  const sbOrderIdx = isHeadsUp ? 0 : 1;
  const bbOrderIdx = isHeadsUp ? 1 : 2;

  const { ante, sb, bb } = config.blinds;

  // Antes are dead money: they enter the pot (committedTotal) but do not count toward the
  // current bet a player must call.
  if (ante > 0) {
    for (const p of bySeatIndexInOrder) {
      const pay = Math.min(ante, p.stack);
      postDead(p, pay);
    }
  }

  postBlind(bySeatIndexInOrder[sbOrderIdx]!, sb);
  postBlind(bySeatIndexInOrder[bbOrderIdx]!, bb);

  // Deal two hole cards to each player (order is cosmetic; determinism comes from the deck).
  let d = 0;
  for (let round = 0; round < 2; round++) {
    for (const p of bySeatIndexInOrder) {
      p.holeCards.push(workingDeck[d++]!);
    }
  }
  const remaining = workingDeck.slice(d);

  // First to act preflop: heads-up -> button; otherwise the seat left of the big blind.
  const firstOrderIdx = isHeadsUp ? 0 : (bbOrderIdx + 1) % n;

  const state: GameState = {
    players,
    button: config.button,
    board: [],
    pot: 0,
    sidePots: [],
    currentBet: bb,
    minRaise: bb,
    aggressionLevel: 1, // the big blind is the standing full-size "bet"
    street: "preflop",
    actor: null,
    lastAggressor: bySeatIndexInOrder[bbOrderIdx]!.seatIndex,
    blinds: config.blinds,
    handNumber: config.handNumber,
    deck: remaining,
  };
  state.pot = totalCommitted(state);
  state.actor = firstToAct(state, bySeatIndexInOrder[firstOrderIdx]!.seatIndex);
  return state;
}

function postBlind(p: Player, amount: number): void {
  const pay = Math.min(amount, p.stack);
  p.stack -= pay;
  p.committedThisRound += pay;
  p.committedTotal += pay;
  if (p.stack === 0) p.isAllIn = true;
}

function postDead(p: Player, amount: number): void {
  p.stack -= amount;
  p.committedTotal += amount;
  if (p.stack === 0) p.isAllIn = true;
}

/** Total chips committed to the pot this hand across all players. */
export function totalCommitted(state: GameState): number {
  return state.players.reduce((sum, p) => sum + p.committedTotal, 0);
}

/** The seat index immediately clockwise (left) of the given seat. */
function seatLeftOf(state: GameState, seatIndex: number): number {
  const bySeat = [...state.players].sort((a, b) => a.seatIndex - b.seatIndex);
  const pos = bySeat.findIndex((p) => p.seatIndex === seatIndex);
  return bySeat[(pos + 1) % bySeat.length]!.seatIndex;
}

/** From a desired starting seat, return the first seat that can actually act (or null). */
function firstToAct(state: GameState, desiredSeat: number): number | null {
  const bySeat = [...state.players].sort((a, b) => a.seatIndex - b.seatIndex);
  const n = bySeat.length;
  const startPos = bySeat.findIndex((p) => p.seatIndex === desiredSeat);
  for (let i = 0; i < n; i++) {
    const cand = bySeat[(startPos + i) % n]!;
    if (cand.inHand && !cand.isAllIn) return cand.seatIndex;
  }
  return null;
}

const STREET_ORDER: Street[] = ["preflop", "flop", "turn", "river", "showdown"];

/** How many community cards are dealt when entering a given street. */
const BOARD_ON_ENTER: Record<Street, number> = {
  preflop: 0,
  flop: 3,
  turn: 1,
  river: 1,
  showdown: 0,
};

/**
 * Advance to the next street: sweep the round, deal the appropriate community cards, reset
 * per-round state, and set the first player to act (first live seat left of the button).
 * If no further betting is possible (0 or 1 players can act), `actor` is set to null.
 */
export function advanceStreet(state: GameState): GameState {
  const idx = STREET_ORDER.indexOf(state.street);
  const nextStreet = STREET_ORDER[idx + 1];
  if (!nextStreet) throw new Error("No street after showdown");

  const players = state.players.map((p) => ({
    ...p,
    committedThisRound: 0,
    actedAtLevel: -1,
  }));

  const toDeal = BOARD_ON_ENTER[nextStreet];
  const board = state.board.slice();
  const deck = state.deck.slice();
  for (let i = 0; i < toDeal; i++) {
    board.push(deck.shift()!);
  }

  const next: GameState = {
    ...state,
    players,
    board,
    deck,
    street: nextStreet,
    currentBet: 0,
    minRaise: state.blinds.bb,
    aggressionLevel: 0,
    lastAggressor: null,
    actor: null,
  };

  if (nextStreet !== "showdown") {
    // Postflop the first live seat *left of* the button acts first.
    const canStillAct = playersInHand(next).filter((p) => !p.isAllIn);
    if (canStillAct.length > 1) {
      next.actor = firstToAct(next, seatLeftOf(next, next.button));
    }
  }
  next.pot = totalCommitted(next);
  return next;
}

/** True when the current street's betting is done and we should move on. */
export function streetSettled(state: GameState): boolean {
  return isBettingRoundComplete(state);
}

/** True when the remaining players are all-in and the board should just be run out. */
export function shouldRunOut(state: GameState): boolean {
  const contesting = playersInHand(state);
  if (contesting.length <= 1) return false; // that's a fold-out, handled separately
  return contesting.filter((p) => !p.isAllIn).length <= 1;
}
