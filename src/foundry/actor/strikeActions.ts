/** Live PF2e strike rolls for the Actions tab. Thin glue over the system API,
 *  guarded so a rejected roll surfaces via Foundry's toast and never throws into
 *  React — same contract as `rolls.ts`. The strike posts the real attack/damage
 *  card, which flows through the existing chat feed (Chat tab + toast).
 *
 *  We never hold a live strike in React state: the view carries the strike's index
 *  in `actor.system.actions`, and these functions re-read the live strike by it —
 *  exactly how PF2e's own sheet resolves a strike from a clicked button. */

import type { StrikeAttackPreview } from "./types";

type Dict = Record<string, unknown>;

interface StrikeVariant { roll(args?: Dict): Promise<unknown>; penalty?: number; }
interface LiveModifier { slug?: string; label?: string; modifier?: number; enabled?: boolean; ignored?: boolean; hideIfDisabled?: boolean; }
interface LiveStrike {
  slug?: string;
  variants?: StrikeVariant[];
  modifiers?: LiveModifier[];
  totalModifier?: number;
  calculateTotal?: () => void;
  damage?: (args?: Dict) => Promise<unknown>;
  critical?: (args?: Dict) => Promise<unknown>;
  auxiliaryActions?: { execute(args?: Dict): Promise<unknown> }[];
  item?: { update(data: Dict): Promise<unknown> };
}
interface StrikeActor { system?: { actions?: LiveStrike[] }; }

function getStrike(actorId: string, index: number): LiveStrike {
  const actor = (game as any)?.actors?.get(actorId) as StrikeActor | undefined;
  const strike = actor?.system?.actions?.[index];
  if (!strike) throw new Error(`no strike at index ${index} on actor ${actorId}`);
  return strike;
}

async function guard(run: () => Promise<unknown>): Promise<void> {
  try {
    await run();
  } catch (err) {
    console.error("[pf2e-mobile] strike action failed", err);
    (ui as any)?.notifications?.error?.("Strike failed — see console.");
  }
}

/** A `{ event }` param whose click `shiftKey` mirrors the given PF2e dialog
 *  setting, so `eventToRollParams` skips the (mobile-suppressed) modifier dialog
 *  under either setting — the proven approach from the spell-damage fix. PF2e's
 *  own sheet passes `{ event }` to `variant.roll` / `strike.damage`. */
function skipDialogEvent(setting: "showCheckDialogs" | "showDamageDialogs"): Dict {
  const show = !!(game as any)?.user?.settings?.[setting];
  return { event: new PointerEvent("click", { shiftKey: show }) };
}

/** Inverse of `skipDialogEvent`: a click event that FORCES PF2e's modifier dialog to
 *  render (shiftKey = !setting), so our render hook can drive it headlessly. */
function showDialogEvent(setting: "showCheckDialogs"): Dict {
  const show = !!(game as any)?.user?.settings?.[setting];
  return { event: new PointerEvent("click", { shiftKey: !show }) };
}

// Attack modifier toggle — applied post-clone.
// The toggle must reach the FINAL CheckModifier. When a target is selected the strike
// roll re-derives its modifiers on a contextual actor clone (PF2e's `getContextualClone`
// re-runs data prep from `_source`), so a transient `.ignored` set on the LIVE strike is
// rebuilt away and the rolled total ignores it. PF2e itself only toggles modifiers through
// its `CheckModifiersDialog`; so instead of suppressing that dialog we let it render and
// drive it headlessly — `rollStrikeAttack` queues the disabled slugs, and the
// `renderCheckModifiersDialog` hook applies them to the real post-clone check and resolves
// the dialog without showing any UI.

interface CheckLike { modifiers?: { slug?: string; ignored?: boolean }[]; calculateTotal?: () => void; }
interface CheckDialogLike {
  check?: CheckLike;
  resolve?: (value: boolean) => void;
  close?: (opts?: Dict) => unknown;
  isResolved?: boolean;
  element?: { hide?: () => void };
}

let pendingDisabledSlugs: Set<string> | null = null;

/** Mirror PF2e's dialog: set `.ignored` on a check's matching modifiers (by slug) and
 *  recompute the total. Applied to the real post-clone check by the dialog hook. */
export function applyDisabledSlugsToCheck(check: CheckLike, disabledSlugs: Iterable<string>): void {
  const disabled = new Set(disabledSlugs);
  for (const m of check.modifiers ?? []) {
    if (disabled.has(m.slug ?? "")) m.ignored = true;
  }
  check.calculateTotal?.();
}

/** `renderCheckModifiersDialog` handler. If a strike attack queued disabled slugs, apply
 *  them to the (post-clone) check and resolve the dialog headlessly — no UI is shown.
 *  Inert (leaves the dialog untouched) for any other check and on desktop. */
export function onRenderCheckDialog(app: CheckDialogLike): void {
  const pending = pendingDisabledSlugs;
  if (!pending) return;
  pendingDisabledSlugs = null; // one-shot: consume the queue
  try {
    app.element?.hide?.(); // hide before close to avoid a flash
    if (app.check) applyDisabledSlugsToCheck(app.check, pending);
    app.isResolved = true;
    app.resolve?.(true);
    app.close?.();
  } catch (err) {
    console.error("[pf2e-mobile] strike attack dialog toggle failed", err);
    app.resolve?.(true); // never hang the roll
  }
}

let dialogHookInstalled = false;
/** Register the dialog interceptor once. Inert unless a strike roll queues slugs, so it is
 *  a no-op for every other check and entirely on desktop. Call at startup. */
export function installStrikeRollDialogHook(): void {
  if (dialogHookInstalled) return;
  dialogHookInstalled = true;
  (Hooks as unknown as { on?: (n: string, fn: (app: CheckDialogLike) => void) => void })?.on?.(
    "renderCheckModifiersDialog",
    onRenderCheckDialog,
  );
}

/** Roll one MAP variant of a strike (variantIndex 0/1/2 → MAP 0/-5/-10). With
 *  `disabledSlugs` (the user unchecked some modifiers), queue them and FORCE PF2e's
 *  modifier dialog so `onRenderCheckDialog` applies them to the FINAL, post-clone check
 *  (a live-strike mutation is lost to the roll's contextual actor clone). With no
 *  toggles, keep the dialog suppressed as before. */
export function rollStrikeAttack(
  actorId: string,
  strikeIndex: number,
  variantIndex: number,
  opts?: { disabledSlugs?: string[] },
): Promise<void> {
  return guard(async () => {
    const variant = getStrike(actorId, strikeIndex).variants?.[variantIndex];
    if (!variant) throw new Error(`no variant ${variantIndex} on strike ${strikeIndex}`);
    const slugs = opts?.disabledSlugs ?? [];
    if (slugs.length === 0) return variant.roll(skipDialogEvent("showCheckDialogs"));
    pendingDisabledSlugs = new Set(slugs);
    try {
      return await variant.roll(showDialogEvent("showCheckDialogs"));
    } finally {
      pendingDisabledSlugs = null;
    }
  });
}

/** Roll a strike's (non-critical) damage. */
export function rollStrikeDamage(actorId: string, strikeIndex: number): Promise<void> {
  return guard(() => {
    const strike = getStrike(actorId, strikeIndex);
    if (!strike.damage) throw new Error(`strike ${strikeIndex} has no damage`);
    return strike.damage(skipDialogEvent("showDamageDialogs"));
  });
}

/** Roll a strike's critical damage. */
export function rollStrikeCritical(actorId: string, strikeIndex: number): Promise<void> {
  return guard(() => {
    const strike = getStrike(actorId, strikeIndex);
    if (!strike.critical) throw new Error(`strike ${strikeIndex} has no critical`);
    return strike.critical(skipDialogEvent("showDamageDialogs"));
  });
}

/** Run a strike's auxiliary action (draw / sheathe / change grip / retrieve …) by
 *  index. It mutates equip state → the `updateItem` hook refreshes the card. */
export function runAuxiliaryAction(actorId: string, strikeIndex: number, auxIndex: number): Promise<void> {
  return guard(() => {
    const aux = getStrike(actorId, strikeIndex).auxiliaryActions?.[auxIndex];
    if (!aux) throw new Error(`no auxiliary action ${auxIndex} on strike ${strikeIndex}`);
    return aux.execute();
  });
}

/** Preview a strike's damage/critical formula without rolling (for the prompt). */
export async function previewStrikeDamage(actorId: string, strikeIndex: number, critical: boolean): Promise<string | null> {
  try {
    const strike = getStrike(actorId, strikeIndex);
    const method = critical ? strike.critical : strike.damage;
    if (!method) return null;
    const formula = await method.call(strike, { getFormula: true });
    return typeof formula === "string" ? formula : null;
  } catch (err) {
    console.error("[pf2e-mobile] strike damage preview failed", err);
    return null;
  }
}

/** Preview an attack's total with a set of modifiers disabled (by slug), without
 *  rolling. Transiently sets `.ignored` on the matching live modifiers, recomputes
 *  via PF2e's own stacking, reads back the grand total (incl. the MAP penalty) and
 *  the post-stacking rows, then RESTORES the prior `.ignored` — all synchronous, so
 *  the live strike is never left mutated. Returns null if the strike can't recompute. */
export async function previewStrikeAttack(
  actorId: string,
  strikeIndex: number,
  variantIndex: number,
  disabledSlugs: string[],
): Promise<StrikeAttackPreview | null> {
  try {
    const strike = getStrike(actorId, strikeIndex);
    const variant = strike.variants?.[variantIndex];
    if (!variant || !strike.modifiers || !strike.calculateTotal) return null;
    const disabled = new Set(disabledSlugs);
    const touched = strike.modifiers.filter((m) => disabled.has(m.slug ?? ""));
    const prev = touched.map((m) => m.ignored ?? false);
    try {
      touched.forEach((m) => { m.ignored = true; });
      strike.calculateTotal();
      const total = (strike.totalModifier ?? 0) + (variant.penalty ?? 0);
      const parts = strike.modifiers
        // keep visible rows + any the user just disabled (so a hideIfDisabled rune doesn't vanish)
        .filter((m) => m.enabled || !m.hideIfDisabled || disabled.has(m.slug ?? ""))
        .map((m) => ({ slug: m.slug ?? "", label: m.label ?? "", value: m.modifier ?? 0, enabled: m.enabled ?? false }));
      return { total, parts };
    } finally {
      touched.forEach((m, i) => { m.ignored = prev[i]; });
      strike.calculateTotal();
    }
  } catch (err) {
    console.error("[pf2e-mobile] strike attack preview failed", err);
    return null;
  }
}

/** Set (or clear, with null) the selected ammunition on a ranged strike's weapon.
 *  PF2e auto-consumes a round on the attack roll, so rolling is unchanged. */
export function setStrikeAmmo(actorId: string, strikeIndex: number, ammoId: string | null): Promise<void> {
  return guard(() => {
    const weapon = getStrike(actorId, strikeIndex).item;
    if (!weapon?.update) throw new Error(`strike ${strikeIndex} has no weapon item`);
    return weapon.update({ system: { selectedAmmoId: ammoId } });
  });
}
