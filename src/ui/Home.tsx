import { useState } from "react";
import { PERSONALITIES } from "../ai/personalities.ts";
import type { PersonalityId } from "../engine/types.ts";
import { SELECTABLE_BOTS, type TableConfig, fitOpponents, saveConfig } from "../game/config.ts";
import type { GameController, Snapshot } from "../game/controller.ts";
import { Mascot } from "./Mascot.tsx";
import { StatsPanel } from "./StatsPanel.tsx";
import { Wordmark } from "./Wordmark.tsx";
import "./home.css";

const TABLE_SIZES = [
  { size: 2, label: "Heads-up", sub: "1 v 1" },
  { size: 6, label: "6-max", sub: "5 bots" },
  { size: 9, label: "Full ring", sub: "8 bots" },
];

export function Home({ controller, snap }: { controller: GameController; snap: Snapshot }) {
  const [config, setConfig] = useState<TableConfig>(snap.config);

  function update(patch: Partial<TableConfig>) {
    const next = { ...config, ...patch };
    if (patch.tableSize !== undefined) {
      next.opponents = fitOpponents(next.opponents, patch.tableSize);
    }
    setConfig(next);
    saveConfig(next);
  }

  function setOpponent(index: number, pid: PersonalityId) {
    const opponents = config.opponents.slice();
    opponents[index] = pid;
    update({ opponents });
  }

  function sit() {
    controller.startSession(config);
  }

  const seatCount = config.tableSize - 1;
  const opponents = config.opponents.slice(0, seatCount);

  return (
    <div className="home">
      <header className="home-nav">
        <Wordmark />
        <a className="home-nav-link" href="#about">
          What is this?
        </a>
      </header>

      <main className="home-main">
        <section className="hero">
          <div className="hero-copy">
            <p className="eyebrow num">FREE · NO ACCOUNT · IN YOUR BROWSER</p>
            <h1 className="hero-title">
              Practice poker against opponents with <em>personality.</em>
            </h1>
            <p className="hero-lede">
              A No-Limit Texas Hold'em trainer with five distinct AI characters, from the nitty{" "}
              <strong>Rock</strong> to the monocled <strong>Sir Bluffington</strong>. They punish
              your leaks and reward your reads. Deal a hand and get real reps in seconds, with no
              download and no money at risk.
            </p>
            <div className="hero-cta">
              <button type="button" className="btn btn--primary btn--lg" onClick={sit}>
                Take your seat
              </button>
              <span className="hero-cta-note num">
                {config.tableSize === 2 ? "Heads-up" : `${config.tableSize}-handed`} ·{" "}
                {config.startingStack} chips · {config.smallBlind}/{config.bigBlind}
              </span>
            </div>
          </div>
          <div className="hero-mascot" aria-hidden="true">
            <div className="hero-mascot-halo" />
            <Mascot size={220} />
          </div>
        </section>

        <section className="config" aria-label="Table setup">
          <div className="config-block">
            <h2 className="config-h">Table</h2>
            <div className="seg" role="group" aria-label="Table size">
              {TABLE_SIZES.map((t) => (
                <button
                  type="button"
                  key={t.size}
                  className={`seg-btn ${config.tableSize === t.size ? "is-active" : ""}`}
                  aria-pressed={config.tableSize === t.size}
                  onClick={() => update({ tableSize: t.size })}
                >
                  <span className="seg-label">{t.label}</span>
                  <span className="seg-sub num">{t.sub}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="config-block">
            <h2 className="config-h">Your opponents</h2>
            <div className="opp-grid">
              {opponents.map((pid, i) => (
                <OpponentPicker
                  key={i}
                  index={i}
                  value={pid}
                  onChange={(next) => setOpponent(i, next)}
                />
              ))}
            </div>
          </div>

          <div className="config-block config-row">
            <label className="field">
              <span className="field-label">Starting stack</span>
              <select
                className="field-input num"
                value={config.startingStack}
                onChange={(e) => update({ startingStack: Number(e.target.value) })}
              >
                {[100, 200, 500, 1000].map((v) => (
                  <option key={v} value={v}>
                    {v} ({Math.round(v / config.bigBlind)} bb)
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span className="field-label">Blinds</span>
              <select
                className="field-input num"
                value={`${config.smallBlind}/${config.bigBlind}`}
                onChange={(e) => {
                  const [sb, bb] = e.target.value.split("/").map(Number);
                  update({ smallBlind: sb!, bigBlind: bb! });
                }}
              >
                {["1/2", "2/5", "5/10", "25/50"].map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span className="field-label">Blind structure</span>
              <select
                className="field-input"
                value={config.escalateEvery}
                onChange={(e) => update({ escalateEvery: Number(e.target.value) })}
              >
                <option value={0}>Cash (fixed)</option>
                <option value={10}>Tournament · every 10 hands</option>
                <option value={20}>Tournament · every 20 hands</option>
              </select>
            </label>
            <label className="field">
              <span className="field-label">Deck</span>
              <select
                className="field-input"
                value={config.deckStyle}
                onChange={(e) => update({ deckStyle: e.target.value as TableConfig["deckStyle"] })}
              >
                <option value="four-color">Four-color</option>
                <option value="two-color">Two-color</option>
              </select>
            </label>
          </div>

          <button type="button" className="btn btn--primary btn--block" onClick={sit}>
            Take your seat →
          </button>
        </section>

        {snap.stats.handsPlayed > 0 && (
          <section className="home-stats">
            <StatsPanel stats={snap.stats} />
          </section>
        )}

        <section className="about" id="about">
          <h2 className="about-h serif">A poker trainer that plays back</h2>
          <p>
            <strong>Sir Bluffington's Poker</strong> is a free online poker trainer for practising
            No-Limit Texas Hold'em against the computer. Most poker sites are multiplayer or cost
            money; this one is single-player, instant, and built for reps. Each bot is a hand-tuned
            character rather than a faceless AI, so you learn to read tendencies, adjust your
            ranges, and exploit specific mistakes, the way you would against real opponents. Play as
            many hands as you like; your stats persist in your browser. No sign-up, no chips to buy,
            no gambling.
          </p>
          <div className="bots-legend">
            {SELECTABLE_BOTS.map((pid) => {
              const p = PERSONALITIES[pid];
              return (
                <div className="bot-card" key={pid}>
                  <div className="bot-card-head">
                    <Mascot size={34} compact title={p.name} />
                    <h3 className="bot-name">{p.name}</h3>
                  </div>
                  <p className="bot-tagline">{p.tagline}</p>
                  <dl className="bot-stats num">
                    <div>
                      <dt>VPIP</dt>
                      <dd>{pct(p.vpip)}</dd>
                    </div>
                    <div>
                      <dt>PFR</dt>
                      <dd>{pct(p.pfr)}</dd>
                    </div>
                    <div>
                      <dt>AGG</dt>
                      <dd>{pct(p.aggression)}</dd>
                    </div>
                  </dl>
                </div>
              );
            })}
          </div>
        </section>
      </main>

      <footer className="home-footer">
        <span className="serif">Sir Bluffington's Poker</span>
        <span className="home-footer-note">
          Play money only. Not gambling. A free poker practice tool with no account and no cost.
        </span>
      </footer>
    </div>
  );
}

function OpponentPicker({
  index,
  value,
  onChange,
}: {
  index: number;
  value: PersonalityId;
  onChange: (pid: PersonalityId) => void;
}) {
  const p = PERSONALITIES[value as Exclude<PersonalityId, "human">];
  return (
    <div className="opp">
      <div className="opp-avatar">
        <Mascot size={40} compact title={p?.name ?? "Bot"} />
      </div>
      <div className="opp-meta">
        <span className="opp-seat num">SEAT {index + 2}</span>
        <select
          className="opp-select"
          value={value}
          aria-label={`Opponent ${index + 1} personality`}
          onChange={(e) => onChange(e.target.value as PersonalityId)}
        >
          {SELECTABLE_BOTS.map((pid) => (
            <option key={pid} value={pid}>
              {PERSONALITIES[pid].name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

function pct(x: number): string {
  return `${Math.round(x * 100)}`;
}
