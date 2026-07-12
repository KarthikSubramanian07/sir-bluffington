import type { PersonalityId } from "../engine/types.ts";

/** Session/lifetime stats persisted to localStorage (spec Section 06). */
export interface Stats {
  handsPlayed: number;
  handsWon: number;
  showdownsSeen: number;
  showdownsWon: number;
  biggestPotWon: number;
  /** Net chips across the session, independent of rebuys. */
  netChips: number;
  /** Per-bot head-to-head chip result (positive = you're up against them). */
  vsBot: Partial<Record<PersonalityId, number>>;
}

const STATS_KEY = "sirbluff.stats.v1";

export function emptyStats(): Stats {
  return {
    handsPlayed: 0,
    handsWon: 0,
    showdownsSeen: 0,
    showdownsWon: 0,
    biggestPotWon: 0,
    netChips: 0,
    vsBot: {},
  };
}

export function loadStats(): Stats {
  if (typeof localStorage === "undefined") return emptyStats();
  try {
    const raw = localStorage.getItem(STATS_KEY);
    if (!raw) return emptyStats();
    return { ...emptyStats(), ...(JSON.parse(raw) as Partial<Stats>) };
  } catch {
    return emptyStats();
  }
}

export function saveStats(stats: Stats): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STATS_KEY, JSON.stringify(stats));
  } catch {
    // non-fatal
  }
}

export function resetStats(): Stats {
  const fresh = emptyStats();
  saveStats(fresh);
  return fresh;
}

export function showdownWinRate(stats: Stats): number {
  return stats.showdownsSeen === 0 ? 0 : stats.showdownsWon / stats.showdownsSeen;
}
