import { decide } from "../ai/decide.ts";
import { estimateEquity } from "../ai/equity.ts";
import { getPersonality } from "../ai/personalities.ts";
import { applyAction, isHandFoldedOut } from "../engine/betting.ts";
import { isShowdown, progressHand, settleHand, startHand } from "../engine/game.ts";
import type { HandConfig, SeatConfig } from "../engine/hand.ts";
import { type Rng, makeAutoRng } from "../engine/rng.ts";
import type { ShowdownResult } from "../engine/showdown.ts";
import type { Action, GameState, PersonalityId, Player, Street } from "../engine/types.ts";
import type { TableConfig } from "./config.ts";
import { EquityClient } from "./equityClient.ts";
import { type Stats, loadStats, saveStats } from "./stats.ts";

export type Phase = "config" | "hand" | "showdown";

/** One recorded action, used to build the post-hand "why" review (spec Section 06). */
export interface LogEntry {
  seatIndex: number;
  playerId: string;
  name: string;
  personalityId: PersonalityId;
  street: Street;
  action: Action["type"];
  amount: number | null;
  reason: string;
}

export interface Snapshot {
  phase: Phase;
  config: TableConfig;
  state: GameState | null;
  showdown: ShowdownResult | null;
  log: LogEntry[];
  stats: Stats;
  /** Seat currently "thinking" (a bot), for the UI pulse. */
  thinkingSeat: number | null;
  handNumber: number;
  message: string | null;
}

const HUMAN_ID = "hero";
const STREET_INDEX: Record<Street, number> = {
  preflop: 0,
  flop: 1,
  turn: 2,
  river: 3,
  showdown: 4,
};

/**
 * Orchestrates a solo session: deals hands, drives bot turns (paced, with worker-backed
 * equity), routes human input, rotates the button, handles rebuys and blind escalation, and
 * keeps persistent stats. Exposes a subscribe/getSnapshot surface for React.
 */
/** Test/tuning hooks: a seeded RNG for determinism and a zeroed bot delay for speed. */
export interface ControllerOptions {
  rng?: Rng;
  botDelayMs?: number;
}

export class GameController {
  private snapshot: Snapshot;
  private listeners = new Set<() => void>();
  private rng: Rng;
  private equity = new EquityClient();
  private running = false;
  private cancelled = false;
  private botDelayMs: number;

  private preHandStacks = new Map<string, number>();
  private handNumber = 0;
  private button = 0;
  private blinds = { sb: 1, bb: 2, ante: 0 };

  constructor(config: TableConfig, options: ControllerOptions = {}) {
    this.rng = options.rng ?? makeAutoRng();
    this.botDelayMs = options.botDelayMs ?? 600;
    this.snapshot = {
      phase: "config",
      config,
      state: null,
      showdown: null,
      log: [],
      stats: loadStats(),
      thinkingSeat: null,
      handNumber: 0,
      message: null,
    };
  }

  // --- React store surface ----------------------------------------------------------

  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  getSnapshot = (): Snapshot => this.snapshot;

  private set(patch: Partial<Snapshot>): void {
    this.snapshot = { ...this.snapshot, ...patch };
    for (const fn of this.listeners) fn();
  }

  // --- session control --------------------------------------------------------------

  startSession(config: TableConfig): void {
    this.cancelled = false;
    this.blinds = { sb: config.smallBlind, bb: config.bigBlind, ante: 0 };
    this.handNumber = 0;
    this.button = this.rng.int(config.tableSize);
    this.set({ config, phase: "hand", stats: loadStats() });
    this.dealHand(config);
  }

  leaveTable(): void {
    this.cancelled = true;
    this.set({ phase: "config", state: null, showdown: null, thinkingSeat: null, message: null });
  }

  nextHand(): void {
    if (this.snapshot.phase !== "showdown") return;
    this.button = this.nextOccupiedSeat(this.button);
    this.maybeEscalateBlinds();
    this.dealHand(this.snapshot.config);
  }

  /** Apply the human's chosen action, then let play continue. */
  humanAction(action: Action): void {
    const s = this.snapshot.state;
    if (!s || s.actor === null) return;
    const actor = this.playerAt(s, s.actor);
    if (!actor.isHuman) return;
    this.applyAndLog(action, this.humanReason(action));
    void this.advance();
  }

  dispose(): void {
    this.cancelled = true;
    this.equity.dispose();
    this.listeners.clear();
  }

  // --- hand lifecycle ---------------------------------------------------------------

  private buildSeats(config: TableConfig): SeatConfig[] {
    const seats: SeatConfig[] = [];
    // Seat 0 is always the human, sitting at the bottom of the table.
    const prev = this.snapshot.state?.players ?? [];
    const stackOf = (id: string, fallback: number): number => {
      const p = prev.find((x) => x.id === id);
      if (!p) return fallback;
      // Rebuy anyone who can't cover a big blind so the session keeps flowing.
      return p.stack < config.bigBlind ? config.startingStack : p.stack;
    };

    seats.push({
      id: HUMAN_ID,
      name: config.playerName || "You",
      isHuman: true,
      personalityId: "human",
      stack: stackOf(HUMAN_ID, config.startingStack),
      seatIndex: 0,
    });
    config.opponents.slice(0, config.tableSize - 1).forEach((pid, i) => {
      const id = `bot${i}`;
      seats.push({
        id,
        name: getPersonality(pid)?.name ?? `Bot ${i + 1}`,
        isHuman: false,
        personalityId: pid,
        stack: stackOf(id, config.startingStack),
        seatIndex: i + 1,
      });
    });
    return seats;
  }

  private dealHand(config: TableConfig): void {
    this.handNumber += 1;
    const seats = this.buildSeats(config);
    this.preHandStacks = new Map(seats.map((s) => [s.id, s.stack]));

    const handConfig: HandConfig = {
      blinds: this.blinds,
      button: this.button,
      handNumber: this.handNumber,
    };
    const state = startHand(seats, handConfig, this.rng);
    this.set({
      phase: "hand",
      state,
      showdown: null,
      log: [],
      thinkingSeat: null,
      handNumber: this.handNumber,
      message: null,
    });
    void this.advance();
  }

  private async advance(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      while (!this.cancelled) {
        const s = this.snapshot.state;
        if (!s) break;

        if (isHandFoldedOut(s)) {
          this.settle();
          break;
        }
        if (s.actor === null) {
          const prog = progressHand(s);
          if (prog.kind === "settled") {
            this.applySettled(prog.state, prog.result);
            break;
          }
          this.set({ state: prog.state });
          continue;
        }

        const actor = this.playerAt(s, s.actor);
        if (actor.isHuman) {
          this.set({ thinkingSeat: null });
          break; // wait for humanAction()
        }

        this.set({ thinkingSeat: actor.seatIndex });
        await this.delay(this.botDelayMs);
        if (this.cancelled || this.snapshot.state !== s) break;

        const decision = await this.botDecision(s, actor);
        if (this.cancelled || this.snapshot.state !== s) break;
        this.applyAndLog(decision.action, decision.reason);
      }
    } finally {
      this.running = false;
      this.set({ thinkingSeat: null });
    }
  }

  private async botDecision(state: GameState, actor: Player) {
    const personality = getPersonality(actor.personalityId);
    if (!personality) throw new Error(`No personality for ${actor.id}`);
    const oppInHand = state.players.filter((p) => p.inHand && p.id !== actor.id).length;

    let equity: number;
    if (state.board.length === 0) {
      equity = estimateEquity(actor.holeCards, [], oppInHand, this.rng);
    } else {
      const seed =
        (state.handNumber * 131 +
          STREET_INDEX[state.street] * 17 +
          actor.seatIndex * 7 +
          this.rng.int(1_000_000)) >>>
        0;
      const iterations = oppInHand <= 2 ? 320 : 200;
      equity = await this.equity.estimate(
        actor.holeCards,
        state.board,
        Math.min(oppInHand, 4),
        iterations,
        seed,
      );
    }
    return decide(state, actor, personality, equity, this.rng);
  }

  private applyAndLog(action: Action, reason: string): void {
    const s = this.snapshot.state;
    if (!s) return;
    const actor = this.playerAt(s, s.actor ?? -1);
    const next = applyAction(s, action);
    const entry: LogEntry = {
      seatIndex: actor.seatIndex,
      playerId: actor.id,
      name: actor.name,
      personalityId: actor.personalityId,
      street: s.street,
      action: action.type,
      amount: action.amount ?? null,
      reason,
    };
    this.set({ state: next, log: [...this.snapshot.log, entry] });
  }

  private settle(): void {
    const s = this.snapshot.state;
    if (!s) return;
    const { state, result } = settleHand(s);
    this.applySettled(state, result);
  }

  private applySettled(state: GameState, result: ShowdownResult): void {
    const stats = this.updateStats(state, result);
    this.set({
      phase: "showdown",
      state,
      showdown: result,
      thinkingSeat: null,
      stats,
    });
    saveStats(stats);
  }

  // --- stats ------------------------------------------------------------------------

  private updateStats(state: GameState, result: ShowdownResult): Stats {
    const stats: Stats = { ...this.snapshot.stats, vsBot: { ...this.snapshot.stats.vsBot } };
    const humanBefore = this.preHandStacks.get(HUMAN_ID) ?? 0;
    const humanAfter = state.players.find((p) => p.id === HUMAN_ID)?.stack ?? humanBefore;
    const delta = humanAfter - humanBefore;

    stats.handsPlayed += 1;
    stats.netChips += delta;
    const humanWon = result.winningsByPlayer[HUMAN_ID] ?? 0;
    if (humanWon > 0) {
      stats.handsWon += 1;
      stats.biggestPotWon = Math.max(stats.biggestPotWon, humanWon);
    }

    const human = state.players.find((p) => p.id === HUMAN_ID);
    if (isShowdown(state) && human?.inHand) {
      stats.showdownsSeen += 1;
      if (humanWon > 0) stats.showdownsWon += 1;
    }

    // Attribute the hand's net result across the bots that put money in.
    const contributors = state.players.filter((p) => !p.isHuman && p.committedTotal > 0);
    if (contributors.length > 0 && delta !== 0) {
      const share = delta / contributors.length;
      for (const bot of contributors) {
        stats.vsBot[bot.personalityId] = (stats.vsBot[bot.personalityId] ?? 0) + share;
      }
    }
    return stats;
  }

  // --- helpers ----------------------------------------------------------------------

  private maybeEscalateBlinds(): void {
    const { escalateEvery } = this.snapshot.config;
    if (escalateEvery > 0 && this.handNumber > 0 && this.handNumber % escalateEvery === 0) {
      this.blinds = { sb: this.blinds.sb * 2, bb: this.blinds.bb * 2, ante: this.blinds.ante };
      this.set({ message: `Blinds up: ${this.blinds.sb}/${this.blinds.bb}` });
    }
  }

  private nextOccupiedSeat(from: number): number {
    const n = this.snapshot.config.tableSize;
    return (from + 1) % n;
  }

  private playerAt(s: GameState, seat: number): Player {
    const p = s.players.find((x) => x.seatIndex === seat);
    if (!p) throw new Error(`No player at seat ${seat}`);
    return p;
  }

  private humanReason(action: Action): string {
    switch (action.type) {
      case "fold":
        return "you folded";
      case "check":
        return "you checked";
      case "call":
        return "you called";
      case "bet":
        return "you bet";
      case "raise":
        return "you raised";
      default:
        return "you acted";
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
