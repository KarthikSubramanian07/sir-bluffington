import { useCallback, useEffect, useRef, useState } from "react";
import type { Action } from "../engine/types.ts";
import type { HumanOptions } from "../game/selectors.ts";
import "./actionbar.css";

interface ActionBarProps {
  options: HumanOptions;
  onAction: (action: Action) => void;
}

const QUICK = [
  { label: "½", frac: 0.5 },
  { label: "¾", frac: 0.75 },
  { label: "Pot", frac: 1 },
];

export function ActionBar({ options, onAction }: ActionBarProps) {
  const { toCall, canCheck, canBetOrRaise, isBet, minRaiseTo, maxRaiseTo, pot, currentBet } =
    options;
  const [amount, setAmount] = useState(minRaiseTo);
  const [raising, setRaising] = useState(false);

  // Reset the sizing state whenever it's a fresh decision.
  const turnKey = `${minRaiseTo}:${maxRaiseTo}:${toCall}:${pot}`;
  const lastKey = useRef(turnKey);
  useEffect(() => {
    if (lastKey.current !== turnKey) {
      lastKey.current = turnKey;
      setAmount(minRaiseTo);
      setRaising(false);
    }
  }, [turnKey, minRaiseTo]);

  const sizeFor = useCallback(
    (frac: number): number => {
      const raw = isBet ? Math.round(pot * frac) : currentBet + Math.round((pot + toCall) * frac);
      return Math.max(minRaiseTo, Math.min(maxRaiseTo, raw));
    },
    [isBet, pot, toCall, currentBet, minRaiseTo, maxRaiseTo],
  );

  const fold = useCallback(() => onAction({ type: "fold", playerId: "hero" }), [onAction]);
  const checkCall = useCallback(() => {
    onAction({ type: canCheck ? "check" : "call", playerId: "hero" });
  }, [canCheck, onAction]);
  const confirmRaise = useCallback(() => {
    onAction({ type: isBet ? "bet" : "raise", playerId: "hero", amount });
  }, [isBet, amount, onAction]);

  // Keyboard shortcuts (spec: keyboard-accessible).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement && e.target.type === "range") return;
      const k = e.key.toLowerCase();
      if (k === "f") fold();
      else if (k === "c") checkCall();
      else if (k === "a" && canBetOrRaise) {
        setRaising(true);
        setAmount(maxRaiseTo);
      } else if ((k === "r" || k === "b") && canBetOrRaise) {
        setRaising(true);
      } else if (k === "enter" && raising) confirmRaise();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fold, checkCall, confirmRaise, canBetOrRaise, maxRaiseTo, raising]);

  const canAllInOnly = canBetOrRaise && minRaiseTo === maxRaiseTo;

  return (
    <div className="actionbar" role="group" aria-label="Your actions">
      {raising && canBetOrRaise && !canAllInOnly ? (
        <div className="raise-panel">
          <div className="raise-top">
            <button
              type="button"
              className="btn btn--ghost raise-back"
              onClick={() => setRaising(false)}
              aria-label="Back to actions"
            >
              ←
            </button>
            <div className="raise-amount num">{amount.toLocaleString("en-US")}</div>
            <div className="raise-quick">
              {QUICK.map((q) => (
                <button
                  type="button"
                  key={q.label}
                  className="chip-btn"
                  onClick={() => setAmount(sizeFor(q.frac))}
                >
                  {q.label}
                </button>
              ))}
              <button
                type="button"
                className="chip-btn chip-btn--max"
                onClick={() => setAmount(maxRaiseTo)}
              >
                Max
              </button>
            </div>
          </div>
          <input
            className="raise-slider"
            type="range"
            min={minRaiseTo}
            max={maxRaiseTo}
            step={1}
            value={amount}
            aria-label={isBet ? "Bet amount" : "Raise to amount"}
            onChange={(e) => setAmount(Number(e.target.value))}
          />
          <button type="button" className="btn btn--primary btn--block" onClick={confirmRaise}>
            {isBet ? "Bet" : "Raise to"} {amount.toLocaleString("en-US")}
          </button>
        </div>
      ) : (
        <div className="action-row">
          <button type="button" className="btn btn--danger action-btn" onClick={fold}>
            Fold <kbd>F</kbd>
          </button>
          <button type="button" className="btn action-btn" onClick={checkCall}>
            {canCheck ? "Check" : `Call ${toCall.toLocaleString("en-US")}`} <kbd>C</kbd>
          </button>
          {canBetOrRaise &&
            (canAllInOnly ? (
              <button
                type="button"
                className="btn btn--primary action-btn"
                onClick={() =>
                  onAction({ type: isBet ? "bet" : "raise", playerId: "hero", amount: maxRaiseTo })
                }
              >
                All-in {maxRaiseTo.toLocaleString("en-US")} <kbd>A</kbd>
              </button>
            ) : (
              <button
                type="button"
                className="btn btn--primary action-btn"
                onClick={() => {
                  setRaising(true);
                  setAmount(sizeFor(0.75));
                }}
              >
                {isBet ? "Bet" : "Raise"} <kbd>R</kbd>
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
