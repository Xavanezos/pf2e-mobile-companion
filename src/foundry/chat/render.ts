/** Render a live PF2e chat card to an HTMLElement and let the system attach its
 *  listeners (apply-damage, etc.). DOM/Foundry glue — no unit test.
 *
 *  `message.renderHTML()` builds the card; PF2e binds chat-card listeners on the
 *  `renderChatMessageHTML` hook, which the stock sidebar fires but we must emit
 *  ourselves for elements we mount. Whether that wires the damage buttons is the
 *  Slice-1 spike (Task 8). */
export async function renderMessageElement(messageId: string): Promise<HTMLElement | null> {
  try {
    const msg = (game as any)?.messages?.get(messageId);
    if (!msg?.renderHTML) return null;
    const el: HTMLElement = await msg.renderHTML();
    try { (Hooks as any)?.callAll?.("renderChatMessageHTML", msg, el); } catch { /* listeners optional */ }
    return el;
  } catch (err) {
    console.warn("[pf2e-mobile] message renderHTML failed", err);
    return null;
  }
}
