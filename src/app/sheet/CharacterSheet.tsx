import { useCallback } from "react";
import { useAppStore } from "../store";
import { useActor } from "../useActor";
import { useFoundryHook } from "../useFoundryHook";
import { VitalsHeader } from "./VitalsHeader";
import { SubTabBar } from "./SubTabBar";
import { setHeroPoints, adjustCondition } from "../../foundry/actor/mutations";

function PanelStub({ name }: { name: string }) {
  return <div className="p-4 text-sm text-zinc-500">{name} panel — coming in a later task.</div>;
}

export function CharacterSheet({ actorId, onSwitch }: { actorId: string; onSwitch?: () => void }) {
  const subTab = useAppStore((s) => s.sheetSubTab);
  const setActorId = useAppStore((s) => s.setActorId);
  const view = useActor(actorId);

  // Return to the picker/empty state if this actor is deleted.
  const onDelete = useCallback((doc: any) => { if (doc?.id === actorId) setActorId(null); }, [actorId, setActorId]);
  useFoundryHook("deleteActor", onDelete);

  const onHeroAdjust = useCallback((d: 1 | -1) => {
    if (!view) return;
    setHeroPoints(actorId, Math.max(0, Math.min(view.header.heroPoints.max, view.header.heroPoints.value + d)));
  }, [actorId, view]);
  const onDyingAdjust = useCallback((d: 1 | -1) => adjustCondition(actorId, "dying", d), [actorId]);
  const onWoundedAdjust = useCallback((d: 1 | -1) => adjustCondition(actorId, "wounded", d), [actorId]);

  if (!view) {
    return <div className="flex h-full items-center justify-center p-6 text-center text-zinc-400">Character unavailable.</div>;
  }

  return (
    <div className="flex h-full flex-col">
      <VitalsHeader
        header={view.header}
        conditions={view.conditions}
        onHeroAdjust={onHeroAdjust}
        onDyingAdjust={onDyingAdjust}
        onWoundedAdjust={onWoundedAdjust}
        onSwitch={onSwitch}
      />
      <SubTabBar />
      <div className="min-h-0 flex-1 overflow-y-auto">
        {subTab === "vitals" && <PanelStub name="Vitals" />}
        {subTab === "skills" && <PanelStub name="Skills" />}
        {subTab === "items" && <PanelStub name="Items" />}
        {subTab === "feats" && <PanelStub name="Feats" />}
        {subTab === "bio" && <PanelStub name="Bio" />}
      </div>
    </div>
  );
}
