/// <reference lib="webworker" />
/**
 * Web worker that runs Monte-Carlo equity rollouts off the main thread so the table UI
 * never janks (spec Section 05/09). The main thread posts an EquityRequest; the worker
 * replies with an EquityResponse carrying the estimated equity.
 */
import { makeRng } from "../engine/rng.ts";
import type { Card } from "../engine/types.ts";
import { monteCarloEquity } from "./equity.ts";

export interface EquityRequest {
  id: number;
  hole: Card[];
  board: Card[];
  numOpponents: number;
  iterations: number;
  seed: number;
}

export interface EquityResponse {
  id: number;
  equity: number;
}

self.onmessage = (e: MessageEvent<EquityRequest>) => {
  const { id, hole, board, numOpponents, iterations, seed } = e.data;
  const equity = monteCarloEquity(hole, board, numOpponents, iterations, makeRng(seed));
  const res: EquityResponse = { id, equity };
  (self as DedicatedWorkerGlobalScope).postMessage(res);
};
