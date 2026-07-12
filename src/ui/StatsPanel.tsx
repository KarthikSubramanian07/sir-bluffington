import { PERSONALITIES } from "../ai/personalities.ts";
import type { PersonalityId } from "../engine/types.ts";
import { type Stats, showdownWinRate } from "../game/stats.ts";
import "./stats.css";

export function StatsPanel({ stats, compact = false }: { stats: Stats; compact?: boolean }) {
  const tiles = [
    { label: "Hands played", value: fmt(stats.handsPlayed) },
    { label: "Hands won", value: fmt(stats.handsWon) },
    { label: "Showdown win", value: `${Math.round(showdownWinRate(stats) * 100)}%` },
    { label: "Biggest pot", value: fmt(stats.biggestPotWon) },
  ];

  const vsBot = Object.entries(stats.vsBot)
    .filter(([id]) => id !== "human")
    .sort((a, b) => b[1] - a[1]) as [PersonalityId, number][];

  return (
    <div className={`stats ${compact ? "stats--compact" : ""}`}>
      <div className="stats-head">
        <h2 className="stats-title">Your session</h2>
        <span className={`stats-net num ${stats.netChips >= 0 ? "is-pos" : "is-neg"}`}>
          {stats.netChips >= 0 ? "+" : ""}
          {fmt(stats.netChips)} <span className="stats-net-unit">chips</span>
        </span>
      </div>
      <div className="stats-tiles">
        {tiles.map((t) => (
          <div className="stat-tile" key={t.label}>
            <span className="stat-value num">{t.value}</span>
            <span className="stat-label">{t.label}</span>
          </div>
        ))}
      </div>
      {!compact && vsBot.length > 0 && (
        <div className="stats-vs">
          <h3 className="stats-vs-title">Head to head</h3>
          <ul className="stats-vs-list">
            {vsBot.map(([id, net]) => (
              <li className="stats-vs-row" key={id}>
                <span className="stats-vs-name">
                  {PERSONALITIES[id as Exclude<PersonalityId, "human">]?.name ?? id}
                </span>
                <span className={`num ${net >= 0 ? "is-pos" : "is-neg"}`}>
                  {net >= 0 ? "+" : ""}
                  {fmt(Math.round(net))}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function fmt(n: number): string {
  return n.toLocaleString("en-US");
}
