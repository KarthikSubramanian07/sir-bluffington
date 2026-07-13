import { monteCarloEquity } from "../ai/equity.ts";
import type { EquityRequest, EquityResponse } from "../ai/equityWorker.ts";
import { makeRng } from "../engine/rng.ts";
import type { Card } from "../engine/types.ts";

type Pending = {
  resolve: (equity: number) => void;
  req: EquityRequest;
};

/**
 * Runs Monte-Carlo equity in a web worker so the table never janks (spec Section 09).
 * Falls back to synchronous computation when Workers are unavailable (tests, SSR).
 */
export class EquityClient {
  private worker: Worker | null = null;
  private nextId = 1;
  private pending = new Map<number, Pending>();

  constructor() {
    if (typeof Worker !== "undefined") {
      try {
        this.worker = new Worker(new URL("../ai/equityWorker.ts", import.meta.url), {
          type: "module",
        });
        this.worker.onmessage = (e: MessageEvent<EquityResponse>) => {
          const entry = this.pending.get(e.data.id);
          if (entry) {
            this.pending.delete(e.data.id);
            entry.resolve(e.data.equity);
          }
        };
        this.worker.onerror = () => {
          // Fail over to synchronous computation for any in-flight requests.
          this.failPendingToSync();
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
      this.pending.set(id, { resolve, req });
      this.worker!.postMessage(req);
    });
  }

  dispose(): void {
    this.failPendingToSync();
  }

  /** Resolve every pending request with a sync equity estimate, then drop the worker. */
  private failPendingToSync(): void {
    const entries = [...this.pending.values()];
    const worker = this.worker;
    this.pending.clear();
    this.worker = null;
    worker?.terminate();
    for (const { resolve, req } of entries) {
      resolve(
        monteCarloEquity(req.hole, req.board, req.numOpponents, req.iterations, makeRng(req.seed)),
      );
    }
  }
}
