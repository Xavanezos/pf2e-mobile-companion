# Spells — Overnight Build Report (2026-06-12)

Built and live-tested autonomously overnight. **`main` is green** (typecheck + build + 85 tests) and **verified working in your running Foundry** against Ezren (Level 1).

---

## TL;DR

- **The full Spells feature is built and committed** to `main`: a **Spells** sub-tab (under *Sheet*) mirroring PF2e's Spellcasting tab — **Known Spells / Rituals / Activations**, tap-a-spell **detail popups**, **casting** that posts the real card to the Slice‑1 chat feed, and a **spellbook** (prepare slots / manage repertoire).
- **I drove your live Foundry (as Player1) and tested it on Ezren.** It renders correctly, the spellbook opens, and casting Electric Arc posted to chat.
- **Live testing caught two real bugs, both now fixed:**
  1. A **pre‑existing production-build crash** — the app never mounted from a built `dist/` (only worked via the dev server). Root cause + fix below. This also shrank `module.js` **1.34 MB → 343 KB**.
  2. The **prepare-picker was empty** (read a field that's `null` in PF2e v8.2). Fixed to read your spellbook.
- **One thing I deliberately did NOT finish: learning brand‑new spells from the compendium** ("fill known lists" in the add‑new sense). The spellbook manages spells you already know (prepare/clear/remove/signature); adding new spells from the compendium is a sizable sub‑feature I chose not to rush blind. Details + recommendation below.

---

## What I built (Phase 3 → spells)

Plan: `docs/superpowers/plans/2026-06-12-phase-3-spells.md`.

- **Data layer** (`src/foundry/spells/`): pure, unit‑tested mappers (`view.ts`) + a guarded cast/mutation layer (`cast.ts`, `spellbook.ts`), all grounded in the PF2e v8.2 API and now **validated against live Ezren data**.
  - `buildSpellsView(actor)` — async, iterates `actor.spellcasting`, awaits each entry's `getSheetData()`.
  - `castSpell / castRitual / consumeActivation` — guarded like `rolls.ts`; cast posts the real card → existing chat feed.
  - `spellbook.ts` — `prepareSpell / unprepareSpell / toggleSignature / removeKnownSpell / setFocusPoints`.
- **UI** (`src/app/sheet/SpellsPanel.tsx` + `spells/`): segmented **Known / Rituals / Activations**; entry cards (tradition · DC · attack), per‑rank rows with action glyphs, slot/focus pills, **Cast** buttons; **SpellDetailModal** (rank, traits, cast/range/area/defense, enriched description); **SpellbookModal** (prepared → fill/clear slots from your book; spontaneous → remove / signature).
- **Wiring**: new `"spells"` sub‑tab in `store.ts` / `SubTabBar` / `CharacterSheet`; live refresh via `useSpells` hook.
- **Tests**: `spellsView`, `spellDetail`, `spellCast`, `spellbook` (Vitest). Total suite **85 green** (was 66).

---

## Live test results (your Foundry, Player1 → Ezren L1)

I logged in as **Player1** (no password) in a mobile‑sized viewport; the module activated mobile mode and mounted. Findings:

| Check | Result |
|---|---|
| App mounts in a production build | ✅ (after the build fix below) |
| Spells sub‑tab present & renders | ✅ Vitals/Skills/**Spells**/Items/Feats/Profs/Bio |
| Known Spells — entries | ✅ Arcane Focus (DC 17, +7, focus 0/1, Hand of the Apprentice) + Arcane Prepared (5 cantrips, 1st Rank 2/2: Breathe Fire, Force Barrage) |
| Action glyphs / slots / DC / attack | ✅ match live data; Force Barrage ("1 to 3") correctly shows no glyph |
| Section tabs (Known/Rituals/Activations) | ✅ (Ezren has no rituals → "No rituals"; the **Scroll of Grim Tendrils** is detected for Activations) |
| Spellbook (Prepare) modal | ✅ opens, lists all 7 prepared slots with Clear |
| **Cast** (Electric Arc cantrip) | ✅ posted a chat message (`game.messages` 12 → 13, item "Electric Arc") |
| Group‑label localization | ✅ (after the i18n fix) — "Cantrips" / "Focus Spells" |

API assumptions validated live: `actor.spellcasting` entry flags, `getSheetData()` shape (groups/active/uses/statistic), `entry.cast`, `collection.prepareSpell`, the consumable `consume()` path, and `spell.system` detail fields (e.g. area `{cone,15}`, `defense.save` basic reflex).

Screenshots (live, Ezren): `docs/reports/spells-known-ezren.png` (Spells tab), `docs/reports/spellbook-prepare-ezren.png` (spellbook).

---

## Bugs found & fixed during live testing

1. **Production build never mounted — `process is not defined`** (`fix(build)` commit `518fb8f`).
   Vite **library mode** (`build.lib`) doesn't replace `process.env.NODE_ENV`, but Foundry loads `module.js` directly in the browser, so bundled React threw `process is not defined` → cascaded to `Cannot access 'index' before initialization` in `mountApp` → empty app. This was **latent**: your normal dev‑server workflow defines it, so it only bites a built `dist/`. Fixed by adding a `define` for `process.env.NODE_ENV` (mode‑aware). Bonus: `module.js` **1.34 MB → 343 KB** (React production build).

2. **Empty prepare‑picker** (commit `ee6899a`).
   I'd sourced "available to prepare" from `getSheetData().prepList`, but that is **`null` in PF2e v8.2**. Now reads the entry's actual spellbook (`entry.spells.contents`), matched to each slot group by rank/cantrip. Verified Ezren's book has all 8 spells.

3. **Raw i18n keys** (same commit) — cantrip/focus group labels came through as `PF2E.*.CANTRIPS`; now localized via a small `loc()` helper.

---

## Known gaps / deferred (please read)

1. **Learning NEW spells from the compendium is NOT implemented.** The spellbook lets prepared casters fill/clear slots from spells they already know, and lets spontaneous casters **remove** known spells and toggle **signature** — but there's **no compendium browser to add a brand‑new spell** to a repertoire/spellbook. That's a real sub‑feature (load + filter ~1500 spells by tradition/rank, search, `collection.addSpell`) that I didn't want to build blind and ship untested overnight. **Recommendation:** decide whether you want a custom mobile spell picker, or to lean on the desktop for learning spells (the mobile app then manages/prepares them). I left a one‑line note to this effect in the spontaneous spellbook view.
2. **Focus "Refocus" control** — the focus pool displays and spends on cast, but there's no in‑app button to regain focus (a rest activity). Easy to add (`setFocusPoints` already exists).
3. **Heighten‑rank selector** — spells cast at their base/slot rank; no UI to choose a higher heighten rank for spontaneous slots yet.
4. **Staff activations** — consumable activations (scrolls/wands via `consume()`) work; staves (charge pools) aren't special‑cased.
5. **Apply‑damage from chat** — still deferred to **Phase 7** (battle map / token selection), per the Slice‑1 spike.

---

## Manual test checklist for you (morning)

> If the app shows a **blank screen**, you're on a stale build — run `npm run dev` (or rebuild: `npm run build`) and hard‑reload Foundry. The production `dist/` is freshly built and fixed, but your browser may have cached the old one.

On mobile (or emulated), as the player who owns a caster (Ezren works):

- [ ] **Sheet → Spells** tab shows Known Spells / Rituals / Activations.
- [ ] Entry header shows tradition · DC · attack; ranks show slot/focus pills; cantrips show ∞‑style (no pill).
- [ ] Tap a spell name → **detail popup** (rank, traits, cast/range/area/defense, description). Close it.
- [ ] **Cast a cantrip** (Electric Arc) → result card appears in the **Chat** tab + a toast. (Cantrips don't expend.)
- [ ] **Cast a prepared spell** (Breathe Fire) → posts to chat; its slot shows **expended** (dimmed); the rank pill drops (2/2 → 1/2).
- [ ] **Cast the focus spell** (Hand of the Apprentice) when focus > 0 → focus 1/1 → 0/1. (Refocus on desktop for now.)
- [ ] **Spellbook**: tap **Prepare** → tap **Clear** on a cantrip → that slot opens **"+ Prepare a spell…"** → the picker lists your cantrips → pick one to re‑prepare. (This exercises the bug I fixed.)
- [ ] **Activations**: with the Scroll of Grim Tendrils, the Activations tab shows it with a **Cast** button (consumes the scroll).
- [ ] Make a GM change on desktop (prepare/unprepare a spell) → the mobile Spells tab updates within ~1s.

---

## Commits (newest first)

```
ee6899a  prepare-picker reads the entry's spellbook + localize group labels
518fb8f  fix(build): define process.env.NODE_ENV so the library build runs in the browser
3b9bfeb  SpellbookModal — prepare slots / manage repertoire (Slice C UI)
3b5fd17  spellbook mutations + buildSpellbookView (Slice C logic)
894af88  Rituals + Activations sections (Slice B)
7134b9b  Spells sub-tab — Known section render + spell detail popup (A4+A5)
4259834  async buildSpellsView + live useSpells hook (A2)
4e1300b  guarded cast layer — castSpell/castRitual/consumeActivation (A3)
9cf1cd8  spell view types + mapSpellcastingEntry (A1)
46d2360  spells implementation plan
bd7fd10  docs: move strikes to Phase 4 (Actions tab); Phase 3 remaining = spells
```

## Notes

- A **02:00 "Continue"** job was scheduled per your request (session‑only, so it dies if the PC shuts down — which it will, since I'm shutting down when done).
- **Strikes** were moved to **Phase 4** (the Actions tab) earlier in the session — see the roadmap.
- The PC will be **shut down** after I commit this report and update the roadmap/memory. Good night!
