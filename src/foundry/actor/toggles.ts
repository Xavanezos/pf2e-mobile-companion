import type { TogglesActorLike, TogglesView } from "./types";

/** Pure: flatten `actor.synthetics.toggles[domain][option]` (mirrors the sheet's
 *  `actor/sheet/base.ts:149-153`) to the actions-placement combat toggles. An
 *  `alwaysActive` toggle is checked-but-disabled (always on, not user-changeable). */
export function buildTogglesView(actor: TogglesActorLike): TogglesView {
  const domains = actor.synthetics?.toggles ?? {};
  const out: TogglesView = [];
  for (const byOption of Object.values(domains)) {
    for (const t of Object.values(byOption ?? {})) {
      if ((t.placement ?? "actions") !== "actions") continue;
      out.push({
        domain: t.domain ?? "",
        option: t.option ?? "",
        itemId: t.itemId ?? "",
        label: t.label ?? "",
        checked: !!t.checked,
        enabled: t.alwaysActive ? false : t.enabled !== false,
      });
    }
  }
  return out;
}

interface ToggleActor { toggleRollOption(domain: string, option: string, itemId: string | null, value: boolean): Promise<unknown>; }

/** Guarded: flip a roll-option toggle (mirrors the sheet handler `sheet/base.ts:472`).
 *  Never throws into React — a failure surfaces via Foundry's toast. */
export function setToggle(actorId: string, domain: string, option: string, itemId: string, value: boolean): Promise<void> {
  return (async () => {
    try {
      const actor = (game as any)?.actors?.get(actorId) as ToggleActor | undefined;
      if (!actor?.toggleRollOption) throw new Error(`actor ${actorId} cannot toggle`);
      await actor.toggleRollOption(domain, option, itemId || null, value);
    } catch (err) {
      console.error("[pf2e-mobile] setToggle failed", err);
      (ui as any)?.notifications?.error?.("Toggle failed — see console.");
    }
  })();
}
