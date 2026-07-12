import { monteCarloEquity } from "../ai/equity.ts";
import type { EquityRequest, EquityResponse } from "../ai/equityWorker.ts";
import { makeRng } from "../engine/rng.ts";
import type { Card } from "../engine/types.ts";

/**
 * Runs Monte-Carlo equity in a web worker so the table never janks (spec Section 09).
 * Falls back to synchronous computation when Workers are unavailable (tests, SSR).
 */
export class EquityClient {
  private worker: Worker | null = null;
  private nextId = 1;
  private pending = new Map<number, (equity: number) => void>();

  constructor() {
    if (typeof Worker !== "undefined") {
      try {
        this.worker = new Worker(new URL("../ai/equityWorker.ts", import.meta.url), {
          type: "module",
        });
        this.worker.onmessage = (e: MessageEvent<EquityResponse>) => {
          const resolve = this.pending.get(e.data.id);
          if (resolve) {
            this.pending.delete(e.data.id);
            resolve(e.data.equity);
          }
        };
        this.worker.onerror = () => {
          // Fail over to synchronous computation for any in-flight requests.
          this.worker = null;
        };
      } catch {
        this.worker = null;
      }
    }
  }

  estimate(
    hole: Card[],
    board: Card[],
    numOpponents: number,
    iterations: number,
    seed: number,
  ): Promise<number> {
    if (!this.worker) {
      return Promise.resolve(
        monteCarloEquity(hole, board, numOpponents, iterations, makeRng(seed)),
      );
    }
    const id = this.nextId++;
    const req: EquityRequest = { id, hole, board, numOpponents, iterations, seed };
    return new Promise((resolve) => {
      this.pending.set(id, resolve);
      this.worker!.postMessage(req);
    });
  }

  dispose(): void {
    this.worker?.terminate();
    this.worker = null;
    this.pending.clear();
  }
}
