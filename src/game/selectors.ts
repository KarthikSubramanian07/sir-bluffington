import { amountToCall, legalActions } from "../engine/betting.ts";
import { totalCommitted } from "../engine/hand.ts";
import type { GameState, LegalAction, Player } from "../engine/types.ts";

export const HUMAN_ID = "hero";

export function humanPlayer(state: GameState): Player | undefined {
  return state.players.find((p) => p.id === HUMAN_ID);
}

export function isHumansTurn(state: GameState): boolean {
  if (state.actor === null) return false;
  const actor = state.players.find((p) => p.seatIndex === state.actor);
  return actor?.isHuman ?? false;
}

/** Legal actions plus derived numbers the action bar needs. */
export interface HumanOptions {
  legal: LegalAction[];
  toCall: number;
  pot: number;
  minRaiseTo: number;
  maxRaiseTo: number;
  canCheck: boolean;
  canBetOrRaise: boolean;
  isBet: boolean;
  stack: number;
  currentBet: number;
}

export function humanOptions(state: GameState): HumanOptions | null {
  const player = humanPlayer(state);
  if (!player || !isHumansTurn(state)) return null;
  const legal = legalActions(state);
  const raise = legal.find((l) => l.type === "raise");
  const bet = legal.find((l) => l.type === "bet");
  const aggressive = raise ?? bet;
  return {
    legal,
    toCall: amountToCall(state, player),
    pot: totalCommitted(state),
    minRaiseTo: aggressive?.min ?? 0,
    maxRaiseTo: aggressive?.max ?? 0,
    canCheck: legal.some((l) => l.type === "check"),
    canBetOrRaise: aggressive !== undefined,
    isBet: bet !== undefined,
    stack: player.stack,
    currentBet: state.currentBet,
  };
}
