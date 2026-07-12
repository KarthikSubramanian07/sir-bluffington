import { useEffect, useMemo } from "react";
import { cardId } from "../engine/cards.ts";
import { totalCommitted } from "../engine/hand.ts";
import { defaultEvaluator } from "../engine/handEval.ts";
import type { GameState } from "../engine/types.ts";
import type { GameController, LogEntry, Snapshot } from "../game/controller.ts";
import { humanOptions, isHumansTurn } from "../game/selectors.ts";
import { ActionBar } from "./ActionBar.tsx";
import { Chips } from "./Chips.tsx";
import { PostHand } from "./PostHand.tsx";
import { Seat } from "./Seat.tsx";
import { Wordmark } from "./Wordmark.tsx";
import { PlayingCard } from "./cards/Card.tsx";
import "./table.css";

export function Table({ controller, snap }: { controller: GameController; snap: Snapshot }) {
  const { state, phase, showdown } = snap;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (phase === "showdown" && (e.key === "Enter" || e.key === " ")) {
        e.preventDefault();
        controller.nextHand();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, controller]);

  const winningIds = useMemo(
    () => (showdown && state ? winningCardIds(state) : new Set<string>()),
    [showdown, state],
  );

  if (!state) return null;

  const positions = seatPositions(state.players.length);
  // Show the whole pot (all chips wagered this hand); current-street bets also sit in
  // front of players as chips, so the number only ever grows.
  const potNow = totalCommitted(state);
  const humanTurn = isHumansTurn(state);
  const opts = humanTurn ? humanOptions(state) : null;
  const revealAll = phase === "showdown";
  const lastActions = lastActionBySeat(snap.log, state);

  return (
    <div className="table-screen">
      <header className="table-top">
        <button
          type="button"
          className="btn btn--ghost table-leave"
          onClick={() => controller.leaveTable()}
        >
          ← Leave
        </button>
        <Wordmark size="sm" />
        <div className="table-meta num">
          <span>Hand #{snap.handNumber}</span>
          <span className="table-meta-sep">·</span>
          <span>
            {state.blinds.sb}/{state.blinds.bb}
          </span>
          <span className="table-meta-sep">·</span>
          <span className={snap.stats.netChips >= 0 ? "is-pos" : "is-neg"}>
            {snap.stats.netChips >= 0 ? "+" : ""}
            {snap.stats.netChips}
          </span>
        </div>
      </header>

      <div className="felt-wrap">
        <div className="felt">
          <div className="felt-inner" />
          <div className="felt-center">
            <div className="board">
              {[0, 1, 2, 3, 4].map((i) => {
                const c = state.board[i];
                return c ? (
                  <PlayingCard
                    key={i}
                    card={c}
                    size="md"
                    highlight={revealAll && winningIds.has(cardId(c))}
                  />
                ) : (
                  <div className="board-slot" key={i} />
                );
              })}
            </div>
            <div className="pot">
              <span className="pot-label">POT</span>
              <Chips amount={potNow} tone="gold" />
            </div>
          </div>

          {state.players.map((p) => (
            <Seat
              key={p.id}
              player={p}
              style={positions[p.seatIndex]!}
              isButton={p.seatIndex === state.button}
              isThinking={snap.thinkingSeat === p.seatIndex}
              isActor={state.actor === p.seatIndex && phase === "hand"}
              revealCards={revealAll && p.inHand}
              winnings={showdown?.winningsByPlayer[p.id] ?? 0}
              isWinner={(showdown?.winningsByPlayer[p.id] ?? 0) > 0}
              lastAction={lastActions.get(p.seatIndex) ?? null}
            />
          ))}
        </div>
      </div>

      <footer className="table-bottom">
        {phase === "hand" && opts ? (
          <ActionBar options={opts} onAction={(a) => controller.humanAction(a)} />
        ) : phase === "hand" ? (
          <div className="table-status">
            {snap.thinkingSeat !== null
              ? `${playerName(state, snap.thinkingSeat)} is thinking…`
              : "Dealing…"}
          </div>
        ) : null}
      </footer>

      {phase === "showdown" && showdown && (
        <PostHand
          state={state}
          showdown={showdown}
          log={snap.log}
          onNext={() => controller.nextHand()}
          onLeave={() => controller.leaveTable()}
        />
      )}
    </div>
  );
}

// --- helpers ------------------------------------------------------------------------

/** Percentage-based positions around an ellipse; seat 0 (the human) at bottom-center. */
function seatPositions(n: number): React.CSSProperties[] {
  const out: React.CSSProperties[] = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2 + Math.PI / 2;
    const left = 50 + 43 * Math.cos(t);
    const top = 50 + 44 * Math.sin(t);
    out.push({ left: `${left}%`, top: `${top}%` });
  }
  return out;
}

function playerName(state: GameState, seat: number): string {
  return state.players.find((p) => p.seatIndex === seat)?.name ?? "Bot";
}

/** Cards forming the main-pot winner's hand, for highlighting at showdown. */
function winningCardIds(state: GameState): Set<string> {
  const winner = state.players.find((p) => p.inHand && p.holeCards.length === 2);
  if (state.board.length < 5 || !winner) return new Set();
  // Find the actual best hand among those still in.
  const contenders = state.players
    .filter((p) => p.inHand && p.holeCards.length === 2)
    .map((p) => ({ playerId: p.id, holeCards: p.holeCards }));
  const winners = defaultEvaluator.winners(contenders, state.board);
  const best = state.players.find((p) => p.id === winners[0]);
  if (!best) return new Set();
  const result = defaultEvaluator.evaluate([...best.holeCards, ...state.board]);
  return new Set(result.cards.map(cardId));
}

const ACTION_LABEL: Record<LogEntry["action"], string> = {
  fold: "Fold",
  check: "Check",
  call: "Call",
  bet: "Bet",
  raise: "Raise",
  "post-blind": "Blind",
};

/** The most recent action label per seat, for the on-table read. */
function lastActionBySeat(log: LogEntry[], state: GameState): Map<number, string> {
  const map = new Map<number, string>();
  for (const e of log) {
    if (e.street !== state.street) continue;
    const label = ACTION_LABEL[e.action];
    map.set(e.seatIndex, e.amount ? `${label} ${e.amount}` : label);
  }
  return map;
}
