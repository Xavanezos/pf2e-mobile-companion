import type {
  EntryNode, FolderNode, FolderLike, JournalEntryLike, JournalTree, PageLike, PageView,
} from "./types";

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);

function sortEntries(list: JournalEntryLike[], sorting: "a" | "m"): EntryNode[] {
  const sorted = [...list].sort((a, b) =>
    sorting === "m" ? a.sort - b.sort || a.name.localeCompare(b.name) : a.name.localeCompare(b.name),
  );
  return sorted.map((e) => ({ id: e.id, name: e.name }));
}

/** Pure: organize visible journal entries + folders into a sorted, empty-pruned
 *  tree. The hook precomputes each entry's `visible` (Foundry permission), so this
 *  stays globals-free + testable. Folders sort by name; entries within a folder by
 *  the folder's `sorting` ("m" = manual sort field, else alphabetical); loose
 *  (folderless) entries by name. Folders with no visible entry anywhere in their
 *  subtree are pruned. */
export function buildJournalTree(entries: JournalEntryLike[], folders: FolderLike[]): JournalTree {
  const folderIds = new Set(folders.map((f) => f.id));
  const groups = new Map<string | null, JournalEntryLike[]>();
  for (const e of entries) {
    if (!e.visible) continue;
    const key = e.folderId && folderIds.has(e.folderId) ? e.folderId : null;
    const list = groups.get(key) ?? [];
    list.push(e);
    groups.set(key, list);
  }

  const nodes = new Map<string, FolderNode>();
  for (const f of folders) {
    nodes.set(f.id, { id: f.id, name: f.name, folders: [], entries: sortEntries(groups.get(f.id) ?? [], f.sorting) });
  }
  const roots: FolderNode[] = [];
  for (const f of folders) {
    const node = nodes.get(f.id)!;
    if (f.parentId && nodes.has(f.parentId)) nodes.get(f.parentId)!.folders.push(node);
    else roots.push(node);
  }

  const hasEntries = (n: FolderNode): boolean => n.entries.length > 0 || n.folders.some(hasEntries);
  const sortFolders = (list: FolderNode[]): FolderNode[] => list.filter(hasEntries).sort(byName);
  const prune = (n: FolderNode): void => {
    n.folders = sortFolders(n.folders);
    n.folders.forEach(prune);
  };
  const rootFolders = sortFolders(roots);
  rootFolders.forEach(prune);

  return { folders: rootFolders, entries: sortEntries(groups.get(null) ?? [], "a") };
}

/** Pure: the visible pages of an entry, in sort order, mapped to render-ready
 *  views (text content kept raw for the component to enrich asynchronously). */
export function buildEntryPages(pages: PageLike[]): PageView[] {
  return pages
    .filter((p) => p.visible)
    .sort((a, b) => a.sort - b.sort)
    .map((p) => ({
      id: p.id,
      name: p.name,
      type: p.type,
      html: p.type === "text" ? p.content : "",
      src: p.src ?? null,
      caption: p.caption ?? "",
      showTitle: p.showTitle !== false,
    }));
}
