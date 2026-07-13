import type { PersonalityId } from "../engine/types.ts";

export type DeckStyle = "four-color" | "two-color";

export interface TableConfig {
  /** Total seats including the human (2, 6, or 9). */
  tableSize: number;
  /** Personality of each bot seat, in order (length = tableSize - 1). */
  opponents: PersonalityId[];
  startingStack: number;
  smallBlind: number;
  bigBlind: number;
  /** Escalate blinds every N hands (tournament feel). 0 = fixed (cash). */
  escalateEvery: number;
  deckStyle: DeckStyle;
  playerName: string;
}

const CONFIG_KEY = "sirbluff.config.v1";

export const DEFAULT_CONFIG: TableConfig = {
  tableSize: 6,
  opponents: ["rock", "calling-station", "maniac", "shark", "sir-bluffington"],
  startingStack: 200,
  smallBlind: 1,
  bigBlind: 2,
  escalateEvery: 0,
  deckStyle: "four-color",
  playerName: "You",
};

/** All selectable bot personalities (excludes the human). */
export const SELECTABLE_BOTS: Exclude<PersonalityId, "human">[] = [
  "rock",
  "calling-station",
  "maniac",
  "shark",
  "sir-bluffington",
];

export function loadConfig(): TableConfig {
  if (typeof localStorage === "undefined") return DEFAULT_CONFIG;
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (!raw) return DEFAULT_CONFIG;
    const parsed = JSON.parse(raw) as Partial<TableConfig>;
    return { ...DEFAULT_CONFIG, ...parsed };
  } catch {
    return DEFAULT_CONFIG;
  }
}

export function saveConfig(config: TableConfig): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
  } catch {
    // storage full or blocked; non-fatal, the app runs fine without persistence.
  }
}

/** Resize the opponents list to match a table size, filling from a sensible rotation. */
export function fitOpponents(opponents: PersonalityId[], tableSize: number): PersonalityId[] {
  const needed = tableSize - 1;
  const rotation: PersonalityId[] = [
    "sir-bluffington",
    "shark",
    "maniac",
    "calling-station",
    "rock",
    "shark",
    "maniac",
    "rock",
  ];
  const next = opponents.slice(0, needed);
  let i = 0;
  while (next.length < needed) {
    next.push(rotation[i % rotation.length]!);
    i++;
  }
  return next;
}
