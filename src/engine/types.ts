/**
 * Authoritative data model for Sir Bluffington's Poker.
 * Mirrors spec Section 03. Everything in the engine is a pure function over these.
 */

export type Suit = "c" | "d" | "h" | "s";

/** 2..10 as-is, J=11, Q=12, K=13, A=14. Ace is always high in the rank value. */
export type Rank = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14;

export interface Card {
  rank: Rank;
  suit: Suit;
}

export type Street = "preflop" | "flop" | "turn" | "river" | "showdown";

/** Poker table positions. Derived from seat order relative to the button. */
export type Position = "BTN" | "SB" | "BB" | "UTG" | "UTG+1" | "MP" | "MP+1" | "HJ" | "CO";

export type PersonalityId =
  | "rock"
  | "maniac"
  | "calling-station"
  | "shark"
  | "sir-bluffington"
  | "human";

export interface Player {
  id: string;
  name: string;
  isHuman: boolean;
  personalityId: PersonalityId;
  stack: number;
  /** Two hole cards once dealt; empty before the deal. */
  holeCards: Card[];
  /** false once folded out of the hand. */
  inHand: boolean;
  isAllIn: boolean;
  /** Chips committed on the current betting round (reset each street). */
  committedThisRound: number;
  /** Total chips committed this hand — the basis for side-pot math. */
  committedTotal: number;
  seatIndex: number;
  position: Position | null;
  /**
   * The betting round's aggression level at which this player last acted (see
   * GameState.aggressionLevel). -1 means "has not acted this street". A player still owes an
   * action while this is below the current aggression level, which is how the big-blind
   * option and re-opened betting are tracked. Reset to -1 at the start of every street.
   */
  actedAtLevel: number;
}

export interface SidePot {
  amount: number;
  /** Only these players may win this pot at showdown. */
  eligiblePlayerIds: string[];
}

export interface Blinds {
  sb: number;
  bb: number;
  ante: number;
}

export type ActionType = "fold" | "check" | "call" | "bet" | "raise" | "post-blind";

/** A single player action, as applied to the state machine. */
export interface Action {
  type: ActionType;
  playerId: string;
  /**
   * For bet/raise: the TOTAL amount committed this round by the player after the action
   * (i.e. the "raise-to" size), not the increment. For call: the amount added. For
   * post-blind: the blind size. Undefined for fold/check.
   */
  amount?: number;
}

/** A legal action the current actor may take, with its numeric bounds. */
export interface LegalAction {
  type: ActionType;
  /** For call: chips required. For bet/raise: minimum legal total ("raise-to"). */
  min?: number;
  /** For bet/raise: maximum legal total (all-in). */
  max?: number;
}

export interface GameState {
  players: Player[];
  /** Seat index of the dealer button. */
  button: number;
  board: Card[];
  /** The main (settled) pot from prior streets, excluding chips still in front of players. */
  pot: number;
  sidePots: SidePot[];
  /** Highest committed-this-round amount any player owes to (the current "bet to match"). */
  currentBet: number;
  /** Size of the last full bet/raise increment — the minimum legal raise increment. */
  minRaise: number;
  /**
   * Monotonic counter incremented ONLY by a full-size bet/raise (never by a short all-in).
   * A player may re-raise only if the aggression level has advanced since they last acted;
   * this is exactly what makes a sub-minimum all-in NOT reopen the betting (spec Section 04).
   */
  aggressionLevel: number;
  street: Street;
  /** Seat index of the player to act, or null when the street/hand is settled. */
  actor: number | null;
  /** Seat index of the last player to make an aggressive action (bet/raise) this round. */
  lastAggressor: number | null;
  blinds: Blinds;
  handNumber: number;
  /** Remaining, undealt cards for this hand (top of deck = index 0). */
  deck: Card[];
}
