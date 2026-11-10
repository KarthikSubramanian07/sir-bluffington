import { useEffect, useRef, useState } from "react";
import { totalCommitted } from "../engine/hand.ts";
import type { Snapshot } from "../game/controller.ts";
import { isHumansTurn } from "../game/selectors.ts";

/**
 * Off-screen polite live region that announces turn, pot, pause, and showdown outcomes
 * so screen-reader users can follow the hand (WCAG 4.1.3).
 */
export function GameAnnouncer({ snap }: { snap: Snapshot }) {
  const [text, setText] = useState("");
  const lastKey = useRef("");

  useEffect(() => {
    const parts: string[] = [];
    if (snap.paused) parts.push("Game paused.");
    if (snap.message) parts.push(snap.message);

    const state = snap.state;
    if (!state) {
      announce(parts.join(" "));
      return;
    }

    const pot = totalCommitted(state);
    parts.push(`Hand ${snap.handNumber}. Pot ${pot}.`);

    if (snap.phase === "showdown" && snap.showdown) {
      const heroWon = (snap.showdown.winningsByPlayer.hero ?? 0) > 0;
      const winners = snap.showdown.awards
        .flatMap((a) => a.winnerIds)
        .map((id) => state.players.find((p) => p.id === id)?.name ?? id);
      const unique = [...new Set(winners)];
      parts.push(
        heroWon
          ? `You win. ${unique.join(", ")}.`
          : `Hand complete. Winner: ${unique.join(", ") || "none"}.`,
      );
      if (snap.stats.netChips !== undefined) {
        const net = snap.stats.netChips;
        parts.push(`Session ${net >= 0 ? "up" : "down"} ${Math.abs(net)} chips.`);
      }
    } else if (snap.phase === "hand") {
      if (isHumansTurn(state)) {
        parts.push("Your turn to act.");
      } else if (snap.thinkingSeat !== null) {
        const name = state.players.find((p) => p.seatIndex === snap.thinkingSeat)?.name ?? "Bot";
        parts.push(`${name} is thinking.`);
      }
    }

    announce(parts.join(" "));

    function announce(next: string) {
      if (!next || next === lastKey.current) return;
      lastKey.current = next;
      setText(next);
    }
  }, [snap]);

  return (
    <div className="visually-hidden" aria-live="polite" aria-atomic="true" role="status">
      {text}
    </div>
  );
}
