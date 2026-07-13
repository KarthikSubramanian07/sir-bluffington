/**
 * Deterministic, seedable PRNG (mulberry32). Tiny, dependency-free, and reproducible -
 * essential for deterministic tests and for reproducible Monte-Carlo equity rollouts.
 *
 * Not cryptographically secure; that is irrelevant for a play-money trainer.
 */

export interface Rng {
  /** Uniform float in [0, 1). */
  next(): number;
  /** Uniform integer in [0, maxExclusive). */
  int(maxExclusive: number): number;
}

/** mulberry32: a fast, well-distributed 32-bit generator. */
export function makeRng(seed: number): Rng {
  let a = seed >>> 0;
  const next = (): number => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (maxExclusive: number) => Math.floor(next() * maxExclusive),
  };
}

/**
 * A default RNG seeded from the current time, for real play. Kept behind a factory so
 * that no module reads the clock at import time (which would break determinism in tests).
 */
export function makeAutoRng(): Rng {
  // 0x9e3779b9 mixing keeps low-entropy time seeds well-spread.
  const seed = (Date.now() ^ (Date.now() >>> 9) ^ 0x9e3779b9) >>> 0;
  return makeRng(seed);
}
