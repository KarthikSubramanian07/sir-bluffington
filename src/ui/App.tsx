import { useEffect, useMemo } from "react";
import { loadConfig } from "../game/config.ts";
import { GameController } from "../game/controller.ts";
import { useGame } from "../game/useGame.ts";
import { Home } from "./Home.tsx";
import { Table } from "./Table.tsx";
import "./app.css";

export function App() {
  const controller = useMemo(() => new GameController(loadConfig()), []);
  const snap = useGame(controller);

  useEffect(() => {
    return () => controller.dispose();
  }, [controller]);

  useEffect(() => {
    document.documentElement.setAttribute("data-deck", snap.config.deckStyle);
  }, [snap.config.deckStyle]);

  return snap.phase === "config" ? (
    <Home controller={controller} snap={snap} />
  ) : (
    <Table controller={controller} snap={snap} />
  );
}
