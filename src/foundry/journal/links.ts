/** Journal content-link routing. Enriched journal HTML contains
 *  `<a class="content-link" data-uuid>` (document links) and `<a class="inline-roll"
 *  data-formula>` (inline rolls). We delegate clicks from the page container:
 *  resolve the uuid via `fromUuid` and route by document type, or post the inline
 *  roll to chat. PF2e's own inline links (`[data-pf2-check]` …) are left to bubble
 *  to PF2e's global listener (they handle actor selection themselves). */

export interface LinkHandlers {
  openEntry: (entryId: string) => void;
  openActor: (actorId: string) => void;
}

/** Resolve a content-link uuid and route it to the mobile UI. */
export async function routeContentLink(uuid: string, h: LinkHandlers): Promise<void> {
  try {
    const doc: any = await (globalThis as any).fromUuid?.(uuid);
    if (!doc) return;
    switch (doc.documentName) {
      case "JournalEntry":
        h.openEntry(doc.id);
        break;
      case "JournalEntryPage":
        if (doc.parent?.id) h.openEntry(doc.parent.id);
        break;
      case "Actor":
        h.openActor(doc.id);
        break;
      default:
        (ui as any)?.notifications?.info?.(doc.name ?? doc.documentName ?? "Link");
    }
  } catch (err) {
    console.error("[pf2e-mobile] content link failed", err);
  }
}

/** Post an inline-roll formula to chat. */
export async function rollInline(formula: string): Promise<void> {
  try {
    const RollCls = (globalThis as any).Roll;
    if (!RollCls || !formula) return;
    await new RollCls(formula).toMessage();
  } catch (err) {
    console.error("[pf2e-mobile] inline roll failed", err);
    (ui as any)?.notifications?.error?.("Roll failed — see console.");
  }
}

/** Click delegate for a rendered journal page container. Handles content-links and
 *  inline rolls (preventing default); returns false (no preventDefault) for
 *  anything else so PF2e's own `@Check`/`@Action` listeners can handle it. */
export function handlePageClick(
  e: { target: EventTarget | null; preventDefault: () => void },
  h: LinkHandlers,
): boolean {
  const target = e.target as HTMLElement | null;
  const content = target?.closest?.("a.content-link[data-uuid]") as HTMLElement | null;
  if (content?.dataset?.uuid) {
    e.preventDefault();
    void routeContentLink(content.dataset.uuid, h);
    return true;
  }
  const inline = target?.closest?.("a.inline-roll") as HTMLElement | null;
  if (inline?.dataset?.formula) {
    e.preventDefault();
    void rollInline(inline.dataset.formula);
    return true;
  }
  return false;
}
