import { useCallback, useState } from "react";
import { useAppStore } from "../store";
import { useActor } from "../useActor";
import { useFoundryHook } from "../useFoundryHook";
import { VitalsHeader } from "./VitalsHeader";
import { SubTabBar } from "./SubTabBar";
import { HpNumpad, type HpMode } from "./HpNumpad";
import { ConditionsModal } from "./ConditionsModal";
import { VitalsPanel } from "./VitalsPanel";
import { SkillsPanel } from "./SkillsPanel";
import { ItemsPanel } from "./ItemsPanel";
import { CarryTypeMenu } from "./CarryTypeMenu";
import { FeatsPanel } from "./FeatsPanel";
import { ProfsPanel } from "./ProfsPanel";
import { BioPanel } from "./BioPanel";
import { BreakdownModal, type BreakdownRequest } from "./BreakdownModal";
import { setHeroPoints, adjustCondition, toggleCondition, setHp, setTempHp, applyDamageTo, setInitiativeStatistic, setShieldHp, setEquipped, setInvested } from "../../foundry/actor/mutations";
import { hpAfterHeal, hpClamped } from "../../foundry/actor/hp";

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

  const [hpOpen, setHpOpen] = useState(false);
  const [condOpen, setCondOpen] = useState(false);
  const [equipItemId, setEquipItemId] = useState<string | null>(null);
  const [breakdown, setBreakdown] = useState<BreakdownRequest | null>(null);
  const onHpSubmit = useCallback((mode: HpMode, amount: number) => {
    if (!view) return;
    if (mode === "damage") applyDamageTo(actorId, amount);
    else if (mode === "heal") setHp(actorId, hpAfterHeal(view.header.hp.value, view.header.hp.max, amount));
    else setHp(actorId, hpClamped(amount, view.header.hp.max));
  }, [actorId, view]);

  if (!view) {
    return <div className="flex h-full items-center justify-center p-6 text-center text-zinc-400">Character unavailable.</div>;
  }

  const equipItem = equipItemId
    ? view.inventory.categories.flatMap((c) => c.items).find((i) => i.id === equipItemId) ?? null
    : null;

  return (
    <>
      <div className="flex h-full flex-col">
        <VitalsHeader
          header={view.header}
          conditions={view.conditions}
          onHpTap={() => setHpOpen(true)}
          onHeroAdjust={onHeroAdjust}
          onDyingAdjust={onDyingAdjust}
          onWoundedAdjust={onWoundedAdjust}
          onConditionTap={() => setCondOpen(true)}
          onConditionAdd={() => setCondOpen(true)}
          onSwitch={onSwitch}
        />
        <SubTabBar />
        <div className="min-h-0 flex-1 overflow-y-auto">
          {subTab === "vitals" && (
            <VitalsPanel
              view={view}
              onInitiativeChange={(stat) => setInitiativeStatistic(actorId, stat)}
              onShieldHpAdjust={(dlt) => view.defenses.shield && setShieldHp(actorId, hpClamped(view.defenses.shield.hp.value + dlt, view.defenses.shield.hp.max))}
              onManageConditions={() => setCondOpen(true)}
              onShowBreakdown={setBreakdown}
            />
          )}
          {subTab === "skills" && <SkillsPanel view={view} onShowBreakdown={setBreakdown} />}
          {subTab === "items" && (
            <ItemsPanel
              view={view}
              onEquipTap={(id) => setEquipItemId(id)}
              onInvestToggle={(id, next) => setInvested(actorId, id, next)}
            />
          )}
          {subTab === "feats" && <FeatsPanel view={view} />}
          {subTab === "profs" && <ProfsPanel view={view} />}
          {subTab === "bio" && <BioPanel view={view} />}
        </div>
      </div>
      {hpOpen && view && (
        <HpNumpad hp={view.header.hp} onSubmit={onHpSubmit} onSetTemp={(n) => setTempHp(actorId, n)} onClose={() => setHpOpen(false)} />
      )}
      {condOpen && view && (
        <ConditionsModal
          active={view.conditions}
          onToggle={(slug) => toggleCondition(actorId, slug)}
          onAdjust={(slug, d) => adjustCondition(actorId, slug, d)}
          onClose={() => setCondOpen(false)}
        />
      )}
      {equipItem && (
        <CarryTypeMenu
          itemName={equipItem.name}
          onSelect={(carryType, hands) => setEquipped(actorId, equipItem.id, carryType, hands)}
          onClose={() => setEquipItemId(null)}
        />
      )}
      {breakdown && <BreakdownModal req={breakdown} onClose={() => setBreakdown(null)} />}
    </>
  );
}
