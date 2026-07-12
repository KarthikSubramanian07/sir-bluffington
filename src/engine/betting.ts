import type { Action, GameState, LegalAction, Player } from "./types.ts";

/**
 * The No-Limit Hold'em betting-round state machine (spec Section 04). Pure functions over
 * GameState; every function returns a new state and never mutates its input.
 *
 * The reopening rule is the subtle part. `aggressionLevel` increments only on a FULL-size
 * bet or raise. Each player records `actedAtLevel` = the aggression level when they last
 * acted. A player owes an action while `actedAtLevel < aggressionLevel` OR they still owe
 * chips to call. A player may *raise* only when `actedAtLevel < aggressionLevel` — so a
 * short all-in (which does not advance the level) lets already-acted players call or fold
 * but never re-raise, while players who have not yet acted this level keep full rights.
 */

/** Chips a player must add to match the current bet (0 if already matched). */
export function amountToCall(state: GameState, player: Player): number {
  return Math.max(0, state.currentBet - player.committedThisRound);
}

/** Largest total ("raise-to") a player can commit this round = their whole stack. */
function maxCommit(player: Player): number {
  return player.committedThisRound + player.stack;
}

function actorPlayer(state: GameState): Player {
  if (state.actor === null) throw new Error("No actor to act");
  const p = state.players.find((x) => x.seatIndex === state.actor);
  if (!p) throw new Error(`No player at seat ${state.actor}`);
  return p;
}

/** May this player legally raise right now (as opposed to only call/check/fold)? */
function mayRaise(state: GameState, player: Player): boolean {
  // Betting is reopened to a player only if aggression has advanced since they last acted.
  return player.actedAtLevel < state.aggressionLevel;
}

/**
 * All legal actions for the player to act, with numeric bounds. `min`/`max` on bet/raise
 * are total "raise-to" amounts (chips already committed this round + new chips).
 */
export function legalActions(state: GameState): LegalAction[] {
  const p = actorPlayer(state);
  if (!p.inHand || p.isAllIn) return [];

  const actions: LegalAction[] = [];
  const toCall = amountToCall(state, p);
  const max = maxCommit(p);

  // Fold is always available on your turn.
  actions.push({ type: "fold" });

  if (toCall === 0) {
    actions.push({ type: "check" });
  } else {
    // Call for the required amount, or all-in for less if the stack can't cover it.
    actions.push({ type: "call", min: Math.min(toCall, p.stack) });
  }

  if (state.currentBet === 0) {
    // Opening bet. Minimum is a big blind (minRaise), capped by the stack (all-in for less).
    if (p.stack > 0) {
      const minBet = Math.min(state.minRaise, max);
      actions.push({ type: "bet", min: minBet, max });
    }
  } else if (mayRaise(state, p) && max > state.currentBet) {
    // Raise. A full raise must reach currentBet + minRaise; if the stack can't, only an
    // all-in raise-for-less is available (min == max == all-in).
    const fullRaiseTo = state.currentBet + state.minRaise;
    const min = Math.min(fullRaiseTo, max);
    actions.push({ type: "raise", min, max });
  }

  return actions;
}

function cloneForUpdate(state: GameState): { state: GameState; players: Player[] } {
  const players = state.players.map((p) => ({ ...p }));
  return { state: { ...state, players }, players };
}

/**
 * Apply a validated action for the current actor and advance to the next actor (or settle
 * the round, setting `actor` to null). Throws on an illegal action.
 */
export function applyAction(state: GameState, action: Action): GameState {
  const actor = actorPlayer(state);
  if (action.playerId !== actor.id) {
    throw new Error(`Out of turn: ${action.playerId} acted but ${actor.id} is to act`);
  }
  const legal = legalActions(state);
  const match = legal.find((l) => l.type === action.type);
  if (!match) {
    throw new Error(`Illegal action ${action.type} for ${actor.id}`);
  }

  const { state: next, players } = cloneForUpdate(state);
  const p = players.find((x) => x.id === actor.id)!;

  switch (action.type) {
    case "fold":
      p.inHand = false;
      p.actedAtLevel = next.aggressionLevel;
      break;

    case "check":
      p.actedAtLevel = next.aggressionLevel;
      break;

    case "call": {
      const pay = Math.min(amountToCall(next, p), p.stack);
      commit(p, pay);
      p.actedAtLevel = next.aggressionLevel;
      break;
    }

    case "bet":
    case "raise": {
      const target = action.amount;
      if (target === undefined) throw new Error(`${action.type} requires an amount`);
      if (target < (match.min ?? 0) || target > (match.max ?? Number.POSITIVE_INFINITY)) {
        throw new Error(`${action.type} to ${target} out of bounds [${match.min}, ${match.max}]`);
      }
      const increment = target - next.currentBet;
      const priorFullRaise = next.minRaise;
      const pay = target - p.committedThisRound;
      commit(p, pay);
      next.currentBet = target;
      next.lastAggressor = p.seatIndex;

      // A full-size raise reopens betting and sets the new minimum raise increment. A short
      // all-in (increment < prior min raise) raises the price but does NOT reopen.
      if (increment >= priorFullRaise) {
        next.minRaise = increment;
        next.aggressionLevel += 1;
      }
      p.actedAtLevel = next.aggressionLevel;
      break;
    }

    default:
      throw new Error(`Unsupported action ${action.type}`);
  }

  next.actor = nextActor(next, actor.seatIndex);
  return next;
}

function commit(p: Player, chips: number): void {
  p.stack -= chips;
  p.committedThisRound += chips;
  p.committedTotal += chips;
  if (p.stack === 0) p.isAllIn = true;
}

/** Does this player still owe an action (must be given a turn)? */
function needsAction(state: GameState, p: Player): boolean {
  if (!p.inHand || p.isAllIn) return false;
  if (p.committedThisRound < state.currentBet) return true; // owes chips
  return p.actedAtLevel < state.aggressionLevel; // hasn't acted at the current level
}

/**
 * Seat index of the next player who must act, scanning clockwise from `fromSeat`. Returns
 * null when the betting round is settled (nobody owes an action).
 */
function nextActor(state: GameState, fromSeat: number): number | null {
  const n = state.players.length;
  // Order seats by their seatIndex so "clockwise" is well-defined even with gaps.
  const bySeat = [...state.players].sort((a, b) => a.seatIndex - b.seatIndex);
  const startPos = bySeat.findIndex((p) => p.seatIndex === fromSeat);

  for (let i = 1; i <= n; i++) {
    const cand = bySeat[(startPos + i) % n]!;
    if (needsAction(state, cand)) return cand.seatIndex;
  }
  return null;
}

/** True once no player owes any further action this round. */
export function isBettingRoundComplete(state: GameState): boolean {
  return state.actor === null || !state.players.some((p) => needsAction(state, p));
}

/** Players still contesting the hand (not folded). */
export function playersInHand(state: GameState): Player[] {
  return state.players.filter((p) => p.inHand);
}

/** True when at most one player remains un-folded — the hand ends without a showdown. */
export function isHandFoldedOut(state: GameState): boolean {
  return playersInHand(state).length <= 1;
}

/** True when every remaining player is all-in (or only one can act) — run the board out. */
export function isBettingClosedForStreet(state: GameState): boolean {
  const contesting = playersInHand(state);
  const canAct = contesting.filter((p) => !p.isAllIn);
  return canAct.length <= 1 && isBettingRoundComplete(state);
}
