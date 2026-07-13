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

const TABLE_SIZES = new Set([2, 6, 9]);
const DECK_STYLES = new Set<DeckStyle>(["four-color", "two-color"]);
const BOT_SET = new Set<string>(SELECTABLE_BOTS);

function clampInt(value: unknown, fallback: number, min: number, max: number): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}

function sanitizePersonality(value: unknown, fallback: PersonalityId): PersonalityId {
  return typeof value === "string" && BOT_SET.has(value) ? (value as PersonalityId) : fallback;
}

/** Coerce partial/tampered config into a safe TableConfig. */
export function sanitizeConfig(raw: Partial<TableConfig> | null | undefined): TableConfig {
  const merged = { ...DEFAULT_CONFIG, ...(raw ?? {}) };
  const tableSize = TABLE_SIZES.has(merged.tableSize) ? merged.tableSize : DEFAULT_CONFIG.tableSize;
  const deckStyle = DECK_STYLES.has(merged.deckStyle) ? merged.deckStyle : DEFAULT_CONFIG.deckStyle;
  const playerName =
    typeof merged.playerName === "string" && merged.playerName.trim().length > 0
      ? merged.playerName.trim().slice(0, 24)
      : DEFAULT_CONFIG.playerName;
  const startingStack = clampInt(merged.startingStack, DEFAULT_CONFIG.startingStack, 20, 10_000);
  const smallBlind = clampInt(merged.smallBlind, DEFAULT_CONFIG.smallBlind, 1, 500);
  const bigBlind = Math.max(
    smallBlind * 2,
    clampInt(merged.bigBlind, DEFAULT_CONFIG.bigBlind, 2, 1_000),
  );
  const escalateEvery = clampInt(merged.escalateEvery, DEFAULT_CONFIG.escalateEvery, 0, 100);
  const opponentsRaw = Array.isArray(merged.opponents)
    ? merged.opponents
    : DEFAULT_CONFIG.opponents;
  const opponents = fitOpponents(
    opponentsRaw.map((p, i) =>
      sanitizePersonality(p, DEFAULT_CONFIG.opponents[i % DEFAULT_CONFIG.opponents.length]!),
    ),
    tableSize,
  );
  return {
    tableSize,
    opponents,
    startingStack,
    smallBlind,
    bigBlind,
    escalateEvery,
    deckStyle,
    playerName,
  };
}

export function loadConfig(): TableConfig {
  if (typeof localStorage === "undefined") return DEFAULT_CONFIG;
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (!raw) return DEFAULT_CONFIG;
    const parsed = JSON.parse(raw) as Partial<TableConfig>;
    return sanitizeConfig(parsed);
  } catch {
    return DEFAULT_CONFIG;
  }
}

export function saveConfig(config: TableConfig): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(sanitizeConfig(config)));
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
