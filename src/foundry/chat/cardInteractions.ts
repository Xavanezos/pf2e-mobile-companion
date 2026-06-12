/** A tap on the mounted PF2e card, classified into a mobile action. The card is
 *  real PF2e HTML; its native handlers assume a canvas token (absent on mobile),
 *  so we intercept these controls and drive them ourselves. */
export type CardInteraction =
  | { kind: "damage"; messageId: string }
  | { kind: "save"; messageId: string; saveType: string; dc: number }
  | { kind: "effect"; uuid: string }
  | { kind: "strike-damage"; messageId: string; critical: boolean };

/** Pure: given the attributes of the tapped control, produce the interaction.
 *  Disambiguates by which attributes are present. The caller's CONTROL_SELECTOR
 *  matches either an effect link (a[data-uuid]) or an action button, never both, so
 *  the uuid-before-action order below is unambiguous. */
export function interactionFromControl(
  c: { action: string | null; save: string | null; dc: string | null; uuid: string | null; outcome?: string | null },
  messageId: string,
): CardInteraction | null {
  if (c.uuid && c.uuid.includes("spell-effects")) return { kind: "effect", uuid: c.uuid };
  if (c.action === "spell-damage") return { kind: "damage", messageId };
  // Mirror PF2e (cards.ts): the damage button is data-outcome="success"; the
  // critical button is data-outcome="critical-success". Default anything non-success
  // to critical, exactly as PF2e does (`outcome === "success" ? damage : critical`).
  if (c.action === "strike-damage") return { kind: "strike-damage", messageId, critical: c.outcome !== "success" };
  if (c.action === "spell-save") {
    const dc = Number(c.dc);
    // dc must be a positive integer; a missing/empty data-dc (Number("") === 0) is rejected
    if (c.save && Number.isInteger(dc) && dc > 0) return { kind: "save", messageId, saveType: c.save, dc };
  }
  return null;
}

/** DOM glue (untested, like render.ts): from a click target, find the nearest
 *  card control and classify it. Returns null for taps on anything else. The
 *  strike-damage button carries `data-outcome` ("success" → damage, else critical). */
const CONTROL_SELECTOR =
  'button[data-action="spell-damage"],button[data-action="spell-save"],button[data-action="strike-damage"],a[data-uuid]';
export function classifyCardClick(target: Element | null, messageId: string): CardInteraction | null {
  const el = target?.closest<HTMLElement>(CONTROL_SELECTOR);
  if (!el) return null;
  return interactionFromControl(
    {
      action: el.getAttribute("data-action"),
      save: el.getAttribute("data-save"),
      dc: el.getAttribute("data-dc"),
      uuid: el.getAttribute("data-uuid"),
      outcome: el.getAttribute("data-outcome"),
    },
    messageId,
  );
}
