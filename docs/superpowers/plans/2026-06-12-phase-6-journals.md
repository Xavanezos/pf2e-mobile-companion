# Phase 6 — Journals — Implementation Plan

> Use superpowers:executing-plans. Commit per task to `main`, subject `Phase 6 (Task M): …` + the `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>` trailer. Typecheck + prod build + tests green each task. **Spec:** `docs/superpowers/specs/2026-06-12-phase-6-journals-design.md`. Baseline **190 tests**.

**Goal:** a read-only campaign-handout reader on the Journal tab — permission-filtered entries grouped by collapsible folders → tap an entry → its visible pages (text enriched via `enrichHtml`, images pinch-zoomable, pdf/video linked), with `@UUID`/inline-roll content links routed sensibly.

**Architecture:** pure mappers (`buildJournalTree`, `buildEntryPages`) → version-bumped hooks (`useJournals`, `useJournalEntry`) → thin UI (`JournalTab` list⇄page, `JournalPage`, `ZoomableImage`). Read-only — no guarded actions. Reuses `src/foundry/enrich.ts` + `src/app/sheet/parts/Modal.tsx`.

## File structure

| File | Responsibility | Task |
|---|---|---|
| `src/foundry/journal/types.ts` | tree/page view + `*Like` source types | 1 |
| `src/foundry/journal/view.ts` | pure `buildJournalTree`, `buildEntryPages` | 1 |
| `tests/journalTree.test.ts`, `tests/journalPages.test.ts` | mapper unit tests | 1 |
| `src/app/journal/useJournals.ts` | tree hook (`entry.visible`), re-prep on entry hooks | 2 |
| `src/app/journal/useJournalEntry.ts` | open-entry pages hook (`page.testUserPermission`), re-prep on page hooks | 2 |
| `src/app/journal/JournalTab.tsx` | list (folders/entries) ⇄ page view; `openEntryId` + collapse state + link routing | 2,3 |
| `src/foundry/journal/links.ts` | `resolveContentLink(uuid)` + `routeAnchor` helpers (fromUuid) | 3 |
| `src/app/journal/JournalPage.tsx` | one page: text-enrich + delegated link clicks / image / pdf / video | 3 |
| `src/app/journal/ZoomableImage.tsx` | full-screen pinch/pan image viewer | 4 |
| `src/app/TabContent.tsx` *(edit)* | route `"journal"` → `<JournalTab />` | 2 |

## Task 1 — Types + pure mappers (TDD)

`buildJournalTree(entries, folders)`: filter `visible`; group by `folderId` (folderless → loose); build `FolderNode`s; nest by `parentId`; **prune folders whose subtree has no visible entry**; sort folders by name, entries within a folder by `folder.sorting` (`"m"`→`sort` tie-break name, else name), loose entries by name. `buildEntryPages(pages)`: filter `visible`, sort by `sort`, map `{id,name,type, html: type==="text"?content:"", src, caption, showTitle: showTitle!==false}`.

**`tests/journalTree.test.ts`** cases: (a) nests a child folder under its parent + attaches entries; (b) prunes an empty folder (no visible entries) but keeps a folder with a visible entry; (c) folderless entries land in `tree.entries`; (d) non-visible entries dropped; (e) entries sort by name, or by `sort` when the folder's `sorting==="m"`. **`tests/journalPages.test.ts`**: drops non-visible; sorts by `sort`; text → `html=content`, image → `html=""`,`src` set, `caption`; `showTitle` defaults true.

Commit `Phase 6 (Task 1): journal tree + page mappers`.

## Task 2 — Hooks + `JournalTab` list⇄page nav + route (render-only)

`useJournals()` (mirror `useEncounter`): `useFoundryHook` on `createJournalEntry`/`updateJournalEntry`/`deleteJournalEntry`; in the memo read `game.journal` → `JournalEntryLike[]` with `visible: e.visible`, `folderId: e.folder?.id ?? null`; `game.folders.filter(f=>f.type==="JournalEntry")` → `FolderLike[]` (`parentId: f.folder?.id ?? null`, `sorting: f.sorting`); return `buildJournalTree(...)`.

`useJournalEntry(entryId)`: hooks on the three `*JournalEntryPage` + `updateJournalEntry`; memo reads `game.journal.get(entryId)`, maps `entry.pages` → `PageLike[]` with `visible: p.testUserPermission(game.user, 2 /*OBSERVER*/)`, `content: p.text?.content ?? ""`, `src: p.src ?? null`, `caption: p.image?.caption ?? ""`, `showTitle: p.title?.show`; returns `{ id, name, pages: buildEntryPages(...) } | null`.

`JournalTab`: `const [openEntryId,setOpen]=useState<string|null>(null)`. `null` → list: render `tree.folders` (recursive collapsible — local `Set<string>` of collapsed ids) + `tree.entries`; tapping an entry → `setOpen(id)`. Non-null → `<EntryView>` using `useJournalEntry(openEntryId)` with a back button. Empty tree → "No journals.". Route `"journal"` → `<JournalTab/>` in `TabContent` (drop the `Placeholder` import if now unused — `map` no longer uses it either, so remove). Typecheck+build. Commit `Phase 6 (Task 2): journal list + entry navigation`. **CHECKPOINT — live-look.**

## Task 3 — Page rendering + content links

`src/foundry/journal/links.ts`: `routeContentLink(uuid, { openEntry, openActor })` → `await fromUuid(uuid)`; switch `doc.documentName`: `"JournalEntry"`→`openEntry(doc.id)`; `"JournalEntryPage"`→`openEntry(doc.parent.id)`; `"Actor"`→`openActor(doc.id)`; else→`ui.notifications.info(name)`. Guarded (try/catch). `rollInline(formula)` → `new Roll(formula).toMessage()` guarded.

`JournalPage`: by `page.type` — **text**: enrich via `enrichHtml(page.html)` in an effect → `dangerouslySetInnerHTML` into a `ref`'d div with the DetailModal child-selectors (`[&_a]:text-indigo-300 [&_h1]:font-bold …`); an `onClick` on that div: `closest("a.content-link[data-uuid]")` → preventDefault + `routeContentLink`; else `closest("a.inline-roll")` → preventDefault + `rollInline(dataset.formula)`; else let it bubble (PF2e `@Check`s). **image**: `<img src=page.src>` fit-to-width + caption, `onClick`→ open `ZoomableImage` (Task 4 wires the state; here a no-op/handler prop). **pdf**: a "Open PDF" link (`page.src`). **video**: `<video controls src=page.src>`. `JournalTab` passes `openEntry=setOpen` and `openActor=(id)=>{ setActorId(id); setActiveTab("sheet"); }`. Typecheck+build. Commit `Phase 6 (Task 3): render pages + content links`.

## Task 4 — Pinch-zoom images + verification

`ZoomableImage`: a full-screen overlay (`fixed inset-0 z-[110000] bg-black`) with the map's pan/zoom pointer model (reuse `screenToScene`/transform math) on a single `<img>`; tap-out / close button dismisses. `JournalPage` image tap → opens it. Then `npm run test` (confirm count = 190 + new), `typecheck`, `build`, and the spec's live checklist. Commit `Phase 6 (Task 4): pinch-zoom image viewer`.

> Live-only items for the checklist: `@Check`/PF2e inline links (no token selection on mobile → may fall back to `game.user.character`); whether `fromUuid` routing feels right for every link type; PDF rendering (linked, not embedded).
