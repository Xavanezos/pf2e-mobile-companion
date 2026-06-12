import { describe, it, expect } from "vitest";
import { buildJournalTree } from "../src/foundry/journal/view";
import type { JournalEntryLike, FolderLike } from "../src/foundry/journal/types";

function entry(over: Partial<JournalEntryLike> = {}): JournalEntryLike {
  return { id: "e1", name: "Entry", sort: 0, visible: true, folderId: null, ...over };
}
function folder(over: Partial<FolderLike> = {}): FolderLike {
  return { id: "f1", name: "Folder", sort: 0, parentId: null, sorting: "a", ...over };
}

describe("buildJournalTree", () => {
  it("nests a child folder under its parent and attaches entries", () => {
    const folders = [folder({ id: "p", name: "Parent" }), folder({ id: "c", name: "Child", parentId: "p" })];
    const entries = [entry({ id: "e", name: "Note", folderId: "c" })];
    const tree = buildJournalTree(entries, folders);
    expect(tree.folders).toHaveLength(1);
    expect(tree.folders[0].id).toBe("p");
    expect(tree.folders[0].folders[0].id).toBe("c");
    expect(tree.folders[0].folders[0].entries.map((e) => e.id)).toEqual(["e"]);
  });

  it("prunes folders with no visible entries but keeps populated ones", () => {
    const folders = [folder({ id: "empty", name: "Empty" }), folder({ id: "full", name: "Full" })];
    const tree = buildJournalTree([entry({ id: "e", folderId: "full" })], folders);
    expect(tree.folders.map((f) => f.id)).toEqual(["full"]);
  });

  it("keeps a parent whose only entries live in a child folder", () => {
    const folders = [folder({ id: "p", name: "Parent" }), folder({ id: "c", name: "Child", parentId: "p" })];
    const tree = buildJournalTree([entry({ id: "e", folderId: "c" })], folders);
    expect(tree.folders.map((f) => f.id)).toEqual(["p"]);
  });

  it("puts folderless entries in tree.entries (loose)", () => {
    const tree = buildJournalTree([entry({ id: "loose", folderId: null })], []);
    expect(tree.entries.map((e) => e.id)).toEqual(["loose"]);
    expect(tree.folders).toEqual([]);
  });

  it("drops non-visible entries", () => {
    const tree = buildJournalTree([entry({ id: "shown" }), entry({ id: "hidden", visible: false })], []);
    expect(tree.entries.map((e) => e.id)).toEqual(["shown"]);
  });

  it("sorts entries alphabetically, or by sort when the folder is manual", () => {
    const alpha = buildJournalTree(
      [entry({ id: "b", name: "Beta", folderId: "f" }), entry({ id: "a", name: "Alpha", folderId: "f" })],
      [folder({ id: "f", sorting: "a" })],
    );
    expect(alpha.folders[0].entries.map((e) => e.id)).toEqual(["a", "b"]);
    const manual = buildJournalTree(
      [entry({ id: "b", name: "Beta", sort: 0, folderId: "f" }), entry({ id: "a", name: "Alpha", sort: 10, folderId: "f" })],
      [folder({ id: "f", sorting: "m" })],
    );
    expect(manual.folders[0].entries.map((e) => e.id)).toEqual(["b", "a"]); // sort 0 before 10
  });
});
