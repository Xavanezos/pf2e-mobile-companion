import { useAppStore } from "../store";
import { useHotbar } from "../macros/useHotbar";
import { MacroBar } from "../macros/MacroBar";
import { Placeholder } from "./Placeholder";
import { executeMacro } from "../../foundry/macros/hotbar";

/** The Map tab. Phase 7 builds the real battle map in the `flex-1` area; for now
 *  it shows the placeholder. The macro bar is permanently pinned at the bottom,
 *  above the global tab nav. */
export function MapTab() {
  const actorId = useAppStore((s) => s.actorId);
  const macros = useHotbar();
  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1 overflow-hidden">
        <Placeholder title="Battle Map" phase="Coming in Phase 7" />
      </div>
      {macros && <MacroBar macros={macros} onRun={(id) => void executeMacro(id, actorId)} />}
    </div>
  );
}
