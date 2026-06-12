import type { ActionItemLike, ActionsActorLike, ActionItemView, ActionsView } from "./types";

type Cost = { type: "action" | "reaction" | "free"; value: number | null } | null;

/** Mirror PF2e's `actionCost` getters (ability/feat document.ts): null for passive. */
function actionCost(it: ActionItemLike): Cost {
  const type = it.system?.actionType?.value || "passive";
  if (type !== "action" && type !== "reaction" && type !== "free") return null;
  return { type, value: it.system?.actions?.value ?? null };
}

function glyphOf(cost: Cost): string | null {
  if (!cost) return null;
  if (cost.type === "reaction") return "reaction";
  if (cost.type === "free") return "free";
  return cost.value ? String(cost.value) : null;
}

function toView(it: ActionItemLike, cost: Cost): ActionItemView {
  const f = it.system?.frequency;
  return {
    id: it.id,
    name: it.name,
    img: it.img,
    glyph: glyphOf(cost),
    traits: it.system?.traits?.value ?? [],
    frequency: f && typeof f.value === "number" && typeof f.max === "number"
      ? { value: f.value, max: f.max, per: f.per ?? "" }
      : null,
  };
}

/** Pure: group an actor's actions/activities the way PF2e's sheet does
 *  (`character/sheet.ts:400-464`): encounter (by cost type) / exploration / downtime,
 *  each sorted by name. Action items are always kept (even passive); feats only with
 *  an action cost; suppressed items are skipped. */
export function buildActionsView(actor: ActionsActorLike): ActionsView {
  const buckets: Record<string, ActionItemView[]> = { action: [], reaction: [], free: [], exploration: [], downtime: [] };

  const consider = (it: ActionItemLike, isFeat: boolean) => {
    if (it.suppressed) return;
    const cost = actionCost(it);
    if (isFeat && !cost) return; // feats: only with an action cost
    const traits = it.system?.traits?.value ?? [];
    if (traits.includes("exploration")) buckets.exploration.push(toView(it, cost));
    else if (traits.includes("downtime")) buckets.downtime.push(toView(it, cost));
    else buckets[cost?.type ?? "free"].push(toView(it, cost));
  };
  (actor.itemTypes?.action ?? []).forEach((it) => consider(it, false));
  (actor.itemTypes?.feat ?? []).forEach((it) => consider(it, true));

  const order: { key: string; label: string }[] = [
    { key: "action", label: "Actions" },
    { key: "reaction", label: "Reactions" },
    { key: "free", label: "Free Actions" },
    { key: "exploration", label: "Exploration" },
    { key: "downtime", label: "Downtime" },
  ];
  const byName = (a: ActionItemView, b: ActionItemView) => a.name.localeCompare(b.name);
  return order
    .map(({ key, label }) => ({ key, label, actions: buckets[key].sort(byName) }))
    .filter((g) => g.actions.length > 0);
}
