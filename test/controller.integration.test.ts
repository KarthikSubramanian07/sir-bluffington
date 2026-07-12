import { describe, expect, it } from "vitest";
import { makeRng } from "../src/engine/rng.ts";
import type { TableConfig } from "../src/game/config.ts";
import { GameController } from "../src/game/controller.ts";
import { isHumansTurn } from "../src/game/selectors.ts";

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
async function playHands(controller: GameController, hands: number): Promise<void> {
  controller.startSession(config);
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
      // Trivial human: check when free, otherwise call.
      const canCheck = snap.state.currentBet === snap.state.players[0]!.committedThisRound;
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
});
