import { useCallback, useMemo, useReducer } from "react";
import { useFoundryHook } from "../useFoundryHook";
import { buildJournalTree } from "../../foundry/journal/view";
import type { FolderLike, JournalEntryLike, JournalTree } from "../../foundry/journal/types";

/** Live journal tree the active user may see. Re-preps on the journal-entry hooks
 *  (a share/unshare arrives as `updateJournalEntry` with an ownership diff). The
 *  Foundry-specific visibility (`entry.visible`) is computed here; the pure mapper
 *  just organizes + sorts + prunes. */
export function useJournals(): JournalTree {
  const [version, bump] = useReducer((n: number) => n + 1, 0);
  const onChange = useCallback(() => bump(), []);
  useFoundryHook("createJournalEntry", onChange);
  useFoundryHook("updateJournalEntry", onChange);
  useFoundryHook("deleteJournalEntry", onChange);

  return useMemo(() => {
    const journal = (game as any)?.journal;
    const folders = (game as any)?.folders;
    const entries: JournalEntryLike[] = journal
      ? [...journal].map((e: any) => ({
          id: e.id,
          name: e.name,
          sort: e.sort ?? 0,
          visible: !!e.visible,
          folderId: e.folder?.id ?? null,
        }))
      : [];
    const folderList: FolderLike[] = folders
      ? [...folders]
          .filter((f: any) => f.type === "JournalEntry")
          .map((f: any) => ({
            id: f.id,
            name: f.name,
            sort: f.sort ?? 0,
            parentId: f.folder?.id ?? null,
            sorting: f.sorting === "m" ? "m" : "a",
          }))
      : [];
    return buildJournalTree(entries, folderList);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version]);
}
