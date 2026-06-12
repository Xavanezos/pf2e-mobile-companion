type Dict = Record<string, unknown>;

interface UsableItem {
  system?: { frequency?: { value?: number } | null };
  update(data: Dict): Promise<unknown>;
  toMessage(event?: unknown, opts?: Dict): Promise<unknown>;
}

/** Guarded: use an action/activity. Mirrors PF2e's `createUseActionMessage`
 *  (`chat-message/helpers.ts:18-46`): decrement a limited `system.frequency.value`
 *  first, then post the action card via `item.toMessage()`. (selfEffect / crafting
 *  branches are deferred — most actions just post their description card.) Never
 *  throws into React; a failure surfaces via Foundry's toast. */
export function useAction(actorId: string, itemId: string): Promise<void> {
  return (async () => {
    try {
      const item = (game as any)?.actors?.get(actorId)?.items?.get(itemId) as UsableItem | undefined;
      if (!item?.toMessage) throw new Error(`no usable item ${itemId} on actor ${actorId}`);
      const value = item.system?.frequency?.value;
      if (typeof value === "number" && value > 0) {
        await item.update({ "system.frequency.value": value - 1 });
      }
      await item.toMessage();
    } catch (err) {
      console.error("[pf2e-mobile] useAction failed", err);
      (ui as any)?.notifications?.error?.("Action failed — see console.");
    }
  })();
}
