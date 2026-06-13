# Chat-roll long-press menu — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Long-press a chat message in the Chat feed to open a bottom-sheet of the native PF2e message actions (Reroll Keep New/Higher/Lower, Hero Point, Mythic Point, Delete), each calling PF2e's own methods.

**Architecture:** A pure mapper (`messageActions`) turns a small live snapshot into the applicable action list (mirroring PF2e's `_getEntryContextOptions` visible-gates); a thin guarded glue (`messageActionsRun`) reads the live `ChatMessage` and runs `game.pf2e.Check.rerollFromMessage` / `message.delete()`; a React bottom-sheet (`ChatMessageActionsModal`) renders the buttons, with Delete routed through an in-sheet confirm. Long-press is wired with the existing `useLongPress` hook on the `ChatCard` wrapper, exactly like the shipped `EffectChip` → `EffectActionsModal` pattern.

**Tech Stack:** React 18 + TypeScript, Zustand, Tailwind v4 (preflight disabled), Vitest. Live API: PF2e v8.2 / Foundry v14 (`game.pf2e.Check`, `ChatMessage`).

**Spec:** `docs/superpowers/specs/2026-06-12-chat-roll-context-menu-design.md`

---

## File Structure

| File | Responsibility | Tested |
|---|---|---|
| `src/foundry/chat/messageActions.ts` (new) | Pure: `messageActions(source) → ChatMessageAction[]`; the `ChatMessageActionKind` / `ChatMessageAction` / `ChatMessageActionSource` types; label+icon table (labels via `loc()`) | ✅ unit |
| `src/foundry/chat/messageActionsRun.ts` (new) | Live glue: `readMessageActionSource(messageId)` (snapshot, familiar→master) + `runMessageAction(messageId, kind)` (guarded reroll/delete) | live only |
| `src/app/chat/ChatMessageActionsModal.tsx` (new) | Bottom-sheet of action buttons; Delete → in-sheet confirm | live only |
| `src/app/chat/ChatCard.tsx` (modify) | Add `onLongPress?` prop; spread `useLongPress` + touch styles on the wrapper | live only |
| `src/app/tabs/ChatTab.tsx` (modify) | Hold the actions-sheet target; gate on non-empty actions; render the modal | live only |
| `tests/messageActions.test.ts` (new) | Truth-table for the pure mapper | — |

Conventions followed: pure logic in `src/foundry/**` with a Vitest spec in `tests/` (like `cardInteractions`); DOM/Foundry glue guarded like `src/foundry/spells/chatActions.ts`; popups reuse `src/app/sheet/parts/Modal.tsx` like `EffectActionsModal`; `game`/`ui` are ambient globals (not imported). Tailwind v4 has preflight **disabled**, so action buttons use `bg-*` + `ring-1` (not `border`) and `justify-start` (flex buttons center otherwise) — see the `styling-gotchas` memory.

---

### Task 1: Pure mapper `messageActions` + types (TDD)

**Files:**
- Create: `src/foundry/chat/messageActions.ts`
- Test: `tests/messageActions.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/messageActions.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { messageActions, type ChatMessageActionSource } from "../src/foundry/chat/messageActions";

const base: ChatMessageActionSource = { isRerollable: false, canDelete: false, heroPoints: null, mythicPoints: null };
const kinds = (src: ChatMessageActionSource) => messageActions(src).map((a) => a.kind);

describe("messageActions", () => {
  it("rerollable character with a hero point (no mythic): reroll family + hero-point + delete, no mythic", () => {
    expect(kinds({ isRerollable: true, canDelete: true, heroPoints: 1, mythicPoints: 0 }))
      .toEqual(["reroll-new", "reroll-higher", "reroll-lower", "hero-point", "delete"]);
  });

  it("rerollable with mythic but no hero points: includes mythic-point, omits hero-point", () => {
    expect(kinds({ isRerollable: true, canDelete: true, heroPoints: 0, mythicPoints: 2 }))
      .toEqual(["reroll-new", "reroll-higher", "reroll-lower", "mythic-point", "delete"]);
  });

  it("not rerollable but author: delete only", () => {
    expect(kinds({ ...base, canDelete: true })).toEqual(["delete"]);
  });

  it("not rerollable, not author: no actions (long-press opens nothing)", () => {
    expect(messageActions(base)).toEqual([]);
  });

  it("rerollable but null resource counts (non-character actor): reroll family only, no hero/mythic", () => {
    expect(kinds({ isRerollable: true, canDelete: false, heroPoints: null, mythicPoints: null }))
      .toEqual(["reroll-new", "reroll-higher", "reroll-lower"]);
  });

  it("each action carries an fa-* icon and a non-empty label; only delete is destructive", () => {
    const acts = messageActions({ isRerollable: true, canDelete: true, heroPoints: 1, mythicPoints: 1 });
    for (const a of acts) {
      expect(a.icon).toMatch(/^fa-/);
      expect(a.label.length).toBeGreaterThan(0);
    }
    expect(acts.find((a) => a.kind === "delete")?.destructive).toBe(true);
    expect(acts.find((a) => a.kind === "reroll-new")?.destructive).toBeFalsy();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/messageActions.test.ts`
Expected: FAIL — cannot resolve `../src/foundry/chat/messageActions` (module not yet created).

- [ ] **Step 3: Write the minimal implementation**

Create `src/foundry/chat/messageActions.ts`:

```ts
import { loc } from "../i18n";

/** One native PF2e message action. `kind` drives both the icon/label here and the
 *  live call in messageActionsRun.ts. */
export type ChatMessageActionKind =
  | "reroll-new"
  | "reroll-higher"
  | "reroll-lower"
  | "hero-point"
  | "mythic-point"
  | "delete";

export interface ChatMessageAction {
  kind: ChatMessageActionKind;
  label: string;
  icon: string;
  /** Delete is destructive — the sheet routes it through a confirm step. */
  destructive?: boolean;
}

/** The reduced snapshot the pure mapper decides from. The live glue
 *  (messageActionsRun.ts) builds this from the real ChatMessage, resolving
 *  familiar→master for the resource counts. */
export interface ChatMessageActionSource {
  /** message.isRerollable — owns the actor, authored/owns the message, and
   *  rolls[0] is a not-yet-rerolled CheckRoll (a 1d20 check). */
  isRerollable: boolean;
  /** message.isAuthor || game.user.isGM */
  canDelete: boolean;
  /** Rerolling character's hero points; null when the actor isn't a character. */
  heroPoints: number | null;
  /** Rerolling character's mythic points; null when the actor isn't a character. */
  mythicPoints: number | null;
}

/** Pure: the native PF2e actions applicable to a chat message, in sheet order.
 *  Mirrors chat-log.ts `_getEntryContextOptions` visible-gates. Returns [] when
 *  nothing applies (the long-press then opens no sheet). */
export function messageActions(src: ChatMessageActionSource): ChatMessageAction[] {
  const actions: ChatMessageAction[] = [];
  if (src.isRerollable) {
    actions.push(
      { kind: "reroll-new", label: loc("PF2E.RerollMenu.KeepNew"), icon: "fa-dice" },
      { kind: "reroll-higher", label: loc("PF2E.RerollMenu.KeepHigher"), icon: "fa-dice-six" },
      { kind: "reroll-lower", label: loc("PF2E.RerollMenu.KeepLower"), icon: "fa-dice-one" },
    );
    if ((src.heroPoints ?? 0) > 0) {
      actions.push({ kind: "hero-point", label: loc("PF2E.RerollMenu.HeroPoint"), icon: "fa-circle-h" });
    }
    if ((src.mythicPoints ?? 0) > 0) {
      actions.push({ kind: "mythic-point", label: loc("PF2E.RerollMenu.MythicPoint"), icon: "fa-circle-m" });
    }
  }
  if (src.canDelete) {
    actions.push({ kind: "delete", label: "Delete message", icon: "fa-trash", destructive: true });
  }
  return actions;
}
```

Note: in the Vitest env `game` is undeclared, so `loc()`'s try/catch returns the raw key — the test asserts kinds/icons/non-empty labels, not localized text, so it passes regardless.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/messageActions.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/foundry/chat/messageActions.ts tests/messageActions.test.ts
git commit -m "feat(chat): pure mapper for native message actions (rerolls/hero/mythic/delete)"
```

---

### Task 2: Live glue `messageActionsRun` (snapshot + guarded runner)

**Files:**
- Create: `src/foundry/chat/messageActionsRun.ts`

No unit test — this is DOM/Foundry glue, like `render.ts` and `chatActions.ts`. Verified by typecheck/build here and the live checklist in Task 5.

- [ ] **Step 1: Write the implementation**

Create `src/foundry/chat/messageActionsRun.ts`:

```ts
import type { ChatMessageActionKind, ChatMessageActionSource } from "./messageActions";

/** Build the pure mapper's snapshot from the live ChatMessage. Resolves
 *  familiar→master for the resource counts, mirroring chat-log.ts:466-479.
 *  DOM/Foundry glue — untested. Returns null if the message is gone. */
export function readMessageActionSource(messageId: string): ChatMessageActionSource | null {
  const msg = (game as any)?.messages?.get(messageId);
  if (!msg) return null;
  const actor = msg.actor;
  const rerolling = actor?.isOfType?.("familiar") ? actor.master : actor;
  const isCharacter = !!rerolling?.isOfType?.("character");
  return {
    isRerollable: !!msg.isRerollable,
    canDelete: !!msg.isAuthor || !!(game as any)?.user?.isGM,
    heroPoints: isCharacter ? (rerolling.heroPoints?.value ?? 0) : null,
    mythicPoints: isCharacter ? (rerolling.system?.resources?.mythicPoints?.value ?? 0) : null,
  };
}

/** Guarded like chatActions.ts: a rejected call surfaces via Foundry's toast and
 *  never throws into React. */
async function guard(run: () => Promise<unknown>): Promise<void> {
  try {
    await run();
  } catch (err) {
    console.error("[pf2e-mobile] chat message action failed", err);
    (ui as any)?.notifications?.error?.("Message action failed — see console.");
  }
}

/** Run a native PF2e message action via PF2e's own methods. PF2e owns the rules
 *  (reroll math, resource spend, degree of success); we only trigger it. */
export function runMessageAction(messageId: string, kind: ChatMessageActionKind): Promise<void> {
  return guard(async () => {
    const msg = (game as any)?.messages?.get(messageId);
    if (!msg) throw new Error(`no message ${messageId}`);
    if (kind === "delete") return msg.delete();
    const Check = (game as any)?.pf2e?.Check;
    if (!Check?.rerollFromMessage) throw new Error("game.pf2e.Check unavailable");
    switch (kind) {
      case "reroll-new": return Check.rerollFromMessage(msg);
      case "reroll-higher": return Check.rerollFromMessage(msg, { keep: "higher" });
      case "reroll-lower": return Check.rerollFromMessage(msg, { keep: "lower" });
      case "hero-point": return Check.rerollFromMessage(msg, { resource: "hero-points" });
      case "mythic-point": return Check.rerollFromMessage(msg, { resource: "mythic-points" });
    }
  });
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors. (The `async` guard callback returns `Promise<unknown>` in every branch, so the implicit fall-through return typechecks.)

- [ ] **Step 3: Commit**

```bash
git add src/foundry/chat/messageActionsRun.ts
git commit -m "feat(chat): live glue to read + run native message actions"
```

---

### Task 3: `ChatMessageActionsModal` bottom-sheet

**Files:**
- Create: `src/app/chat/ChatMessageActionsModal.tsx`

No unit test — React/DOM popup, like `EffectActionsModal`. The `actions` are computed by `ChatTab` (Task 4) and passed in, so this component only renders + runs.

- [ ] **Step 1: Write the component**

Create `src/app/chat/ChatMessageActionsModal.tsx`:

```tsx
import { useState } from "react";
import { Modal } from "../sheet/parts/Modal";
import { runMessageAction } from "../../foundry/chat/messageActionsRun";
import type { ChatMessageAction } from "../../foundry/chat/messageActions";

/** Bottom-sheet of native PF2e actions for one chat message, opened by long-press
 *  (mirrors EffectActionsModal). Reroll/hero/mythic run on one tap; Delete swaps
 *  the sheet to an in-place confirm. `actions` is precomputed by ChatTab. */
export function ChatMessageActionsModal({ messageId, title, actions, onClose }: {
  messageId: string;
  title: string;
  actions: ChatMessageAction[];
  onClose: () => void;
}) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const run = (a: ChatMessageAction) => {
    if (a.kind === "delete") { setConfirmingDelete(true); return; }
    void runMessageAction(messageId, a.kind);
    onClose();
  };

  return (
    <Modal title={title} onClose={onClose}>
      {confirmingDelete ? (
        <div className="flex flex-col gap-3">
          <div className="text-sm text-zinc-300">Delete this message?</div>
          <div className="flex gap-2">
            <button
              onClick={() => { void runMessageAction(messageId, "delete"); onClose(); }}
              className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-md bg-red-900/70 px-3 text-sm font-semibold text-red-100"
            >
              <i className="fas fa-trash" aria-hidden="true" />
              Delete
            </button>
            <button
              onClick={() => setConfirmingDelete(false)}
              className="flex min-h-11 flex-1 items-center justify-center rounded-md bg-zinc-800 px-3 text-sm font-semibold text-zinc-200 ring-1 ring-zinc-700"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {actions.map((a) => (
            <button
              key={a.kind}
              onClick={() => run(a)}
              className={
                "flex min-h-11 w-full items-center justify-start gap-3 rounded-md px-3 text-sm font-semibold " +
                (a.destructive
                  ? "bg-red-900/70 text-red-100"
                  : "bg-zinc-800 text-zinc-200 ring-1 ring-zinc-700")
              }
            >
              <i className={`fas ${a.icon} w-5 text-center`} aria-hidden="true" />
              {a.label}
            </button>
          ))}
        </div>
      )}
    </Modal>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/chat/ChatMessageActionsModal.tsx
git commit -m "feat(chat): bottom-sheet for message actions with delete confirm"
```

---

### Task 4: Wire long-press into `ChatCard` + `ChatTab`

**Files:**
- Modify: `src/app/chat/ChatCard.tsx`
- Modify: `src/app/tabs/ChatTab.tsx`

- [ ] **Step 1: Add the long-press prop + handlers to `ChatCard`**

In `src/app/chat/ChatCard.tsx`:

Add the import after the existing imports (below the `ChatView` type import on line 4):

```tsx
import { useLongPress } from "../sheet/parts/useLongPress";
```

Change the component signature + props (lines 10) from:

```tsx
export function ChatCard({ summary, onInteract }: { summary: ChatView; onInteract?: (i: CardInteraction) => void }) {
  const ref = useRef<HTMLDivElement>(null);
```

to:

```tsx
export function ChatCard({ summary, onInteract, onLongPress }: {
  summary: ChatView;
  onInteract?: (i: CardInteraction) => void;
  onLongPress?: (messageId: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const press = useLongPress(() => onLongPress?.(summary.id));
```

Change the returned element (line 37) from:

```tsx
  return <div ref={ref} className="pf2e-chat-card" />;
```

to:

```tsx
  return (
    <div
      ref={ref}
      {...press}
      className="pf2e-chat-card select-none"
      style={{ touchAction: "manipulation", WebkitTouchCallout: "none" }}
    />
  );
```

(The `select-none` + `touchAction`/`WebkitTouchCallout` mirror the shipped `EffectChip` so a held press doesn't select text or pop the iOS callout. The existing capture-phase `click` listener in the `useEffect` is untouched and still intercepts the damage/save buttons — long-press uses pointer events, so the two coexist. Vertical scrolling still works: `useLongPress` cancels on a >10px move.)

- [ ] **Step 2: Hold the sheet target + render the modal in `ChatTab`**

In `src/app/tabs/ChatTab.tsx`:

Add imports after the existing `CardInteraction` type import (line 11):

```tsx
import { ChatMessageActionsModal } from "../chat/ChatMessageActionsModal";
import { messageActions, type ChatMessageAction } from "../../foundry/chat/messageActions";
import { readMessageActionSource } from "../../foundry/chat/messageActionsRun";
```

Add state right after the existing `popup` state (line 18, `const [popup, setPopup] = useState<CardInteraction | null>(null);`):

```tsx
  const [actionsTarget, setActionsTarget] = useState<{ id: string; title: string; actions: ChatMessageAction[] } | null>(null);
```

Add the open handler right after the existing `const close = () => setPopup(null);` (line 56). Note `close` only clears the interaction popup, so give the sheet its own closer:

```tsx
  const openActions = (id: string) => {
    const src = readMessageActionSource(id);
    const acts = src ? messageActions(src) : [];
    if (!acts.length) return; // nothing applicable → don't open an empty sheet
    const title = messages.find((m) => m.id === id)?.title ?? "Message";
    setActionsTarget({ id, title, actions: acts });
  };
```

Pass `onLongPress` to each card — change line 59 from:

```tsx
      {messages.map((m) => <ChatCard key={m.id} summary={m} onInteract={setPopup} />)}
```

to:

```tsx
      {messages.map((m) => <ChatCard key={m.id} summary={m} onInteract={setPopup} onLongPress={openActions} />)}
```

Render the modal — add this just before the closing `</div>` of the list (after the existing `strike-damage` popup block, around line 76, before line 77 `</div>`):

```tsx
      {actionsTarget && (
        <ChatMessageActionsModal
          messageId={actionsTarget.id}
          title={actionsTarget.title}
          actions={actionsTarget.actions}
          onClose={() => setActionsTarget(null)}
        />
      )}
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: build succeeds (no type or bundling errors).

- [ ] **Step 5: Run the full test suite**

Run: `npm test`
Expected: all tests pass (the prior green count + the 6 new `messageActions` tests).

- [ ] **Step 6: Commit**

```bash
git add src/app/chat/ChatCard.tsx src/app/tabs/ChatTab.tsx
git commit -m "feat(chat): long-press a chat message to open the native actions sheet"
```

---

### Task 5: Final verification + manual live checklist

**Files:** none (verification only).

- [ ] **Step 1: Green suite + build**

Run: `npm test` then `npm run build`
Expected: all tests pass; build succeeds.

- [ ] **Step 2: Manual live checklist** (run `npm run dev`, log in as **Player1**, mobile-width viewport, **Ezren** as the owning character)

  - [ ] Long-press a skill/save/attack **d20** roll you made → sheet shows Keep New / Keep Higher / Keep Lower + **Hero Point** (Ezren has a hero point) + **Delete message**.
  - [ ] Tap **Hero Point** → PF2e rerolls, spends the point, posts the reroll result; sheet closes.
  - [ ] Tap **Keep Higher**, then on another roll **Keep New** → the reroll posts correctly each time.
  - [ ] **Mythic Point** is absent when the character has none (Ezren) — confirm it does not appear.
  - [ ] Long-press → **Delete message** → the confirm step appears → **Delete** removes the message from the feed. Re-open and use **Cancel** → returns to the action list, nothing deleted.
  - [ ] Long-press a **non-roll** message you authored (type something in chat) → only **Delete message** shows.
  - [ ] Long-press **someone else's** non-rerollable message → nothing opens.
  - [ ] Drag-scroll the feed starting on a card → the sheet does **not** open, and the browser's native long-press callout never appears.
  - [ ] Tap a cast card's **Roll Damage** / **Save** button → the existing popup still opens (long-press wiring didn't break the tap path).
  - [ ] Sanity: after a long-press opens the sheet, it **stays open** (does not instantly close from a stray release-click). If it ever closes immediately, mirror `EffectActionsModal`'s behavior is already in place — re-check that `touchAction: "manipulation"` and `select-none` are on the wrapper.

- [ ] **Step 3: Update progress memory**

Append a short note to the project memory (new `phase-*`/feature memory + a one-line pointer in `MEMORY.md`) recording: chat-roll long-press actions sheet shipped (full native parity minus token-bound apply-damage / GM show-details), tests green, live-only paths = the actual reroll/delete mutations (verified as Player1 on Ezren).

---

## Self-Review

**Spec coverage:**
- Full native parity (reroll new/higher/lower, hero, mythic, delete) with PF2e visible-gates → Task 1 (`messageActions`) + Task 2 (`runMessageAction` calls). ✓
- Delete confirm step → Task 3 (`confirmingDelete`). ✓
- Long-press trigger reusing `useLongPress` + `Modal`, coexisting with the capture-click tap path, scroll-cancel, native-callout suppression → Task 4 (ChatCard styles + handlers). ✓
- Only-open-when-actions-apply → Task 4 `openActions` gate. ✓
- Pure mapper unit-tested; glue/modal/long-press live-only → Tasks 1 (tests) + 5 (manual). ✓
- Familiar→master resource resolution → Task 2 `readMessageActionSource`. ✓
- Out of scope (apply-damage, GM show-details) → not implemented, as specified. ✓

**Placeholder scan:** No TBD/TODO; every code step shows complete code; every command has expected output. ✓

**Type consistency:** `ChatMessageActionKind` / `ChatMessageAction` / `ChatMessageActionSource` defined in Task 1 and imported unchanged in Tasks 2–4. `messageActions(src)`, `readMessageActionSource(id)`, `runMessageAction(id, kind)` signatures match across tasks. `ChatMessageActionsModal` props (`messageId`, `title`, `actions`, `onClose`) match the render site in Task 4. `onLongPress?(messageId: string)` matches `openActions(id: string)`. ✓
```
