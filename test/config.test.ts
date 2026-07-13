import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG, sanitizeConfig } from "../src/game/config.ts";

describe("sanitizeConfig", () => {
  it("returns defaults for empty input", () => {
    expect(sanitizeConfig({})).toEqual(DEFAULT_CONFIG);
    expect(sanitizeConfig(null)).toEqual(DEFAULT_CONFIG);
  });

  it("rejects invalid table sizes and deck styles", () => {
    const cfg = sanitizeConfig({ tableSize: 999, deckStyle: "neon" as never });
    expect(cfg.tableSize).toBe(DEFAULT_CONFIG.tableSize);
    expect(cfg.deckStyle).toBe(DEFAULT_CONFIG.deckStyle);
  });

  it("clamps numeric fields and enforces bb >= 2*sb", () => {
    const cfg = sanitizeConfig({
      startingStack: -5,
      smallBlind: 50,
      bigBlind: 10,
      escalateEvery: 9999,
    });
    expect(cfg.startingStack).toBe(20);
    expect(cfg.smallBlind).toBe(50);
    expect(cfg.bigBlind).toBe(100);
    expect(cfg.escalateEvery).toBe(100);
  });

  it("filters unknown bots and fits opponents to table size", () => {
    const cfg = sanitizeConfig({
      tableSize: 2,
      opponents: ["not-a-bot" as never, "shark", "maniac"],
    });
    expect(cfg.opponents).toHaveLength(1);
    expect(cfg.opponents[0]).toBe("rock"); // fallback for unknown, then fit to HU
  });

  it("trims and truncates player names", () => {
    const cfg = sanitizeConfig({ playerName: `  ${"x".repeat(40)}  ` });
    expect(cfg.playerName).toHaveLength(24);
  });
});
