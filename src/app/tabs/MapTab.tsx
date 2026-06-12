import { useAppStore } from "../store";
import { useHotbar } from "../macros/useHotbar";
import { MacroBar } from "../macros/MacroBar";
import { BattleMap } from "../map/BattleMap";
import { CanvasMap } from "../map/CanvasMap";
import { executeMacro } from "../../foundry/macros/hotbar";
import { getMapRenderer } from "../../foundry/settings";
import { isCanvasReady } from "../../foundry/canvas/lifecycle";

/** The Map tab: the battle map fills the `flex-1` area; the macro bar (Phase 4.1)
 *  stays pinned at the bottom. Uses the real Foundry canvas when the renderer
 *  setting is `canvas` and the canvas initialized; otherwise the lite DOM map. */
export function MapTab() {
  const actorId = useAppStore((s) => s.actorId);
  const macros = useHotbar();
  const useCanvas = getMapRenderer() === "canvas" && isCanvasReady();
  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1 overflow-hidden">
        {useCanvas ? <CanvasMap /> : <BattleMap />}
      </div>
      {macros && <MacroBar macros={macros} onRun={(id) => void executeMacro(id, actorId)} />}
    </div>
  );
}
