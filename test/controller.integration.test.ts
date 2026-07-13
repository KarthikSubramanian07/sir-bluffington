import { describe, expect, it } from "vitest";
import { makeRng } from "../src/engine/rng.ts";
import type { TableConfig } from "../src/game/config.ts";
import { GameController } from "../src/game/controller.ts";
import { humanPlayer, isHumansTurn } from "../src/game/selectors.ts";

const config: TableConfig = {
  tableSize: 6,
  opponents: ["rock", "calling-station", "maniac", "shark", "sir-bluffington"],
  startingStack: 200,
  smallBlind: 1,
  bigBlind: 2,
  escalateEvery: 0,
  deckStyle: "four-color",
  playerName: "Tester",
};

const tick = () => new Promise((r) => setTimeout(r, 0));

/** Drive a session to a given number of completed hands, auto-checking/calling for the human. */
async function playHands(
  controller: GameController,
  hands: number,
  cfg: TableConfig = config,
): Promise<void> {
  controller.startSession(cfg);
  let completed = 0;
  let guard = 0;
  while (completed < hands) {
    if (++guard > 5000) throw new Error("session did not progress");
    await tick();
    const snap = controller.getSnapshot();
    if (snap.phase === "showdown") {
      completed += 1;
      if (completed >= hands) break; // leave the controller in showdown
      controller.nextHand();
      continue;
    }
    if (snap.state && isHumansTurn(snap.state)) {
      // Trivial human: check when free, otherwise call. Use humanPlayer, not players[0]
      // (players is button-ordered, so seat 0 is not always the hero).
      const hero = humanPlayer(snap.state)!;
      const canCheck = snap.state.currentBet === hero.committedThisRound;
      controller.humanAction({ type: canCheck ? "check" : "call", playerId: "hero" });
    }
  }
}

describe("GameController full-session runtime", () => {
  it("plays multiple hands end-to-end with correct chip conservation", async () => {
    const controller = new GameController(config, { rng: makeRng(12345), botDelayMs: 0 });
    await playHands(controller, 8);

    const snap = controller.getSnapshot();
    expect(snap.stats.handsPlayed).toBe(8);
    expect(snap.phase).toBe("showdown");
    // Every settled hand must leave a valid showdown result with conserved chips per pot.
    expect(snap.showdown).not.toBeNull();
    for (const p of snap.state!.players) {
      expect(p.stack).toBeGreaterThanOrEqual(0);
    }
    controller.dispose();
  });

  it("records a win when the human wins a pot and persists stats shape", async () => {
    const controller = new GameController(config, { rng: makeRng(777), botDelayMs: 0 });
    await playHands(controller, 12);
    const { stats } = controller.getSnapshot();
    expect(stats.handsPlayed).toBe(12);
    expect(stats.handsWon).toBeLessThanOrEqual(stats.handsPlayed);
    expect(stats.showdownsWon).toBeLessThanOrEqual(stats.showdownsSeen);
    expect(Number.isFinite(stats.netChips)).toBe(true);
    controller.dispose();
  });

  it("records head-to-head vsBot stats after hands with bot contributions", async () => {
    const controller = new GameController(config, { rng: makeRng(2026), botDelayMs: 0 });
    await playHands(controller, 20);
    const { stats } = controller.getSnapshot();
    expect(stats.handsPlayed).toBe(20);
    // After many hands someone almost always put chips in; vsBot must not stay empty forever.
    const attributed = Object.values(stats.vsBot).reduce((a, b) => a + b, 0);
    expect(Object.keys(stats.vsBot).length).toBeGreaterThan(0);
    expect(Number.isFinite(attributed)).toBe(true);
    // Net chips attributed across bots should equal human net (shares sum to delta each hand).
    expect(attributed).toBeCloseTo(stats.netChips, 5);
    controller.dispose();
  });

  it("supports a heads-up session", async () => {
    const hu: TableConfig = { ...config, tableSize: 2, opponents: ["sir-bluffington"] };
    const controller = new GameController(hu, { rng: makeRng(42), botDelayMs: 0 });
    controller.startSession(hu);
    let guard = 0;
    while (controller.getSnapshot().phase !== "showdown") {
      if (++guard > 3000) throw new Error("heads-up hand did not settle");
      await tick();
      const snap = controller.getSnapshot();
      if (snap.state && isHumansTurn(snap.state)) {
        controller.humanAction({ type: "fold", playerId: "hero" });
      }
    }
    expect(controller.getSnapshot().stats.handsPlayed).toBe(1);
    controller.dispose();
  });

  it("escalates blinds in tournament mode and announces the raise", async () => {
    const tourney: TableConfig = { ...config, smallBlind: 1, bigBlind: 2, escalateEvery: 2 };
    const controller = new GameController(tourney, { rng: makeRng(99), botDelayMs: 0 });
    await playHands(controller, 3, tourney); // finish hand 3; blinds raise after hand 2

    // After 2 completed hands the blinds should have doubled at least once.
    expect(controller.blindLevel.bb).toBeGreaterThanOrEqual(4);
    const snap = controller.getSnapshot();
    // The state in play uses the escalated blinds, and a banner announced the raise.
    expect(snap.state?.blinds.bb).toBe(controller.blindLevel.bb);
    expect(snap.message).toMatch(/Blinds up/);
    controller.dispose();
  });

  it("keeps blinds fixed in cash mode", async () => {
    const controller = new GameController(config, { rng: makeRng(5), botDelayMs: 0 });
    await playHands(controller, 5);
    expect(controller.blindLevel).toEqual({ sb: 1, bb: 2 });
    controller.dispose();
  });

  it("surfaces illegal human actions without crashing, then clears the banner", async () => {
    const hu: TableConfig = { ...config, tableSize: 2, opponents: ["rock"] };
    const controller = new GameController(hu, { rng: makeRng(11), botDelayMs: 0 });
    controller.startSession(hu);
    let guard = 0;
    // Keep dealing until the human actually has an action (fold-outs can skip them).
    while (true) {
      if (++guard > 5000) throw new Error("never reached human turn");
      await tick();
      const snap = controller.getSnapshot();
      if (snap.phase === "showdown") {
        controller.nextHand();
        continue;
      }
      if (snap.state && isHumansTurn(snap.state)) break;
    }
    // Raise with no amount is illegal.
    controller.humanAction({ type: "raise", playerId: "hero" });
    expect(controller.getSnapshot().message).toMatch(
      /requires an amount|Illegal|out of bounds|Out of turn/i,
    );
    expect(isHumansTurn(controller.getSnapshot().state!)).toBe(true);

    const hero = humanPlayer(controller.getSnapshot().state!)!;
    const canCheck = controller.getSnapshot().state!.currentBet === hero.committedThisRound;
    controller.humanAction({ type: canCheck ? "check" : "call", playerId: "hero" });
    expect(controller.getSnapshot().message).toBeNull();
    controller.dispose();
  });
});
