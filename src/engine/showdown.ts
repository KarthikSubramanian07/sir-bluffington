import type { HandEvaluator } from "./handEval.ts";
import { type Contribution, computeSidePots } from "./sidepots.ts";
import type { Card, SidePot } from "./types.ts";

/** Per-player info the showdown needs to award pots. */
export interface Contender {
  playerId: string;
  holeCards: Card[];
  inHand: boolean;
  committedTotal: number;
  seatIndex: number;
}

/** The result of awarding a single pot. */
export interface PotAward {
  amount: number;
  eligiblePlayerIds: string[];
  winnerIds: string[];
  /** Floor share each winner receives. */
  perWinner: number;
  /** Number of odd chips distributed one-by-one to winners left of the button. */
  oddChips: number;
  /** Winning hand category, if a real showdown occurred (5-card board, >1 contender). */
  handName: string | null;
  handDescr: string | null;
}

export interface ShowdownResult {
  pots: SidePot[];
  awards: PotAward[];
  /** Net chips awarded to each player id (only winners appear). */
  winningsByPlayer: Record<string, number>;
}

/**
 * Award every pot independently to the best eligible hand (spec Section 04).
 *
 * - Side pots are computed from each player's committedTotal.
 * - Each pot is awarded to the best eligible hand; ties split, with odd chips going one
 *   at a time to the winner(s) first to the left of the button.
 * - Works for true showdowns (5-card board) and fold-outs (a single eligible player per
 *   pot), where hand evaluation is skipped.
 */
export function settleShowdown(
  contenders: Contender[],
  board: Card[],
  button: number,
  numSeats: number,
  evaluator: HandEvaluator,
): ShowdownResult {
  const contribs: Contribution[] = contenders.map((c) => ({
    playerId: c.playerId,
    committedTotal: c.committedTotal,
    inHand: c.inHand,
  }));
  const pots = computeSidePots(contribs);

  const byId = new Map(contenders.map((c) => [c.playerId, c]));
  const winningsByPlayer: Record<string, number> = {};
  const awards: PotAward[] = [];

  for (const pot of pots) {
    // Only still-in players with hole cards can win.
    const eligible = pot.eligiblePlayerIds
      .map((id) => byId.get(id))
      .filter((c): c is Contender => Boolean(c?.inHand));

    if (eligible.length === 0) {
      // Dead pot (should not occur in a real hand). Record it with no winners.
      awards.push({
        amount: pot.amount,
        eligiblePlayerIds: pot.eligiblePlayerIds,
        winnerIds: [],
        perWinner: 0,
        oddChips: 0,
        handName: null,
        handDescr: null,
      });
      continue;
    }

    const isRealShowdown = board.length === 5 && eligible.length > 1;
    const winnerIds =
      eligible.length === 1
        ? [eligible[0]!.playerId]
        : evaluator.winners(
            eligible.map((c) => ({ playerId: c.playerId, holeCards: c.holeCards })),
            board,
          );

    // Order winners by seats clockwise from the button, so odd chips go to the first
    // player left of the button first.
    const orderedWinners = winnerIds
      .map((id) => byId.get(id)!)
      .sort(
        (a, b) =>
          seatOrderFromButton(a.seatIndex, button, numSeats) -
          seatOrderFromButton(b.seatIndex, button, numSeats),
      )
      .map((c) => c.playerId);

    const perWinner = Math.floor(pot.amount / orderedWinners.length);
    let oddChips = pot.amount - perWinner * orderedWinners.length;
    const distributedOdd = oddChips;

    for (const id of orderedWinners) {
      let share = perWinner;
      if (oddChips > 0) {
        share += 1;
        oddChips -= 1;
      }
      winningsByPlayer[id] = (winningsByPlayer[id] ?? 0) + share;
    }

    let handName: string | null = null;
    let handDescr: string | null = null;
    if (isRealShowdown) {
      const w = byId.get(orderedWinners[0]!)!;
      const evald = evaluator.evaluate([...w.holeCards, ...board]);
      handName = evald.name;
      handDescr = evald.descr;
    }

    awards.push({
      amount: pot.amount,
      eligiblePlayerIds: pot.eligiblePlayerIds,
      winnerIds: orderedWinners,
      perWinner,
      oddChips: distributedOdd,
      handName,
      handDescr,
    });
  }

  return { pots, awards, winningsByPlayer };
}

/**
 * Clockwise distance from the button, where the first seat left of the button ranks first
 * and the button itself ranks last. Used for odd-chip distribution order.
 */
function seatOrderFromButton(seatIndex: number, button: number, numSeats: number): number {
  const offset = (seatIndex - button + numSeats) % numSeats;
  return offset === 0 ? numSeats : offset;
}
