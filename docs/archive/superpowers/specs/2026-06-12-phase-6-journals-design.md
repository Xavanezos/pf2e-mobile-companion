# Phase 6 — Journals — Design

**Status:** Specced 2026-06-12 (built after the battle map per the revised build order). Autonomous brainstorming (user away) — decisions below are drawn from the master-plan Phase 6 bullets + the established pattern, **flagged for review**. API paths confirmed by the journals API research against the cloned PF2e + fvtt-types (see §API grounding).

The bottom **Journal** tab (today a `Placeholder`) becomes a read-only campaign-handout reader: the journals the player may see, grouped by folder, each opening to its pages — text rendered through PF2e's enricher (so `@UUID` links, inline rolls, `@Check`s resolve), images shown with a pinch-zoom viewer. Foundry owns the data and permissions; we render the live Documents and never mutate them.

**Out of scope (v1):** editing/creating journals or pages; the in-page heading TOC / anchor jumps; search; PDF.js rendering (PDF pages link out); reordering; GM "show to players". Per-tap navigation only.

## Decisions (autonomous — review on return)

1. **Custom mobile reader, not Foundry's journal sheet.** Same "we draw it" decision as every other tab. A two-level view: a **list** (collapsible folders + entries) → tap an entry → a **page view** (its visible pages stacked) with a back button.
2. **Permission-correct at both levels.** List only entries with `entry.visible` (OBSERVER; LIMITED is meaningless for journals). Within an entry, show only pages the player may see (`page.testUserPermission(user,"OBSERVER")`) — a visible entry can contain hidden pages.
3. **Reuse the existing enricher.** Text pages render `page.text.content` through the existing `enrichHtml` (`src/foundry/enrich.ts`, which already targets PF2e's `TextEditor` subclass) and inject via `dangerouslySetInnerHTML` — the established `DetailModal`/`BioPanel` idiom (Foundry output is trusted; no extra sanitization).
4. **Lightweight content-link handling, not Foundry sheets.** One delegated click handler on the rendered container: a `content-link[data-uuid]` → `fromUuid` → route by `documentName` (JournalEntry/Page → navigate the reader; Actor → switch the app to that actor's sheet; else → toast). `inline-roll` → post the roll to chat. PF2e `[data-pf2-check]` etc. are left to **bubble to PF2e's own global listener** (v1; mobile has no token selection, so a `@Check` falls back to `game.user.character` — flagged for the live check).
5. **Pure tree mapper.** `buildJournalTree(entries, folders)` organizes pre-filtered structural data into a sorted, empty-pruned folder tree — unit-tested. The hook owns the Foundry-specific `visible` computation (passes a precomputed `visible` flag in), keeping the mapper globals-free. `buildEntryPages(pages)` similarly filters+sorts+maps page shapes.
6. **Images get a real pinch-zoom viewer.** Image pages render fit-to-width; tapping opens a full-screen `ZoomableImage` (the map's pan/zoom gesture model, single image) for handouts/maps. PDF/video pages render a link / `<video>`.

## Architecture & data flow

Established pattern: pure mapper → version-bumped hook → thin UI. (No guarded *actions* — journals are read-only.)

```
Journal tab (JournalTab)
   ├─ list mode:  useJournals() → buildJournalTree(entries, folders)        [pure]
   │     entries = game.journal, each {…, visible: entry.visible, folderId}
   │     folders = game.folders (type "JournalEntry")
   │     re-preps on create/update/deleteJournalEntry (ownership changes arrive as updateJournalEntry)
   │     → collapsible folders + entries; tap an entry → openEntryId
   │
   └─ page mode: useJournalEntry(openEntryId) → { name, pages: buildEntryPages(visiblePages) }
         visiblePages = entry.pages filtered by page.testUserPermission(user,"OBSERVER"), sorted by sort
         re-preps on create/update/deleteJournalEntryPage (for this entry) + updateJournalEntry
         text page  → enrichHtml(page.text.content) → dangerouslySetInnerHTML (+ delegated link clicks)
         image page → <img> fit-to-width, tap → <ZoomableImage>
         pdf/video  → link / <video src=page.src>
```

## Components & data layer

**New files**

| File | Purpose |
|---|---|
| `src/foundry/journal/types.ts` | `JournalTree`, `FolderNode`, `EntryNode`, `EntryView`, `PageView`, source `*Like` shapes |
| `src/foundry/journal/view.ts` | pure `buildJournalTree(entries, folders)` + `buildEntryPages(pages)` |
| `src/app/journal/useJournals.ts` | tree hook (visible-entry filter via `entry.visible`); re-preps on entry hooks |
| `src/app/journal/useJournalEntry.ts` | open-entry hook → name + visible `PageView[]`; re-preps on page hooks |
| `src/app/journal/JournalTab.tsx` | the tab: list (folders/entries) ⇄ page view; owns `openEntryId` + folder-collapse state + link routing |
| `src/app/journal/JournalPage.tsx` | one page: text (enrich + delegated links) / image / pdf / video |
| `src/app/journal/ZoomableImage.tsx` | full-screen pinch/pan image viewer (handouts) |
| `src/foundry/journal/links.ts` | `resolveContentLink(anchor)` → `{ kind, doc }` via `fromUuid`; pure-ish helper for routing |

**Edit:** `src/app/TabContent.tsx` — route `"journal"` → `<JournalTab />` (drop the `Placeholder`). Reuse `src/foundry/enrich.ts` and `src/app/sheet/parts/Modal.tsx`.

### Key types

```ts
export interface EntryNode { id: string; name: string; }
export interface FolderNode { id: string; name: string; folders: FolderNode[]; entries: EntryNode[]; }
export interface JournalTree { folders: FolderNode[]; entries: EntryNode[]; } // entries = loose (no folder)

export interface PageView {
  id: string; name: string;
  type: "text" | "image" | "pdf" | "video" | string;
  html: string;          // raw text.content (enriched in the component); "" for non-text
  src: string | null;    // image/pdf/video path
  caption: string;
  showTitle: boolean;
}
export interface EntryView { id: string; name: string; pages: PageView[]; }

// pre-filtered structural inputs (the hook computes `visible` from the live docs)
export interface JournalEntryLike { id: string; name: string; sort: number; visible: boolean; folderId: string | null; }
export interface FolderLike { id: string; name: string; sort: number; parentId: string | null; sorting: "a" | "m"; }
export interface PageLike { id: string; name: string; type: string; visible: boolean; sort: number; content: string; src: string | null; caption?: string; showTitle?: boolean; }
```

`buildJournalTree`: drop non-visible entries; nest folders by `parentId`; attach entries to their folder (or "loose"); **prune folders with no visible entry in their subtree**; sort folders by name, entries within a folder by the folder's `sorting` (`"m"`→`sort`, else name), loose entries by name. Pure → tested.

`buildEntryPages`: drop non-visible pages; sort by `sort`; map type/content/src/caption. Pure → tested.

## API grounding (confirmed by research 2026-06-12)

- **List:** `game.journal.filter(e => e.visible)` (OBSERVER; LIMITED has no journal meaning). Per-page: `page.testUserPermission(game.user, CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER)`.
- **Folders:** `game.folders.filter(f => f.type === "JournalEntry")`; `entry.folder?.id`, `folder.folder?.id` (parent), `folder.sorting` (`"a"`/`"m"`), `entry.sort`/`folder.sort`.
- **Pages:** `entry.pages` (EmbeddedCollection). `page.type` ∈ `"text"|"image"|"pdf"|"video"`; `page.text.content` (HTML), `page.src`, `page.image.caption`, `page.sort`, `page.title.show`.
- **Enrich:** reuse `enrichHtml` — live `TextEditor.implementation` is PF2e's subclass (free inline-roll/visibility processing); optionally pass `relativeTo: page` + `secrets: game.user.isGM`.
- **Links:** enriched `<a class="content-link" data-uuid data-type …>`; resolve with `await fromUuid(uuid)` → route by `doc.documentName`. `<a class="inline-roll" data-formula>` → roll to chat. PF2e `[data-pf2-check]`/`[data-pf2-action]` bubble to PF2e's document listener.
- **Hooks:** `create/update/deleteJournalEntry`, `create/update/deleteJournalEntryPage`. Ownership/"share" changes arrive as `updateJournalEntry` (with `ownership` in the diff).

## Testing

- **TDD the pure mappers** (`tests/journalTree.test.ts`, `tests/journalPages.test.ts`): tree nesting + parent/child; **empty-folder pruning**; loose (folderless) entries; visible filter (entry + page); entry sort by name vs manual (`sorting:"m"`); page type/content/src mapping + sort. Structural fixtures, no globals.
- Hooks/components/links = typecheck + build + a manual live checklist (GM shares a multi-page entry incl. a hidden page + an image handout + a `@UUID` link to an actor; Player1 at mobile width):
  - only shared entries appear, grouped by folder (collapsible); a hidden page inside a shared entry does **not** show.
  - a text page renders formatted, with working `@UUID`/inline-roll links (actor link → switches to that sheet; journal link → navigates; inline roll → posts to chat).
  - an image page renders and pinch-zooms; pdf/video pages render a link / player.
  - live: GM shares/unshares an entry → the list updates within ~1s.

## Execution

Per `execution-workflow`: inline batched execution, commit per task to `main`, `Phase 6 (Task M): …` + the `Co-Authored-By` trailer. Tasks: **1** types + `buildJournalTree`/`buildEntryPages` (TDD) · **2** `useJournals`/`useJournalEntry` + `JournalTab` list⇄page nav + route (render) — *live-look checkpoint* · **3** `JournalPage` (text-enrich + image + pdf/video) + content-link delegation (`links.ts`) · **4** `ZoomableImage` pinch-zoom + verification.
