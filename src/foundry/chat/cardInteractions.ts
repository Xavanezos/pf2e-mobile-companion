/** A tap on the mounted PF2e cast card, classified into a mobile action. The card
 *  is real PF2e HTML; its native handlers assume a canvas token (absent on mobile),
 *  so we intercept these controls and drive them ourselves. */
export type CardInteraction =
  | { kind: "damage"; messageId: string }
  | { kind: "save"; messageId: string; saveType: string; dc: number }
  | { kind: "effect"; uuid: string };

/** Pure: given the attributes of the tapped control, produce the interaction.
 *  Disambiguates by which attributes are present (effect link vs damage/save button). */
export function interactionFromControl(
  c: { action: string | null; save: string | null; dc: string | null; uuid: string | null },
  messageId: string,
): CardInteraction | null {
  if (c.uuid && c.uuid.includes("spell-effects")) return { kind: "effect", uuid: c.uuid };
  if (c.action === "spell-damage") return { kind: "damage", messageId };
  if (c.action === "spell-save") {
    const dc = Number(c.dc);
    if (c.save && Number.isInteger(dc)) return { kind: "save", messageId, saveType: c.save, dc };
  }
  return null;
}

/** DOM glue (untested, like render.ts): from a click target, find the nearest
 *  card control and classify it. Returns null for taps on anything else. */
const CONTROL_SELECTOR =
  'button[data-action="spell-damage"],button[data-action="spell-save"],a[data-uuid]';
export function classifyCardClick(target: Element | null, messageId: string): CardInteraction | null {
  const el = target?.closest<HTMLElement>(CONTROL_SELECTOR);
  if (!el) return null;
  return interactionFromControl(
    {
      action: el.getAttribute("data-action"),
      save: el.getAttribute("data-save"),
      dc: el.getAttribute("data-dc"),
      uuid: el.getAttribute("data-uuid"),
    },
    messageId,
  );
}
