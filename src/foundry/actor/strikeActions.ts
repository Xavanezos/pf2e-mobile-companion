/** Live PF2e strike rolls for the Actions tab. Thin glue over the system API,
 *  guarded so a rejected roll surfaces via Foundry's toast and never throws into
 *  React — same contract as `rolls.ts`. The strike posts the real attack/damage
 *  card, which flows through the existing chat feed (Chat tab + toast).
 *
 *  We never hold a live strike in React state: the view carries the strike's index
 *  in `actor.system.actions`, and these functions re-read the live strike by it —
 *  exactly how PF2e's own sheet resolves a strike from a clicked button. */

type Dict = Record<string, unknown>;

interface StrikeVariant { roll(args?: Dict): Promise<unknown>; }
interface LiveStrike {
  slug?: string;
  variants?: StrikeVariant[];
  damage?: (args?: Dict) => Promise<unknown>;
  critical?: (args?: Dict) => Promise<unknown>;
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

/** Roll one MAP variant of a strike (variantIndex 0/1/2 → MAP 0/-5/-10). */
export function rollStrikeAttack(actorId: string, strikeIndex: number, variantIndex: number): Promise<void> {
  return guard(() => {
    const variant = getStrike(actorId, strikeIndex).variants?.[variantIndex];
    if (!variant) throw new Error(`no variant ${variantIndex} on strike ${strikeIndex}`);
    return variant.roll(skipDialogEvent("showCheckDialogs"));
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
