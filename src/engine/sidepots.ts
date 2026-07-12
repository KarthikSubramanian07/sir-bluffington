import type { SidePot } from "./types.ts";

/** What each player put into the pot over the whole hand, and whether they can still win. */
export interface Contribution {
  playerId: string;
  /** Total chips this player committed this hand (folded players still contribute). */
  committedTotal: number;
  /** false if the player folded — folded players' chips stay in the pot but cannot win it. */
  inHand: boolean;
}

/**
 * Layered side-pot construction — the hardest logic in the engine (spec Section 04).
 *
 * Algorithm: repeatedly peel the smallest remaining contribution level. Every player who
 * still has chips left to peel contributes `level` to that layer; the layer's eligible
 * winners are the still-in (non-folded) contributors at that level. As levels rise, the
 * contributor set only shrinks, so pots are naturally nested — main pot first, side pots
 * after, each with its own `eligiblePlayerIds`.
 *
 * Properties guaranteed:
 *  - Total chips across all pots === sum of all committedTotal (no chips created/lost).
 *  - A player all-in for less than others can only win pots up to their contribution level.
 *  - An uncalled overbet comes back as a solo-eligible top pot (returned to its owner).
 *  - Adjacent layers with identical eligibility are merged (dead blind money doesn't split).
 *
 * @returns pots ordered main-first. Contributions of 0 are ignored.
 */
export function computeSidePots(contributions: Contribution[]): SidePot[] {
  // Working copy of the amount still to peel from each contributor.
  const remaining = contributions
    .filter((c) => c.committedTotal > 0)
    .map((c) => ({ playerId: c.playerId, left: c.committedTotal, inHand: c.inHand }));

  const pots: SidePot[] = [];

  while (true) {
    const active = remaining.filter((r) => r.left > 0);
    if (active.length === 0) break;

    // Smallest positive remaining contribution defines this layer's height.
    const level = Math.min(...active.map((r) => r.left));

    let amount = 0;
    const eligible: string[] = [];
    for (const r of active) {
      r.left -= level;
      amount += level;
      if (r.inHand) eligible.push(r.playerId);
    }

    // A layer with no eligible winners (everyone at this level folded) is dead money;
    // fold it into the previous pot rather than dropping the chips.
    if (eligible.length === 0) {
      if (pots.length > 0) {
        pots[pots.length - 1]!.amount += amount;
      } else {
        // No prior pot yet (everyone all-in folded at the base level, impossible in a real
        // hand since a fold-out ends before showdown) — keep the chips in a dead pot.
        pots.push({ amount, eligiblePlayerIds: [] });
      }
      continue;
    }

    const sortedEligible = eligible.slice().sort();
    const prev = pots[pots.length - 1];
    if (prev && sameMembers(prev.eligiblePlayerIds, sortedEligible)) {
      // Merge adjacent layers with identical eligibility (e.g. a folded player's dead
      // blind creating a layer that doesn't change who can win).
      prev.amount += amount;
    } else {
      pots.push({ amount, eligiblePlayerIds: sortedEligible });
    }
  }

  return pots;
}

function sameMembers(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

/** Convenience: total chips across all pots. */
export function totalPot(pots: SidePot[]): number {
  return pots.reduce((sum, p) => sum + p.amount, 0);
}
