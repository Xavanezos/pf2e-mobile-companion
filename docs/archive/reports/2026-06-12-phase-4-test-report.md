# Phase 4 — Live Test Report (what to verify) — 2026-06-12

Everything below is committed to `main`, working tree clean. **155 tests green, `tsc --noEmit` clean, production `vite build` clean.** This session did two **live-bug fixes** (from your findings) and built **Slice B** (the rest of Phase 4). None of it is live-verified yet — that's this checklist.

## How to run

The dev server is already running at **http://localhost:30002/modules/pf2e-mobile-companion/** (Vite picked 30002; 30001 was busy). **Reload Foundry (F5)** before testing — `src/module.ts` changed (it now registers the attack-toggle dialog hook at startup), and that only takes effect on a fresh load, not via hot-reload.

Log in as **Player1** (no password), mobile-width viewport. Use **Valeros** (martial, for strikes/toggle) and ideally a **Barbarian or Swashbuckler** (for a real combat toggle like Rage/Panache).

---

## 🔴 CRITICAL — re-test the bug you found (highest risk)

### 1. Attack modifier toggle now applies to the *rolled* bonus — **with a target**
This is the bug you hit ("negative modifiers don't apply… double slice on Valeros") and the riskiest fix. **Root cause:** when a **target** is selected, PF2e re-derives the strike's modifiers on a *contextual actor clone*, so the old approach (mutating the live strike) was silently discarded at roll time — the preview dropped the modifier but the roll didn't. **New approach mirrors PF2e:** we now drive PF2e's own modifier dialog (headlessly) so the toggle lands on the *final* post-clone check.

**Test (Valeros, with an enemy token targeted):**
- [ ] **Target an enemy token**, open a strike → attack prompt → **uncheck a modifier** (a potency rune, or a penalty like the one from Double Slice / a condition).
- [ ] Tap **Roll** → the **posted attack card's bonus reflects the toggle** (unchecking a +1 lowers it by 1; unchecking a −2 penalty *raises* it by 2). **This is the exact thing that was broken — confirm it now changes the rolled number, not just the preview.**
- [ ] Repeat **without a target** (no token targeted) — should also work.
- [ ] Watch for a **dialog flash**: PF2e's modifier dialog is forced open then closed instantly/headlessly. It should be invisible (we hide it before closing). If you see it pop up briefly, note it — it's cosmetic, not broken.
- [ ] Reopen the strike afterward → checkboxes all checked again; a normal roll uses the full bonus (no lingering state).

> Note: the *preview total* shown in the modal is computed from the strike's own modifiers (pre-target). With a target that adds modifiers (e.g. off-guard from flanking), the **rolled** total can legitimately differ from the previewed total — the roll is the source of truth. Flag it only if the *toggle* doesn't take effect.

---

## 🟠 HIGH — the other fix + new Slice B features

### 2. Chat-card **Crit** now rolls critical damage (was rolling normal damage)
**Root cause:** the posted card's critical button is `data-outcome="critical-success"` (kebab-case); the code compared to camelCase `"criticalSuccess"`, so Crit always fell through to plain damage.
- [ ] Roll any strike attack → on the **posted attack card in Chat**, tap **Critical** → the damage prompt should say **"Roll Critical"** and roll **doubled/critical** damage (not normal). Tap **Damage** → normal damage. (Both the tab's Crit button and the chat card's Crit button.)

### 3. Actions list (new — the Actions segment)
- [ ] Switch to the **Actions** segment. Actions are grouped **Actions / Reactions / Free Actions / Exploration / Downtime**, each sorted by name, with the right **action glyph** and **img**.
- [ ] Feats that are actions appear; passive feats do **not**; passive **action items** appear under Free Actions (no glyph).
- [ ] Tap an action's **name** → the detail popup opens with its rules text.
- [ ] Tap **Use** → the action's card posts to **Chat**.
- [ ] For a **limited-use** action (has a `N/M` frequency pill, e.g. once-per-day): Use → the **pill drops by 1** and persists (reload — it stays). At 0 it still posts but doesn't go negative.

### 4. Toggles bar (new — pinned strip)
- [ ] On a Barbarian/Swashbuckler/etc., the **pinned strip** at the top shows combat toggles (**Rage / Panache / stance / Sneak Attack** …), always visible in both segments.
- [ ] Tap a toggle → it flips (checked ↔ unchecked) and **sticks**; then make a relevant roll and confirm it **affects the roll** (e.g. Rage adds damage; a stance changes options). The attack prompt's breakdown should reflect a toggled status bonus.
- [ ] An **always-active** toggle renders **checked + greyed/disabled** (can't be unchecked).
- [ ] If a class has **no** combat toggles, the strip is absent (no empty bar).

---

## 🟡 Regression sanity (should be unchanged)

- [ ] Strikes still roll (3 MAP buttons, Damage, Crit) and post cards; ranged ammo selector still works; aux actions (draw/sheathe) still work.
- [ ] No dialog hangs anywhere under either `showCheckDialogs` / `showDamageDialogs` setting.

---

## Known limitations / deferred (not bugs — out of scope or v1 cuts)

- **Toggle suboptions** (e.g. choosing a *specific* stance variant from a dropdown) — v1 toggles the base option only.
- **Action selfEffect / crafting** — actions that apply an effect to self or craft an item just post their card in v1 (frequency + `toMessage` are handled; the selfEffect/craft branches of PF2e's `createUseActionMessage` are deferred).
- **Kineticist** elemental-blast de-dup (blasts may appear in the actions list as well as among strikes).
- **Exploration** actions are listed flat (no active/other split).
- **Repeating/magazine** ranged weapons, **modular/versatile** damage-type selectors, **apply-damage to a token**, common-actions row, hotbar macros — all previously deferred (Phase 7 / later).

If anything in 🔴/🟠 misbehaves, tell me the symptom + which actor/feature and I'll re-ground against `E:/React Projects/pf2e` and fix. If it all passes, I'll flip Phase 4 from "pending" to "live-verified" in the memory + handoff.

---

## Commits this session (on `main`)

| Area | Commit | What |
|---|---|---|
| A.2b plan | `e9cab46` | attack modifier-toggle plan |
| A.2b | `5c3d45a` `3dbf027` `69be1e8` | preview + roll disabledSlugs + modal/tab (initial, live-buggy) |
| **Fix** | `55d3e9e` | chat-card Crit (kebab `critical-success`) |
| **Fix** | `73f11a6` | attack toggle applies post-clone (dialog hook) |
| Slice B plan | `a29be2e` | actions list + toggles plan |
| Slice B | `Phase 4 (Task 1..4)` | actions mapper, toggles mapper + setToggle, useAction, UI + wiring |
