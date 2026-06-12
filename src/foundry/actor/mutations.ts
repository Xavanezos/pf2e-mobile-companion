/** Minimal shapes for the live document methods we call. */
interface ActorDoc {
  update(data: Record<string, unknown>): Promise<unknown>;
  applyDamage?(args: { damage: number }): Promise<unknown>;
  toggleCondition?(slug: string): Promise<unknown>;
  increaseCondition?(slug: string): Promise<unknown>;
  decreaseCondition?(slug: string): Promise<unknown>;
  items?: { get(id: string): ItemDoc | undefined };
}
interface ItemDoc { update(data: Record<string, unknown>): Promise<unknown>; delete?(): Promise<unknown>; }

function getActor(actorId: string): ActorDoc | undefined {
  return (game as any).actors.get(actorId) as ActorDoc | undefined;
}

/** Wrap a mutation so a rejected promise surfaces via Foundry's own toast, never throws to React. */
async function guard(run: () => Promise<unknown>): Promise<void> {
  try {
    await run();
  } catch (err) {
    console.error("[pf2e-mobile] mutation failed", err);
    (ui as any)?.notifications?.error?.("Action failed — see console.");
  }
}

export function setHp(actorId: string, value: number): Promise<void> {
  return guard(() => getActor(actorId)!.update({ "system.attributes.hp.value": value }));
}
export function setTempHp(actorId: string, value: number): Promise<void> {
  return guard(() => getActor(actorId)!.update({ "system.attributes.hp.temp": value }));
}
export function applyDamageTo(actorId: string, amount: number): Promise<void> {
  return guard(() => {
    const a = getActor(actorId)!;
    return a.applyDamage ? a.applyDamage({ damage: amount }) : a.update({ "system.attributes.hp.value": Math.max(0, amount) });
  });
}
export function setHeroPoints(actorId: string, value: number): Promise<void> {
  return guard(() => getActor(actorId)!.update({ "system.resources.heroPoints.value": value }));
}
export function setInitiativeStatistic(actorId: string, statistic: string): Promise<void> {
  return guard(() => getActor(actorId)!.update({ "system.initiative.statistic": statistic }));
}
export function setShieldHp(actorId: string, value: number): Promise<void> {
  // `system.attributes.shield` is DERIVED from the equipped shield item each
  // prepare cycle, so writing it on the actor is discarded. Update the item.
  return guard(() => {
    const a = getActor(actorId)! as ActorDoc & { system?: { attributes?: { shield?: { itemId?: string | null } } } };
    const itemId = a.system?.attributes?.shield?.itemId;
    const item = itemId ? a.items!.get(itemId) : undefined;
    if (!item) throw new Error("No equipped shield to update");
    return item.update({ "system.hp.value": value });
  });
}
export function toggleCondition(actorId: string, slug: string): Promise<void> {
  return guard(() => getActor(actorId)!.toggleCondition!(slug));
}
export function adjustCondition(actorId: string, slug: string, delta: 1 | -1): Promise<void> {
  return guard(() => {
    const a = getActor(actorId)!;
    return delta > 0 ? a.increaseCondition!(slug) : a.decreaseCondition!(slug);
  });
}
export function setEquipped(actorId: string, itemId: string, carryType: string, handsHeld = 0): Promise<void> {
  return guard(() =>
    getActor(actorId)!.items!.get(itemId)!.update({ "system.equipped.carryType": carryType, "system.equipped.handsHeld": handsHeld }),
  );
}
export function setInvested(actorId: string, itemId: string, invested: boolean): Promise<void> {
  return guard(() => getActor(actorId)!.items!.get(itemId)!.update({ "system.equipped.invested": invested }));
}
/** Remove an effect (or any embedded item) from the actor by deleting the item. */
export function removeEffect(actorId: string, effectId: string): Promise<void> {
  return guard(() => {
    const item = getActor(actorId)!.items!.get(effectId);
    if (!item?.delete) throw new Error(`No effect ${effectId} to remove`);
    return item.delete();
  });
}
