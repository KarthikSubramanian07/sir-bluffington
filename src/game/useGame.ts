import { useSyncExternalStore } from "react";
import type { GameController, Snapshot } from "./controller.ts";

/** Subscribe a component to the controller's snapshot. */
export function useGame(controller: GameController): Snapshot {
  return useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
}
