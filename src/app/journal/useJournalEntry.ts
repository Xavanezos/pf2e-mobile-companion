import { useCallback, useMemo, useReducer } from "react";
import { useFoundryHook } from "../useFoundryHook";
import { buildEntryPages } from "../../foundry/journal/view";
import type { EntryView, PageLike } from "../../foundry/journal/types";

const OBSERVER = 2; // CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER

/** Live view of one open journal entry: its visible pages, in order. Re-preps on
 *  the page hooks + `updateJournalEntry`. Per-page visibility uses
 *  `page.testUserPermission(user, OBSERVER)` (a shared entry can hide pages).
 *  Returns null when the id is null or the entry is gone. */
export function useJournalEntry(entryId: string | null): EntryView | null {
  const [version, bump] = useReducer((n: number) => n + 1, 0);
  const onChange = useCallback(() => bump(), []);
  useFoundryHook("createJournalEntryPage", onChange);
  useFoundryHook("updateJournalEntryPage", onChange);
  useFoundryHook("deleteJournalEntryPage", onChange);
  useFoundryHook("updateJournalEntry", onChange);

  return useMemo(() => {
    if (!entryId) return null;
    const entry = (game as any)?.journal?.get(entryId);
    if (!entry) return null;
    const user = (game as any)?.user;
    const pages: PageLike[] = [...(entry.pages ?? [])].map((p: any) => ({
      id: p.id,
      name: p.name,
      type: p.type,
      visible: p.testUserPermission ? p.testUserPermission(user, OBSERVER) : true,
      sort: p.sort ?? 0,
      content: p.text?.content ?? "",
      src: p.src ?? null,
      caption: p.image?.caption ?? "",
      showTitle: p.title?.show,
    }));
    return { id: entry.id, name: entry.name, pages: buildEntryPages(pages) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, entryId]);
}
