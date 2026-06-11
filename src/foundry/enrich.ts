/** Best-effort enrichment of PF2e HTML (resolves @UUID / trait links, inline
 *  rolls). Falls back to the raw string if Foundry's TextEditor isn't reachable
 *  (its location differs across core versions). Never throws. */
export async function enrichHtml(html: string): Promise<string> {
  if (!html) return "";
  try {
    const g = globalThis as any;
    const TE =
      g.TextEditor ??
      g.foundry?.applications?.ux?.TextEditor?.implementation ??
      g.foundry?.applications?.ux?.TextEditor;
    if (TE?.enrichHTML) return await TE.enrichHTML(html, { async: true });
  } catch (err) {
    console.warn("[pf2e-mobile] enrichHTML failed; rendering raw", err);
  }
  return html;
}
