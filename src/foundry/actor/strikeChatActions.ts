/** Live strike-card actions driven from the mobile chat feed. Guarded like
 *  `spells/chatActions.ts`. A posted attack card's Damage/Crit buttons are dead on
 *  mobile (their native handlers target a canvas token / a suppressed dialog), so
 *  we resolve the strike from the message and roll it ourselves. PF2e posts the
 *  resulting damage card, which flows through the existing chat feed. */

type Dict = Record<string, unknown>;

interface LiveStrike {
  label?: string;
  damage?: (args?: Dict) => Promise<unknown>;
  critical?: (args?: Dict) => Promise<unknown>;
}

/** Resolve the strike a posted attack message came from. PF2e exposes `_attack`
 *  (its own resolver); fall back to matching the roll/context `identifier`
 *  ("<itemId>.<slug>.<melee|ranged>") against the speaker actor's prepared strikes. */
function resolveAttack(messageId: string): LiveStrike | null {
  const msg = (game as any)?.messages?.get(messageId);
  if (!msg) return null;
  const direct = msg._attack as LiveStrike | undefined;
  if (direct) return direct;
  const actor = msg.speakerActor ?? (game as any)?.actors?.get(msg.speaker?.actor);
  const context = msg.flags?.pf2e?.context;
  const roll = (msg.rolls ?? []).find((r: any) => r?.options?.identifier);
  const identifier: string | undefined = roll?.options?.identifier ?? context?.identifier;
  const [itemId, slug] = identifier?.split(".") ?? [];
  const strike = (actor?.system?.actions ?? []).find((s: any) => s.slug === slug && s.item?.id === itemId);
  return (strike as LiveStrike) ?? null;
}

async function guard(run: () => Promise<unknown>): Promise<void> {
  try {
    await run();
  } catch (err) {
    console.error("[pf2e-mobile] strike card action failed", err);
    (ui as any)?.notifications?.error?.("Strike action failed — see console.");
  }
}

function damageEvent(): Dict {
  const show = !!(game as any)?.user?.settings?.showDamageDialogs;
  return { event: new PointerEvent("click", { shiftKey: show }) };
}

/** Roll damage (or critical) for a posted attack card. */
export function rollAttackCardDamage(messageId: string, opts: { critical?: boolean } = {}): Promise<void> {
  return guard(() => {
    const strike = resolveAttack(messageId);
    const method = opts.critical ? strike?.critical : strike?.damage;
    if (!strike || !method) throw new Error(`no strike damage on message ${messageId}`);
    return method.call(strike, damageEvent());
  });
}

/** Preview the damage/critical formula for a posted attack card without rolling. */
export async function previewAttackCardDamage(messageId: string, opts: { critical?: boolean } = {}): Promise<string | null> {
  try {
    const strike = resolveAttack(messageId);
    const method = opts.critical ? strike?.critical : strike?.damage;
    if (!strike || !method) return null;
    const formula = await method.call(strike, { getFormula: true });
    return typeof formula === "string" ? formula : null;
  } catch (err) {
    console.error("[pf2e-mobile] strike damage preview failed", err);
    return null;
  }
}

/** The strike/weapon name for a posted attack card (popup title). */
export function attackCardLabel(messageId: string): string {
  const msg = (game as any)?.messages?.get(messageId);
  return resolveAttack(messageId)?.label ?? msg?.item?.name ?? "Strike";
}
