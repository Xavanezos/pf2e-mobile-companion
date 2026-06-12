// Type contract for the journals reader: the tree + page views the UI renders,
// plus the structural shapes of the live JournalEntry / Folder / Page documents.

export interface EntryNode {
  id: string;
  name: string;
}

export interface FolderNode {
  id: string;
  name: string;
  folders: FolderNode[];
  entries: EntryNode[];
}

/** The reader's sidebar tree: top-level folders + folderless ("loose") entries. */
export interface JournalTree {
  folders: FolderNode[];
  entries: EntryNode[];
}

export interface PageView {
  id: string;
  name: string;
  type: "text" | "image" | "pdf" | "video" | string;
  html: string;        // raw text.content (enriched in the component); "" for non-text
  src: string | null;  // image / pdf / video path
  caption: string;
  showTitle: boolean;
}

export interface EntryView {
  id: string;
  name: string;
  pages: PageView[];
}

// ---- pre-filtered structural inputs (the hook computes `visible` from live docs) ----

export interface JournalEntryLike {
  id: string;
  name: string;
  sort: number;
  visible: boolean;
  folderId: string | null;
}

export interface FolderLike {
  id: string;
  name: string;
  sort: number;
  parentId: string | null;
  sorting: "a" | "m";  // "a" = alphabetical, "m" = manual (use the sort field)
}

export interface PageLike {
  id: string;
  name: string;
  type: string;
  visible: boolean;
  sort: number;
  content: string;
  src: string | null;
  caption?: string;
  showTitle?: boolean;
}
