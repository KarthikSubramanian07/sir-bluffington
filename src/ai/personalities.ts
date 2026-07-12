import type { PersonalityId } from "../engine/types.ts";

/**
 * Parameterized, rule-based bot personalities (spec Section 05). Deliberately NOT ML: each
 * bot is a small set of tunable knobs so behaviour is data-driven, testable, and
 * "exploitable but not trivial". Values are 0..1 unless noted.
 */
export interface Personality {
  id: PersonalityId;
  name: string;
  /** One-line character used in the UI and post-hand "why" insights. */
  tagline: string;
  /** Voluntarily-put-money-in-pot frequency — how often they play a hand at all. */
  vpip: number;
  /** Preflop-raise frequency — how often playing means raising. */
  pfr: number;
  /** How readily they bet/raise rather than call when continuing. */
  aggression: number;
  /** How often they fire with weak holdings (a pure bluff). */
  bluffFreq: number;
  /**
   * How much extra equity they demand to continue. >1 folds more (tight); <1 calls light.
   * Used as a multiplier on the pot-odds threshold.
   */
  tightness: number;
  /** Adaptivity: shifts strategy based on observed opponent tendencies (Sir Bluffington). */
  adaptivity: number;
}

export const PERSONALITIES: Record<Exclude<PersonalityId, "human">, Personality> = {
  rock: {
    id: "rock",
    name: "The Rock",
    tagline: "Folds unless he's holding the nuts.",
    vpip: 0.15,
    pfr: 0.12,
    aggression: 0.3,
    bluffFreq: 0.05,
    tightness: 0.9,
    adaptivity: 0.0,
  },
  maniac: {
    id: "maniac",
    name: "The Maniac",
    tagline: "Raises now, thinks never.",
    vpip: 0.6,
    pfr: 0.45,
    aggression: 0.9,
    bluffFreq: 0.4,
    tightness: 0.2,
    adaptivity: 0.0,
  },
  "calling-station": {
    id: "calling-station",
    name: "The Calling Station",
    tagline: "Never met a bet she didn't call.",
    vpip: 0.55,
    pfr: 0.1,
    aggression: 0.2,
    bluffFreq: 0.0,
    tightness: 0.3,
    adaptivity: 0.0,
  },
  shark: {
    id: "shark",
    name: "The Shark",
    tagline: "Balanced, positional, patient.",
    vpip: 0.28,
    pfr: 0.22,
    aggression: 0.7,
    bluffFreq: 0.2,
    tightness: 0.6,
    adaptivity: 0.3,
  },
  "sir-bluffington": {
    id: "sir-bluffington",
    name: "Sir Bluffington",
    tagline: "The monocled menace. Adaptive, tricky, and full of it.",
    vpip: 0.35,
    pfr: 0.3,
    aggression: 0.75,
    bluffFreq: 0.35,
    tightness: 0.5,
    adaptivity: 0.6,
  },
};

export const PERSONALITY_LIST: Personality[] = [
  PERSONALITIES.rock,
  PERSONALITIES["calling-station"],
  PERSONALITIES.maniac,
  PERSONALITIES.shark,
  PERSONALITIES["sir-bluffington"],
];

export function getPersonality(id: PersonalityId): Personality | null {
  if (id === "human") return null;
  return PERSONALITIES[id];
}
