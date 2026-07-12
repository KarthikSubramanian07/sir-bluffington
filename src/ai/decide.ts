import { amountToCall, legalActions } from "../engine/betting.ts";
import { totalCommitted } from "../engine/hand.ts";
import type { Rng } from "../engine/rng.ts";
import type { Action, GameState, LegalAction, Player } from "../engine/types.ts";
import type { Personality } from "./personalities.ts";

export interface Decision {
  action: Action;
  /** Short human-readable rationale for the post-hand "why" review (spec Section 06). */
  reason: string;
  /** The equity estimate the decision was based on (for review/debugging). */
  equity: number;
}

const LATE_POSITIONS = new Set(["BTN", "CO", "HJ"]);

function isLate(player: Player): boolean {
  return player.position !== null && LATE_POSITIONS.has(player.position);
}

/** ±10% multiplicative noise so bots aren't exploitable by pure pattern memorization. */
function noise(rng: Rng): number {
  return 1 + (rng.next() * 0.2 - 0.1);
}

function find(legal: LegalAction[], type: Action["type"]): LegalAction | undefined {
  return legal.find((l) => l.type === type);
}

/**
 * Decide a bot's action from its personality and an equity estimate (spec Section 05).
 * `equity` is supplied by the caller (preflop table lookup or Monte-Carlo rollout) so this
 * function stays pure and instant. Deterministic given the RNG.
 */
export function decide(
  state: GameState,
  player: Player,
  personality: Personality,
  equity: number,
  rng: Rng,
): Decision {
  const legal = legalActions(state);
  if (legal.length === 0) throw new Error("decide called for a player with no legal actions");

  return state.street === "preflop"
    ? decidePreflop(state, player, personality, equity, legal, rng)
    : decidePostflop(state, player, personality, equity, legal, rng);
}

function decidePreflop(
  state: GameState,
  player: Player,
  p: Personality,
  equity: number,
  legal: LegalAction[],
  rng: Rng,
): Decision {
  const canCheck = find(legal, "check") !== undefined;
  const raiseAction = find(legal, "raise") ?? find(legal, "bet");

  // Wider VPIP -> lower equity needed to enter. Facing a raise demands more.
  const entryEq = 0.34 + (1 - p.vpip) * 0.34;
  const facingRaise = state.currentBet > state.blinds.bb;
  const required = entryEq * noise(rng) + (facingRaise ? 0.06 : 0);

  if (equity < required) {
    if (canCheck) return mk({ type: "check", playerId: player.id }, "checked the option", equity);
    return mk({ type: "fold", playerId: player.id }, foldReason(p), equity);
  }

  // Entering. Of hands played, PFR/VPIP is the share that raises.
  const raiseShare = p.vpip > 0 ? Math.min(1, p.pfr / p.vpip) : 0;
  const wantsRaise = raiseAction && rng.next() < raiseShare * noise(rng);
  if (wantsRaise) {
    const to = preflopRaiseSize(state, player, p, raiseAction, rng);
    return mk(
      { type: raiseAction.type, playerId: player.id, amount: to },
      equity > 0.6 ? "raised for value" : "raised to take the initiative",
      equity,
    );
  }

  if (canCheck) return mk({ type: "check", playerId: player.id }, "checked the option", equity);
  return mk({ type: "call", playerId: player.id }, "called to see a flop", equity);
}

function decidePostflop(
  state: GameState,
  player: Player,
  p: Personality,
  equity: number,
  legal: LegalAction[],
  rng: Rng,
): Decision {
  const toCall = amountToCall(state, player);
  const pot = totalCommitted(state);
  const raiseAction = find(legal, "raise") ?? find(legal, "bet");

  if (toCall === 0) {
    // No bet to face: value-bet, bluff, or check.
    const valueBet = equity > 0.58 && rng.next() < p.aggression * noise(rng);
    const bluff = equity < 0.34 && rng.next() < p.bluffFreq * noise(rng) && isLate(player);
    if (raiseAction && (valueBet || bluff)) {
      const to = betRaiseSize(state, player, p, raiseAction, pot, rng);
      return mk(
        { type: raiseAction.type, playerId: player.id, amount: to },
        bluff ? bluffReason(p) : "bet for value",
        equity,
      );
    }
    return mk({ type: "check", playerId: player.id }, "checked it back", equity);
  }

  // Facing a bet: compare equity to the pot-odds price, adjusted by tightness.
  const potOdds = toCall / (pot + toCall);
  const required = potOdds * p.tightness * noise(rng);

  if (equity < required) {
    // Calling stations chase anything that's already committed; others fold.
    const stationChase = p.bluffFreq === 0 && p.tightness < 0.35 && equity > potOdds * 0.6;
    if (stationChase && find(legal, "call")) {
      return mk({ type: "call", playerId: player.id }, "called anyway — can't let it go", equity);
    }
    return mk({ type: "fold", playerId: player.id }, foldReason(p), equity);
  }

  const valueRaise = equity > 0.64 && rng.next() < p.aggression * noise(rng);
  const bluffRaise = equity < 0.34 && rng.next() < p.bluffFreq * 0.5 * noise(rng) && isLate(player);
  if (raiseAction && (valueRaise || bluffRaise)) {
    const to = betRaiseSize(state, player, p, raiseAction, pot, rng);
    return mk(
      { type: raiseAction.type, playerId: player.id, amount: to },
      bluffRaise ? bluffReason(p) : "raised for value",
      equity,
    );
  }
  return mk({ type: "call", playerId: player.id }, "called with a playable hand", equity);
}

// --- sizing -------------------------------------------------------------------------

function clampTo(action: LegalAction, target: number): number {
  const min = action.min ?? 0;
  const max = action.max ?? min;
  return Math.max(min, Math.min(max, Math.round(target)));
}

function preflopRaiseSize(
  state: GameState,
  player: Player,
  p: Personality,
  action: LegalAction,
  rng: Rng,
): number {
  const bb = state.blinds.bb;
  // ~2.5-4bb opens, larger for maniacs; add a limper premium.
  const openMult = 2.5 + p.aggression * 1.5;
  const jitter = 1 + (rng.next() * 0.3 - 0.15);
  const target = state.currentBet + Math.max(bb, Math.round(state.currentBet * openMult * jitter));
  void player;
  return clampTo(action, target);
}

function betRaiseSize(
  state: GameState,
  player: Player,
  p: Personality,
  action: LegalAction,
  pot: number,
  rng: Rng,
): number {
  // Tight/passive size ~0.5 pot; aggressive/maniac overbet toward ~1.1 pot.
  const frac = 0.45 + p.aggression * 0.6;
  const jitter = 1 + (rng.next() * 0.3 - 0.15);
  const chunk = Math.max(state.minRaise, Math.round(pot * frac * jitter));
  const target = action.type === "bet" ? chunk : state.currentBet + chunk;
  void player;
  return clampTo(action, target);
}

// --- flavor text --------------------------------------------------------------------

function mk(action: Action, reason: string, equity: number): Decision {
  return { action, reason, equity };
}

function foldReason(p: Personality): string {
  if (p.id === "rock") return "folded — only plays premium hands";
  if (p.id === "maniac") return "actually folded — must be pure air";
  return "folded a hand that wasn't worth it";
}

function bluffReason(p: Personality): string {
  if (p.id === "sir-bluffington") return "fired a bluff — the monocle never lies";
  if (p.id === "maniac") return "bluffed, because of course he did";
  return "put in a bluff with air";
}
