import type { Suit as SuitType } from "../../engine/types.ts";

/** Compact 24×24 suit glyphs, filled with the current color. */
const PATHS: Record<SuitType, string> = {
  h: "M12 21s-8.6-5.4-8.6-11.6A4.6 4.6 0 0 1 12 6.3a4.6 4.6 0 0 1 8.6 3.1C20.6 15.6 12 21 12 21z",
  s: "M12 2.2C12 2.2 3.6 9.2 3.6 14a4.2 4.2 0 0 0 7.2 2.9C10.5 18.8 9.8 20.2 8.7 21h6.6c-1.1-.8-1.8-2.2-2.1-4.1A4.2 4.2 0 0 0 20.4 14C20.4 9.2 12 2.2 12 2.2z",
  d: "M12 2.4 19.2 12 12 21.6 4.8 12z",
  c: "M12 2.2a3.2 3.2 0 0 0-2.5 5.2 3.2 3.2 0 1 0 .4 5.6c.5 0 1-.1 1.5-.4-.2 2-.9 3.7-2 4.8l-.8.6h6.8l-.8-.6c-1.1-1.1-1.8-2.8-2-4.8.5.3 1 .4 1.5.4a3.2 3.2 0 1 0 .4-5.6A3.2 3.2 0 0 0 12 2.2z",
};

const COLOR_VAR: Record<SuitType, string> = {
  s: "var(--suit-spade)",
  h: "var(--suit-heart)",
  d: "var(--suit-diamond)",
  c: "var(--suit-club)",
};

export function Suit({ suit, size = 16 }: { suit: SuitType; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      style={{ display: "block", fill: COLOR_VAR[suit] }}
    >
      <path d={PATHS[suit]} />
    </svg>
  );
}

export function suitColorVar(suit: SuitType): string {
  return COLOR_VAR[suit];
}
