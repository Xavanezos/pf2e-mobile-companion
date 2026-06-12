import { useAppStore } from "../store";
import { useHotbar } from "../macros/useHotbar";
import { MacroBar } from "../macros/MacroBar";
import { BattleMap } from "../map/BattleMap";
import { executeMacro } from "../../foundry/macros/hotbar";

/** The Map tab: the lightweight battle map fills the `flex-1` area; the macro bar
 *  (Phase 4.1) is permanently pinned at the bottom, above the global tab nav. */
export function MapTab() {
  const actorId = useAppStore((s) => s.actorId);
  const macros = useHotbar();
  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1 overflow-hidden">
        <BattleMap />
      </div>
      {macros && <MacroBar macros={macros} onRun={(id) => void executeMacro(id, actorId)} />}
    </div>
  );
}
