import type { Player } from "../engine/types.ts";
import { Chips } from "./Chips.tsx";
import { Mascot } from "./Mascot.tsx";
import { PlayingCard } from "./cards/Card.tsx";

interface SeatProps {
  player: Player;
  isButton: boolean;
  isThinking: boolean;
  isActor: boolean;
  revealCards: boolean;
  winnings: number;
  isWinner: boolean;
  lastAction: string | null;
  style: React.CSSProperties;
}

export function Seat({
  player,
  isButton,
  isThinking,
  isActor,
  revealCards,
  winnings,
  isWinner,
  lastAction,
  style,
}: SeatProps) {
  const showFace = player.isHuman || revealCards;
  const classes = ["seat"];
  if (!player.inHand) classes.push("seat--folded");
  if (isActor) classes.push("seat--actor");
  if (isThinking) classes.push("seat--thinking");
  if (isWinner) classes.push("seat--winner");
  if (player.isHuman) classes.push("seat--hero");

  return (
    <div className={classes.join(" ")} style={style}>
      <div className="seat-cards">
        {player.holeCards.length > 0 ? (
          player.holeCards.map((c, i) => (
            <PlayingCard
              key={i}
              card={showFace ? c : null}
              faceDown={!showFace}
              size="sm"
              dimmed={!player.inHand}
            />
          ))
        ) : (
          <div className="seat-cards-empty" />
        )}
        {isButton && (
          <span className="dealer-btn" title="Dealer button">
            D
          </span>
        )}
      </div>

      <div className="seat-body">
        <div className="seat-avatar">
          {player.isHuman ? (
            <span className="seat-avatar-you">YOU</span>
          ) : (
            <Mascot size={34} compact title={player.name} />
          )}
        </div>
        <div className="seat-meta">
          <span className="seat-name">{player.name}</span>
          <span className="seat-stack num">
            {player.isAllIn ? "ALL-IN" : player.stack.toLocaleString("en-US")}
          </span>
        </div>
      </div>

      {lastAction && player.inHand && <span className="seat-action">{lastAction}</span>}
      {winnings > 0 && <span className="seat-win num">+{winnings.toLocaleString("en-US")}</span>}

      {player.committedThisRound > 0 && (
        <div className="seat-bet">
          <Chips amount={player.committedThisRound} />
        </div>
      )}
    </div>
  );
}
