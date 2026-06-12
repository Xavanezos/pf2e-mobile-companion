import { useState } from "react";
import { useJournals } from "./useJournals";
import { useJournalEntry } from "./useJournalEntry";
import { JournalPage } from "./JournalPage";
import type { EntryNode, FolderNode } from "../../foundry/journal/types";

/** The Journal tab: a read-only reader. A list of permission-filtered entries
 *  grouped by collapsible folders; tapping an entry opens its visible pages. */
export function JournalTab() {
  const [openEntryId, setOpen] = useState<string | null>(null);
  if (openEntryId) return <EntryView entryId={openEntryId} onBack={() => setOpen(null)} />;
  return <JournalList onOpen={setOpen} />;
}

function JournalList({ onOpen }: { onOpen: (id: string) => void }) {
  const tree = useJournals();
  if (tree.folders.length === 0 && tree.entries.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-zinc-500">
        <i className="fas fa-book text-3xl" aria-hidden="true" />
        <div className="text-sm">No journals.</div>
      </div>
    );
  }
  return (
    <div className="h-full overflow-y-auto">
      {tree.folders.map((f) => <FolderRow key={f.id} folder={f} depth={0} onOpen={onOpen} />)}
      {tree.entries.map((e) => <EntryRow key={e.id} entry={e} depth={0} onOpen={onOpen} />)}
    </div>
  );
}

function FolderRow({ folder, depth, onOpen }: { folder: FolderNode; depth: number; onOpen: (id: string) => void }) {
  const [open, setOpen] = useState(true);
  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-start gap-2 py-2 pr-3 text-left text-sm font-semibold text-zinc-300"
        style={{ paddingLeft: 12 + depth * 16 }}
      >
        <i className={`fas fa-chevron-${open ? "down" : "right"} w-3 text-xs text-zinc-500`} aria-hidden="true" />
        <i className="fas fa-folder text-amber-400/80" aria-hidden="true" />
        <span className="truncate">{folder.name}</span>
      </button>
      {open && (
        <div>
          {folder.folders.map((f) => <FolderRow key={f.id} folder={f} depth={depth + 1} onOpen={onOpen} />)}
          {folder.entries.map((e) => <EntryRow key={e.id} entry={e} depth={depth + 1} onOpen={onOpen} />)}
        </div>
      )}
    </div>
  );
}

function EntryRow({ entry, depth, onOpen }: { entry: EntryNode; depth: number; onOpen: (id: string) => void }) {
  return (
    <button
      onClick={() => onOpen(entry.id)}
      className="flex w-full items-center justify-start gap-2 py-2 pr-3 text-left text-sm text-zinc-200 active:bg-zinc-800"
      style={{ paddingLeft: 12 + depth * 16 }}
    >
      <i className="fas fa-file-lines w-3 text-xs text-zinc-500" aria-hidden="true" />
      <span className="truncate">{entry.name}</span>
    </button>
  );
}

function EntryView({ entryId, onBack }: { entryId: string; onBack: () => void }) {
  const entry = useJournalEntry(entryId);
  return (
    <div className="flex h-full flex-col">
      <header className="flex shrink-0 items-center gap-2 border-b border-zinc-800 bg-zinc-900 px-2 py-2">
        <button onClick={onBack} className="flex h-9 w-9 items-center justify-center text-zinc-300" aria-label="Back to journal list">
          <i className="fas fa-arrow-left" aria-hidden="true" />
        </button>
        <span className="truncate font-semibold text-zinc-100">{entry?.name ?? "…"}</span>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {!entry ? (
          <div className="p-4 text-sm text-zinc-500">Loading…</div>
        ) : entry.pages.length === 0 ? (
          <div className="p-4 text-sm text-zinc-500">No readable pages.</div>
        ) : (
          entry.pages.map((p) => <JournalPage key={p.id} page={p} />)
        )}
      </div>
    </div>
  );
}
