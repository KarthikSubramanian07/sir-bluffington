import type { Card as CardType, Rank } from "../../engine/types.ts";
import { Suit, suitColorVar } from "./Suit.tsx";
import "./card.css";

const RANK_LABEL: Record<Rank, string> = {
  2: "2",
  3: "3",
  4: "4",
  5: "5",
  6: "6",
  7: "7",
  8: "8",
  9: "9",
  10: "10",
  11: "J",
  12: "Q",
  13: "K",
  14: "A",
};

export type CardSize = "sm" | "md" | "lg";

interface CardProps {
  card?: CardType | null;
  faceDown?: boolean;
  size?: CardSize;
  /** Dim a folded player's cards. */
  dimmed?: boolean;
  /** Highlight cards that make the winning hand. */
  highlight?: boolean;
}

export function PlayingCard({
  card,
  faceDown = false,
  size = "md",
  dimmed = false,
  highlight = false,
}: CardProps) {
  const classes = ["card", `card--${size}`];
  if (dimmed) classes.push("card--dim");
  if (highlight) classes.push("card--win");

  if (faceDown || !card) {
    return (
      <div className={`${classes.join(" ")} card--back`} aria-hidden={!card ? true : undefined}>
        <div className="card-back-emblem">
          <Monocle />
        </div>
      </div>
    );
  }

  const label = RANK_LABEL[card.rank];
  const color = suitColorVar(card.suit);
  const suitName = { s: "spades", h: "hearts", d: "diamonds", c: "clubs" }[card.suit];

  return (
    <div className={classes.join(" ")} role="img" aria-label={`${label} of ${suitName}`}>
      <span className="card-index" style={{ color }}>
        <span className="card-rank num">{label}</span>
        <Suit suit={card.suit} size={cornerSuitSize(size)} />
      </span>
      <span className="card-pip">
        <Suit suit={card.suit} size={pipSize(size)} />
      </span>
    </div>
  );
}

function cornerSuitSize(size: CardSize): number {
  return size === "lg" ? 15 : size === "md" ? 12 : 9;
}
function pipSize(size: CardSize): number {
  return size === "lg" ? 40 : size === "md" ? 30 : 20;
}

/** The gold monocle, the brand's signature mark, reused on card backs and the mascot. */
function Monocle() {
  return (
    <svg viewBox="0 0 40 40" aria-hidden="true">
      <circle cx="20" cy="20" r="11" fill="none" stroke="var(--gold)" strokeWidth="2.2" />
      <circle cx="20" cy="20" r="6" fill="none" stroke="var(--gold-dim)" strokeWidth="1" />
      <path
        d="M31 20c4 1 5 6 3 11"
        fill="none"
        stroke="var(--gold)"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
