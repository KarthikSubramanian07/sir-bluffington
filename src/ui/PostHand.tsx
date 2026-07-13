import type { ShowdownResult } from "../engine/showdown.ts";
import type { GameState } from "../engine/types.ts";
import type { LogEntry } from "../game/controller.ts";
import "./posthand.css";

interface PostHandProps {
  state: GameState;
  showdown: ShowdownResult;
  log: LogEntry[];
  onNext: () => void;
  onLeave: () => void;
}

const POT_LABEL = (i: number, total: number): string => {
  if (total === 1) return "Pot";
  return i === 0 ? "Main pot" : `Side pot ${i}`;
};

export function PostHand({ state, showdown, log, onNext, onLeave }: PostHandProps) {
  const nameOf = (id: string) => state.players.find((p) => p.id === id)?.name ?? id;
  const heroWon = (showdown.winningsByPlayer.hero ?? 0) > 0;
  const notes = notableActions(log);

  return (
    <div className="posthand" role="dialog" aria-label="Hand result">
      <div className="posthand-card">
        <div className="posthand-head">
          <h2 className={`posthand-title serif ${heroWon ? "is-win" : ""}`}>
            {heroWon ? "You take it down." : "Hand complete."}
          </h2>
        </div>

        <div className="posthand-pots">
          {showdown.awards.map((award, i) => (
            <div className="pot-award" key={i}>
              <div className="pot-award-top">
                <span className="pot-award-label">{POT_LABEL(i, showdown.awards.length)}</span>
                <span className="pot-award-amount num">{award.amount.toLocaleString("en-US")}</span>
              </div>
              <div className="pot-award-winners">
                <span className="pot-award-names">
                  {award.winnerIds.map(nameOf).join(", ") || "-"}
                </span>
                {award.handName && <span className="pot-award-hand">{award.handName}</span>}
                {award.oddChips > 0 && (
                  <span className="pot-award-odd num">+{award.oddChips} odd</span>
                )}
              </div>
            </div>
          ))}
        </div>

        {notes.length > 0 && (
          <div className="posthand-notes">
            <h3 className="posthand-notes-h">Why they did that</h3>
            <ul>
              {notes.map((n, i) => (
                <li key={i}>
                  <span className="note-name">{n.name}</span> {n.reason}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="posthand-actions">
          <button type="button" className="btn btn--ghost" onClick={onLeave}>
            Leave table
          </button>
          <button type="button" className="btn btn--primary btn--lg" onClick={onNext} autoFocus>
            Next hand →
          </button>
        </div>
        <p className="posthand-hint num">Press Enter or Space for the next hand</p>
      </div>
    </div>
  );
}

/** Pick the most instructive handful of actions to explain (spec Section 06). */
function notableActions(log: LogEntry[]): { name: string; reason: string }[] {
  const interesting = log.filter(
    (e) =>
      e.reason.includes("bluff") ||
      e.reason.includes("value") ||
      e.reason.includes("premium") ||
      e.reason.includes("initiative") ||
      (e.action === "fold" && !e.playerId.startsWith("hero")),
  );
  const bots = interesting.filter((e) => e.personalityId !== "human");
  // De-dup per player, keep the latest, cap at 4.
  const seen = new Set<string>();
  const picked: { name: string; reason: string }[] = [];
  for (let i = bots.length - 1; i >= 0 && picked.length < 4; i--) {
    const e = bots[i]!;
    if (seen.has(e.playerId)) continue;
    seen.add(e.playerId);
    picked.push({ name: e.name, reason: e.reason });
  }
  return picked.reverse();
}
