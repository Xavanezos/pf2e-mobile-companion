# Phase 3 Slice 1 — Checks + Chat Feed — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a player roll skill/save/perception checks from the phone and see every PF2e result in a Chat tab (plus a cross-tab toast for their own rolls).

**Architecture:** Rolls call live PF2e `Statistic.roll({ skipDialog: true })` through a guarded `rolls.ts` (same contract as `mutations.ts`). Results arrive via the `createChatMessage` hook → a pure `buildChatView` summary → a Zustand `chatStore`. The Chat tab renders each message's real card via `message.renderHTML()` inserted as a live element; a toast peeks the player's own results over any tab. The roll trigger reuses Phase 2.1's `BreakdownModal` `onRoll` seam — the roll target rides on the `BreakdownRequest` the panels build, so no view-type changes are needed.

**Tech Stack:** React 18, Zustand, TypeScript, Vitest, Tailwind v4 (no preflight). Foundry v14 / PF2e v8.2 live API. PF2e source reference: `E:/React Projects/pf2e`.

---

## File Structure

**Create**
- `src/foundry/chat/types.ts` — `ChatMessageLike` (source), `ChatView` (summary), `Outcome`, `ChatContext`.
- `src/foundry/chat/view.ts` — pure `buildChatView` + `stripHtml`.
- `src/foundry/chat/render.ts` — `renderMessageElement(id)` (live card + listener hook). DOM glue.
- `src/foundry/actor/rolls.ts` — `rollSkill/rollSave/rollPerception`, `RollTarget`, `rollTarget` dispatch.
- `src/app/chatStore.ts` — Zustand: messages (capped), toast, seed/push/remove/dismiss.
- `src/app/chat/ChatCard.tsx` — mounts one live card element via ref.
- `src/app/chat/ChatToast.tsx` — cross-tab own-result toast.
- `src/app/chat/useChatFeed.ts` — seed from history + subscribe to chat hooks.
- `src/app/tabs/ChatTab.tsx` — full history list.
- Tests: `tests/chatView.test.ts`, `tests/chatStore.test.ts`, `tests/rolls.test.ts`.

**Modify**
- `src/app/store.ts` — add `"chat"` to `TabId`.
- `src/app/TabBar.tsx` — add the Chat tab entry.
- `src/app/TabContent.tsx` — route `chat` → `<ChatTab />`.
- `src/app/Shell.tsx` — mount `useChatFeed()` + `<ChatToast />`.
- `src/app/sheet/BreakdownModal.tsx` — add `roll?: RollTarget` to `BreakdownRequest`.
- `src/app/sheet/CharacterSheet.tsx` — pass `onRoll` to `BreakdownModal` from `req.roll`.
- `src/app/sheet/SkillsPanel.tsx` — skills always tappable + carry a skill roll target.
- `src/app/sheet/VitalsPanel.tsx` — saves/perception always tappable + roll targets (AC/class DC stay display-only).
- `src/styles/tailwind.css` — `.pf2e-chat-card` styling for the injected PF2e markup.
- `pf2e-mobile-companion-plan.md` — mark Slice 1 progress under Phase 3.

---

## Task 1: Chat view mapper (pure)

**Files:**
- Create: `src/foundry/chat/types.ts`, `src/foundry/chat/view.ts`
- Test: `tests/chatView.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/chatView.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildChatView, stripHtml } from "../src/foundry/chat/view";
import type { ChatMessageLike } from "../src/foundry/chat/types";

const ctx = { selfUserId: "user1", activeActorId: "actor1" };

describe("stripHtml", () => {
  it("strips tags, decodes entities, collapses whitespace", () => {
    expect(stripHtml("<p>Reflex&nbsp;Save</p>\n  <span>x</span>")).toBe("Reflex Save x");
  });
});

describe("buildChatView", () => {
  it("summarises a roll: title from flavor, outcome label, total, isRoll, isOwn", () => {
    const msg: ChatMessageLike = {
      id: "m1", author: { id: "user1" }, speaker: { actor: "actor1" },
      flavor: "<h4>Reflex</h4>", rolls: [{ total: 24 }],
      flags: { pf2e: { context: { outcome: "success" } } },
    };
    expect(buildChatView(msg, ctx)).toEqual({
      id: "m1", title: "Reflex", outcome: "success", outcomeLabel: "Success",
      total: 24, isRoll: true, isOwn: true,
    });
  });

  it("isOwn is true when authored by me even if another actor speaks", () => {
    const msg: ChatMessageLike = { id: "m2", author: { id: "user1" }, speaker: { actor: "other" }, rolls: [] };
    expect(buildChatView(msg, ctx).isOwn).toBe(true);
  });

  it("isOwn is true when my active actor speaks even if the GM authored it", () => {
    const msg: ChatMessageLike = { id: "m3", author: { id: "gm" }, speaker: { actor: "actor1" } };
    expect(buildChatView(msg, ctx).isOwn).toBe(true);
  });

  it("isOwn is false for another user's message about another actor", () => {
    const msg: ChatMessageLike = { id: "m4", author: { id: "gm" }, speaker: { actor: "other" } };
    expect(buildChatView(msg, ctx).isOwn).toBe(false);
  });

  it("falls back to the legacy `user` field and a generic title for non-rolls", () => {
    const msg: ChatMessageLike = { id: "m5", user: { id: "user1" }, flavor: "" };
    const v = buildChatView(msg, ctx);
    expect(v.isOwn).toBe(true);
    expect(v.title).toBe("Message");
    expect(v.isRoll).toBe(false);
    expect(v.total).toBeNull();
    expect(v.outcomeLabel).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/chatView.test.ts`
Expected: FAIL — cannot resolve `../src/foundry/chat/view`.

- [ ] **Step 3: Create the types**

Create `src/foundry/chat/types.ts`:

```ts
// Type contract for the chat feed: the summary the toast/list render, plus the
// structural shape of the live ChatMessage the mapper reads.

/** Degree of success on a PF2e check, from `flags.pf2e.context.outcome`. */
export type Outcome = "criticalSuccess" | "success" | "failure" | "criticalFailure";

/** What `buildChatView` needs from the client to decide `isOwn`. */
export interface ChatContext { selfUserId: string | null; activeActorId: string | null; }

/** Compact summary the toast + list render. The live card itself is rendered
 *  separately from the Document via `renderHTML` (see render.ts). */
export interface ChatView {
  id: string;
  title: string;
  outcome: Outcome | null;
  outcomeLabel: string | null;
  total: number | null;
  isRoll: boolean;
  /** Authored by me, or spoken by my active actor → eligible for the toast. */
  isOwn: boolean;
}

// ---------- Source (the live ChatMessage, structurally) ----------
// The real ChatMessagePF2e satisfies this via `msg as unknown as ChatMessageLike`.

export interface ChatMessageLike {
  id: string;
  author?: { id: string } | null;   // Foundry v13+
  user?: { id: string } | null;     // legacy fallback
  speaker?: { actor?: string | null } | null;
  flavor?: string;
  rolls?: { total?: number }[];
  flags?: { pf2e?: { context?: { outcome?: Outcome | null } } };
}
```

- [ ] **Step 4: Implement the mapper**

Create `src/foundry/chat/view.ts`:

```ts
import type { ChatContext, ChatMessageLike, ChatView, Outcome } from "./types";

const OUTCOME_LABELS: Record<Outcome, string> = {
  criticalSuccess: "Critical Success",
  success: "Success",
  failure: "Failure",
  criticalFailure: "Critical Failure",
};

const ENTITIES: Record<string, string> = {
  "&nbsp;": " ", "&amp;": "&", "&lt;": "<", "&gt;": ">", "&#39;": "'", "&quot;": '"',
};

/** Strip tags + decode a few entities + collapse whitespace for a one-line
 *  summary. Pure — never touches the DOM. */
export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;|&amp;|&lt;|&gt;|&#39;|&quot;/g, (m) => ENTITIES[m] ?? " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function buildChatView(msg: ChatMessageLike, ctx: ChatContext): ChatView {
  const outcome = msg.flags?.pf2e?.context?.outcome ?? null;
  const isRoll = (msg.rolls?.length ?? 0) > 0;
  const total = isRoll ? msg.rolls?.[0]?.total ?? null : null;
  const title = stripHtml(msg.flavor ?? "") || (isRoll ? "Roll" : "Message");
  const authorId = msg.author?.id ?? msg.user?.id ?? null;
  const authoredBySelf = !!ctx.selfUserId && authorId === ctx.selfUserId;
  const speakerActor = msg.speaker?.actor ?? null;
  const spokenByActive = !!ctx.activeActorId && speakerActor === ctx.activeActorId;
  return {
    id: msg.id,
    title,
    outcome,
    outcomeLabel: outcome ? OUTCOME_LABELS[outcome] : null,
    total,
    isRoll,
    isOwn: authoredBySelf || spokenByActive,
  };
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run tests/chatView.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
git add src/foundry/chat/types.ts src/foundry/chat/view.ts tests/chatView.test.ts
git commit -m "Phase 3 (Slice 1): chat view types + buildChatView mapper" \
  -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Chat store

**Files:**
- Create: `src/app/chatStore.ts`
- Test: `tests/chatStore.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/chatStore.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { useChatStore } from "../src/app/chatStore";
import type { ChatView } from "../src/foundry/chat/types";

const view = (id: string, isOwn = false): ChatView => ({
  id, title: id, outcome: null, outcomeLabel: null, total: null, isRoll: true, isOwn,
});

describe("useChatStore", () => {
  beforeEach(() => useChatStore.setState({ messages: [], toast: null }));

  it("seeds messages, keeping only the last 50", () => {
    useChatStore.getState().seed(Array.from({ length: 60 }, (_, i) => view(`m${i}`)));
    const { messages } = useChatStore.getState();
    expect(messages).toHaveLength(50);
    expect(messages[0].id).toBe("m10");
    expect(messages[49].id).toBe("m59");
  });

  it("pushes a message and dedupes by id (keeps newest position)", () => {
    useChatStore.getState().push(view("a"));
    useChatStore.getState().push(view("b"));
    useChatStore.getState().push(view("a"));
    expect(useChatStore.getState().messages.map((m) => m.id)).toEqual(["b", "a"]);
  });

  it("sets the toast only for own messages", () => {
    useChatStore.getState().push(view("x", false));
    expect(useChatStore.getState().toast).toBeNull();
    useChatStore.getState().push(view("y", true));
    expect(useChatStore.getState().toast?.id).toBe("y");
  });

  it("removing the toasted message clears the toast and the history entry", () => {
    useChatStore.getState().push(view("z", true));
    useChatStore.getState().remove("z");
    expect(useChatStore.getState().messages).toHaveLength(0);
    expect(useChatStore.getState().toast).toBeNull();
  });

  it("dismissToast clears the toast but keeps history", () => {
    useChatStore.getState().push(view("k", true));
    useChatStore.getState().dismissToast();
    expect(useChatStore.getState().toast).toBeNull();
    expect(useChatStore.getState().messages).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/chatStore.test.ts`
Expected: FAIL — cannot resolve `../src/app/chatStore`.

- [ ] **Step 3: Implement the store**

Create `src/app/chatStore.ts`:

```ts
import { create } from "zustand";
import type { ChatView } from "../foundry/chat/types";

const CAP = 50;

export interface ChatStoreState {
  messages: ChatView[];
  /** Newest own message not yet dismissed — drives the toast. */
  toast: ChatView | null;
  seed: (messages: ChatView[]) => void;
  push: (message: ChatView) => void;
  remove: (id: string) => void;
  dismissToast: () => void;
}

/** Mirrors the visible chat log for the UI; ChatMessage Documents stay the
 *  source of truth (the live card is re-rendered from them on demand). */
export const useChatStore = create<ChatStoreState>((set) => ({
  messages: [],
  toast: null,
  seed: (messages) => set({ messages: messages.slice(-CAP) }),
  push: (message) =>
    set((s) => ({
      messages: [...s.messages.filter((m) => m.id !== message.id), message].slice(-CAP),
      toast: message.isOwn ? message : s.toast,
    })),
  remove: (id) =>
    set((s) => ({
      messages: s.messages.filter((m) => m.id !== id),
      toast: s.toast?.id === id ? null : s.toast,
    })),
  dismissToast: () => set({ toast: null }),
}));
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/chatStore.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/app/chatStore.ts tests/chatStore.test.ts
git commit -m "Phase 3 (Slice 1): chatStore (capped history + own-result toast)" \
  -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Roll functions (live PF2e statistic rolls)

**Files:**
- Create: `src/foundry/actor/rolls.ts`
- Test: `tests/rolls.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/rolls.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { rollSkill, rollSave, rollPerception, rollTarget } from "../src/foundry/actor/rolls";

interface Call { stat: string; args: unknown; }

function stub(): Call[] {
  const calls: Call[] = [];
  const make = (stat: string) => ({ roll: (args: unknown) => { calls.push({ stat, args }); return Promise.resolve(); } });
  const actor = {
    skills: { athletics: make("skill:athletics") },
    saves: { reflex: make("save:reflex") },
    perception: make("perception"),
  };
  (globalThis as { game?: unknown }).game = { actors: { get: () => actor } };
  (globalThis as { ui?: unknown }).ui = { notifications: { error: () => {} } };
  return calls;
}

describe("rolls", () => {
  let calls: Call[];
  beforeEach(() => { calls = stub(); });

  it("rolls a skill with the dialog skipped", async () => {
    await rollSkill("a", "athletics");
    expect(calls).toEqual([{ stat: "skill:athletics", args: { skipDialog: true } }]);
  });

  it("rolls a save and perception", async () => {
    await rollSave("a", "reflex");
    await rollPerception("a");
    expect(calls.map((c) => c.stat)).toEqual(["save:reflex", "perception"]);
  });

  it("dispatches by RollTarget kind", async () => {
    await rollTarget("a", { kind: "skill", slug: "athletics" });
    await rollTarget("a", { kind: "save", slug: "reflex" });
    await rollTarget("a", { kind: "perception" });
    expect(calls.map((c) => c.stat)).toEqual(["skill:athletics", "save:reflex", "perception"]);
  });

  it("never throws when the roll rejects", async () => {
    (globalThis as { game?: unknown }).game = {
      actors: { get: () => ({ skills: { athletics: { roll: () => Promise.reject(new Error("boom")) } } }) },
    };
    await expect(rollSkill("a", "athletics")).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/rolls.test.ts`
Expected: FAIL — cannot resolve `../src/foundry/actor/rolls`.

- [ ] **Step 3: Implement the roll functions**

Create `src/foundry/actor/rolls.ts`:

```ts
/** Live PF2e statistic rolls. Thin glue over the system API, guarded so a
 *  rejected roll surfaces via Foundry's toast and never throws into React —
 *  same contract as `mutations.ts`. The modifier dialog is skipped for v1
 *  (`skipDialog: true`); the breakdown popup already shows the math. */

interface Statistic { roll(args?: Record<string, unknown>): Promise<unknown>; }
interface RollActor {
  skills?: Record<string, Statistic | undefined>;
  saves?: Record<string, Statistic | undefined>;
  perception?: Statistic;
}

function getActor(actorId: string): RollActor | undefined {
  return (game as any).actors.get(actorId) as RollActor | undefined;
}

async function guard(run: () => Promise<unknown>): Promise<void> {
  try {
    await run();
  } catch (err) {
    console.error("[pf2e-mobile] roll failed", err);
    (ui as any)?.notifications?.error?.("Roll failed — see console.");
  }
}

export function rollSkill(actorId: string, slug: string): Promise<void> {
  return guard(() => getActor(actorId)!.skills![slug]!.roll({ skipDialog: true }));
}
export function rollSave(actorId: string, slug: string): Promise<void> {
  return guard(() => getActor(actorId)!.saves![slug]!.roll({ skipDialog: true }));
}
export function rollPerception(actorId: string): Promise<void> {
  return guard(() => getActor(actorId)!.perception!.roll({ skipDialog: true }));
}

/** A roll trigger carried on a BreakdownRequest so CharacterSheet can dispatch
 *  the right statistic when its Roll button is tapped. */
export type RollTarget =
  | { kind: "skill"; slug: string }
  | { kind: "save"; slug: string }
  | { kind: "perception" };

export function rollTarget(actorId: string, target: RollTarget): Promise<void> {
  if (target.kind === "skill") return rollSkill(actorId, target.slug);
  if (target.kind === "save") return rollSave(actorId, target.slug);
  return rollPerception(actorId);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/rolls.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/foundry/actor/rolls.ts tests/rolls.test.ts
git commit -m "Phase 3 (Slice 1): guarded skill/save/perception roll functions" \
  -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Live chat-card rendering

No unit test — DOM/Foundry glue, verified by build + the manual checklist (Task 8). The card markup comes from the system via `message.renderHTML()`.

**Files:**
- Create: `src/foundry/chat/render.ts`, `src/app/chat/ChatCard.tsx`
- Modify: `src/styles/tailwind.css`

- [ ] **Step 1: Implement the render helper**

Create `src/foundry/chat/render.ts`:

```ts
/** Render a live PF2e chat card to an HTMLElement and let the system attach its
 *  listeners (apply-damage, etc.). DOM/Foundry glue — no unit test.
 *
 *  `message.renderHTML()` builds the card; PF2e binds chat-card listeners on the
 *  `renderChatMessageHTML` hook, which the stock sidebar fires but we must emit
 *  ourselves for elements we mount. Whether that wires the damage buttons is the
 *  Slice-1 spike (Task 8). */
export async function renderMessageElement(messageId: string): Promise<HTMLElement | null> {
  try {
    const msg = (game as any)?.messages?.get(messageId);
    if (!msg?.renderHTML) return null;
    const el: HTMLElement = await msg.renderHTML();
    try { (Hooks as any)?.callAll?.("renderChatMessageHTML", msg, el); } catch { /* listeners optional */ }
    return el;
  } catch (err) {
    console.warn("[pf2e-mobile] message renderHTML failed", err);
    return null;
  }
}
```

- [ ] **Step 2: Implement the ChatCard component**

Create `src/app/chat/ChatCard.tsx`:

```tsx
import { useEffect, useRef } from "react";
import { renderMessageElement } from "../../foundry/chat/render";
import type { ChatView } from "../../foundry/chat/types";

/** Mounts the live PF2e card element for one message; falls back to the summary
 *  title if the message is gone or won't render. */
export function ChatCard({ summary }: { summary: ChatView }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let alive = true;
    const host = ref.current;
    if (!host) return;
    renderMessageElement(summary.id).then((el) => {
      if (!alive || !host) return;
      if (el) host.replaceChildren(el);
      else host.textContent = summary.title;
    });
    return () => { alive = false; host?.replaceChildren(); };
  }, [summary.id, summary.title]);
  return <div ref={ref} className="pf2e-chat-card" />;
}
```

- [ ] **Step 3: Add scoped card styling**

Append to `src/styles/tailwind.css` (after the existing rules):

```css
/* PF2e chat cards rendered inside our feed. The markup comes from the system
   via message.renderHTML(); neutralize its light-theme colors and tighten it
   for mobile. The id+class selectors outrank the scoped button reset above, so
   card buttons (apply-damage, etc.) keep their own styling. */
#pf2e-mobile-companion-root .pf2e-chat-card {
  font-size: 0.85rem;
  line-height: 1.4;
  border: 1px solid #3f3f46;
  border-radius: 0.5rem;
  background: #18181b;
  padding: 0.5rem 0.625rem;
  overflow-x: auto;
}
#pf2e-mobile-companion-root .pf2e-chat-card a { color: #a5b4fc; }
#pf2e-mobile-companion-root .pf2e-chat-card h1,
#pf2e-mobile-companion-root .pf2e-chat-card h2,
#pf2e-mobile-companion-root .pf2e-chat-card h3,
#pf2e-mobile-companion-root .pf2e-chat-card h4 { font-weight: 700; margin: 0 0 0.25rem; }
#pf2e-mobile-companion-root .pf2e-chat-card .message-header { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.25rem; }
#pf2e-mobile-companion-root .pf2e-chat-card .dice-total { background: #27272a; border-radius: 0.375rem; padding: 0.125rem 0.375rem; font-weight: 700; }
#pf2e-mobile-companion-root .pf2e-chat-card button { border: 1px solid #52525b; border-radius: 0.375rem; padding: 0.125rem 0.5rem; background: #27272a; }
```

- [ ] **Step 4: Verify it compiles**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/foundry/chat/render.ts src/app/chat/ChatCard.tsx src/styles/tailwind.css
git commit -m "Phase 3 (Slice 1): live chat-card rendering + scoped card CSS" \
  -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Chat tab + toast components

No unit test — UI components, verified by build + manual checklist.

**Files:**
- Create: `src/app/tabs/ChatTab.tsx`, `src/app/chat/ChatToast.tsx`

- [ ] **Step 1: Implement the Chat tab**

Create `src/app/tabs/ChatTab.tsx`:

```tsx
import { useEffect, useRef } from "react";
import { useChatStore } from "../chatStore";
import { ChatCard } from "../chat/ChatCard";

/** The Chat tab: full scrollable history, newest at the bottom, auto-scrolled. */
export function ChatTab() {
  const messages = useChatStore((s) => s.messages);
  const bottom = useRef<HTMLDivElement>(null);
  useEffect(() => { bottom.current?.scrollIntoView({ block: "end" }); }, [messages.length]);

  if (messages.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-zinc-500">
        <i className="fas fa-comments text-3xl" aria-hidden="true" />
        <div className="text-zinc-300">No messages yet.</div>
        <div className="text-sm">Rolls and chat will appear here.</div>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2 p-3">
      {messages.map((m) => <ChatCard key={m.id} summary={m} />)}
      <div ref={bottom} />
    </div>
  );
}
```

- [ ] **Step 2: Implement the toast**

Create `src/app/chat/ChatToast.tsx`:

```tsx
import { useEffect } from "react";
import { useChatStore } from "../chatStore";
import { useAppStore } from "../store";

const TONE: Record<string, string> = {
  criticalSuccess: "border-emerald-400",
  success: "border-emerald-500",
  failure: "border-rose-500",
  criticalFailure: "border-rose-400",
};

/** Cross-tab peek at your latest result. Auto-dismisses after 5s; tap → Chat
 *  tab. Hidden while the Chat tab is already open. */
export function ChatToast() {
  const toast = useChatStore((s) => s.toast);
  const dismiss = useChatStore((s) => s.dismissToast);
  const activeTab = useAppStore((s) => s.activeTab);
  const setActiveTab = useAppStore((s) => s.setActiveTab);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(dismiss, 5000);
    return () => clearTimeout(t);
  }, [toast, dismiss]);

  if (!toast || activeTab === "chat") return null;

  return (
    <button
      onClick={() => { setActiveTab("chat"); dismiss(); }}
      className={`fixed inset-x-3 bottom-20 z-[105000] flex items-center justify-between gap-3 rounded-xl border-l-4 bg-zinc-800/95 px-4 py-3 text-left shadow-lg ${TONE[toast.outcome ?? ""] ?? "border-zinc-600"}`}
    >
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold">{toast.title}</span>
        {toast.outcomeLabel && <span className="text-xs text-zinc-300">{toast.outcomeLabel}</span>}
      </span>
      {toast.total != null && <span className="shrink-0 text-xl font-bold tabular-nums">{toast.total}</span>}
    </button>
  );
}
```

- [ ] **Step 3: Verify it compiles**

Run: `npm run typecheck`
Expected: no errors. (`ChatTab`/`ChatToast` are not yet referenced — that's Task 6. Unused-export is fine; this confirms types.)

- [ ] **Step 4: Commit**

```bash
git add src/app/tabs/ChatTab.tsx src/app/chat/ChatToast.tsx
git commit -m "Phase 3 (Slice 1): Chat tab history list + own-result toast" \
  -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Wire the chat feed into the app

**Files:**
- Create: `src/app/chat/useChatFeed.ts`
- Modify: `src/app/store.ts`, `src/app/TabBar.tsx`, `src/app/TabContent.tsx`, `src/app/Shell.tsx`
- Test: `tests/store.test.ts` (add a chat-tab case)

- [ ] **Step 1: Add `"chat"` to the tab union**

In `src/app/store.ts`, change the `TabId` type:

```ts
export type TabId = "sheet" | "actions" | "combat" | "chat" | "journal" | "map";
```

- [ ] **Step 2: Add a failing store test for the chat tab**

In `tests/store.test.ts`, add inside the `describe("useAppStore", …)` block:

```ts
  it("switches to the chat tab", () => {
    useAppStore.getState().setActiveTab("chat");
    expect(useAppStore.getState().activeTab).toBe("chat");
  });
```

Run: `npx vitest run tests/store.test.ts`
Expected: PASS (the union now includes `"chat"`; this guards against regressions).

- [ ] **Step 3: Implement the feed hook**

Create `src/app/chat/useChatFeed.ts`:

```tsx
import { useCallback, useEffect } from "react";
import { useFoundryHook } from "../useFoundryHook";
import { useChatStore } from "../chatStore";
import { useAppStore } from "../store";
import { buildChatView } from "../../foundry/chat/view";
import type { ChatContext, ChatMessageLike } from "../../foundry/chat/types";

function context(): ChatContext {
  return {
    selfUserId: (game as any)?.user?.id ?? null,
    activeActorId: useAppStore.getState().actorId,
  };
}

/** Collects visible chat messages into the store: seeds from history on mount,
 *  then stays live via createChatMessage / deleteChatMessage. Mount once (Shell).
 *  Foundry only delivers messages this client may see, so no visibility logic is
 *  reimplemented — we just honor `message.visible`. */
export function useChatFeed(): void {
  const seed = useChatStore((s) => s.seed);
  const push = useChatStore((s) => s.push);
  const remove = useChatStore((s) => s.remove);

  useEffect(() => {
    const all: any[] = (game as any)?.messages?.contents ?? [];
    const ctx = context();
    seed(
      all
        .filter((m) => m?.visible !== false)
        .slice(-50)
        .map((m) => buildChatView(m as ChatMessageLike, ctx)),
    );
  }, [seed]);

  const onCreate = useCallback((msg: any) => {
    if (msg?.visible === false) return;
    push(buildChatView(msg as ChatMessageLike, context()));
  }, [push]);
  const onDelete = useCallback((msg: any) => { if (msg?.id) remove(msg.id); }, [remove]);

  useFoundryHook("createChatMessage", onCreate);
  useFoundryHook("deleteChatMessage", onDelete);
}
```

- [ ] **Step 4: Add the Chat tab to the tab bar**

In `src/app/TabBar.tsx`, insert the Chat entry after `combat` in the `TABS` array:

```ts
const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: "sheet", label: "Sheet", icon: "fa-user" },
  { id: "actions", label: "Actions", icon: "fa-bolt" },
  { id: "combat", label: "Combat", icon: "fa-dice-d20" },
  { id: "chat", label: "Chat", icon: "fa-comments" },
  { id: "journal", label: "Journal", icon: "fa-book-open" },
  { id: "map", label: "Map", icon: "fa-map" },
];
```

- [ ] **Step 5: Route the Chat tab**

In `src/app/TabContent.tsx`, add the import and the case:

```tsx
import { useAppStore } from "./store";
import { SheetTab } from "./SheetTab";
import { ChatTab } from "./tabs/ChatTab";
import { Placeholder } from "./tabs/Placeholder";

export function TabContent() {
  const activeTab = useAppStore((s) => s.activeTab);
  switch (activeTab) {
    case "sheet":
      return <SheetTab />;
    case "actions":
      return <Placeholder title="Actions & Macros" phase="Coming in Phase 4" />;
    case "combat":
      return <Placeholder title="Combat Tracker" phase="Coming in Phase 5" />;
    case "chat":
      return <ChatTab />;
    case "journal":
      return <Placeholder title="Journals" phase="Coming in Phase 6" />;
    case "map":
      return <Placeholder title="Battle Map" phase="Coming in Phase 7" />;
    default:
      return null;
  }
}
```

- [ ] **Step 6: Mount the feed + toast in the shell**

In `src/app/Shell.tsx`, add the imports, call `useChatFeed()`, and render `<ChatToast />` as the last child of the root `<div>`:

```tsx
import { useAppStore } from "./store";
import { TabBar } from "./TabBar";
import { TabContent } from "./TabContent";
import { useFullscreen } from "./useFullscreen";
import { setUiMode } from "../foundry/settings";
import { useChatFeed } from "./chat/useChatFeed";
import { ChatToast } from "./chat/ChatToast";

export function Shell() {
  const { isFullscreen, toggle } = useFullscreen();
  const actorId = useAppStore((s) => s.actorId);
  useChatFeed();
  const title = actorId
    ? ((game as any).actors.get(actorId)?.name ?? "PF2e Mobile")
    : "PF2e Mobile";

  return (
    <div className="flex h-full w-full flex-col">
      <header
        className="flex shrink-0 items-center justify-between border-b border-zinc-800 bg-zinc-900 px-4 py-2"
        style={{ paddingTop: "max(0.5rem, env(safe-area-inset-top))" }}
      >
        <span className="truncate font-semibold">{title}</span>
        <div className="flex items-center gap-1">
          <button
            onClick={toggle}
            aria-label="Toggle fullscreen"
            className="flex h-10 w-10 items-center justify-center text-zinc-300"
          >
            <i className={`fas ${isFullscreen ? "fa-compress" : "fa-expand"}`} aria-hidden="true" />
          </button>
          <button
            onClick={() => void setUiMode("off")}
            aria-label="Exit to desktop UI"
            className="flex h-10 w-10 items-center justify-center text-zinc-300"
          >
            <i className="fas fa-display" aria-hidden="true" />
          </button>
        </div>
      </header>
      <main className="min-h-0 flex-1 overflow-y-auto">
        <TabContent />
      </main>
      <TabBar />
      <ChatToast />
    </div>
  );
}
```

- [ ] **Step 7: Verify typecheck, build, and full tests**

Run: `npm run typecheck && npm run build && npm test`
Expected: typecheck clean, build succeeds, all tests pass (including the new chat-tab store case).

- [ ] **Step 8: Commit**

```bash
git add src/app/chat/useChatFeed.ts src/app/store.ts src/app/TabBar.tsx src/app/TabContent.tsx src/app/Shell.tsx tests/store.test.ts
git commit -m "Phase 3 (Slice 1): mount chat feed + Chat tab + toast in the shell" \
  -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Wire the Roll button into checks

The `BreakdownModal` already renders a Roll button when given `onRoll` (Phase 2.1 seam). Here we (a) let a `BreakdownRequest` carry a `RollTarget`, (b) make skill/save/perception rows always open the modal (even with no breakdown) and attach their roll target, and (c) have `CharacterSheet` pass `onRoll` when the request has one. AC and class DC carry no target, so they stay display-only.

**Files:**
- Modify: `src/app/sheet/BreakdownModal.tsx`, `src/app/sheet/CharacterSheet.tsx`, `src/app/sheet/SkillsPanel.tsx`, `src/app/sheet/VitalsPanel.tsx`

- [ ] **Step 1: Add `roll?` to `BreakdownRequest`**

In `src/app/sheet/BreakdownModal.tsx`, add the import and extend the interface (the component body is unchanged — it already handles `onRoll`):

```tsx
import { Modal } from "./parts/Modal";
import type { ModPartView } from "../../foundry/actor/types";
import type { RollTarget } from "../../foundry/actor/rolls";

/** A breakdown request raised by tapping a stat. `totalSigned` false for AC/DCs.
 *  `roll` (skills/saves/perception) makes the modal's Roll button live. */
export interface BreakdownRequest { title: string; total: number; parts: ModPartView[]; totalSigned?: boolean; roll?: RollTarget; }
```

- [ ] **Step 2: Dispatch the roll from CharacterSheet**

In `src/app/sheet/CharacterSheet.tsx`, add `rollTarget` to the mutations/rolls imports and pass `onRoll` to the modal.

Add the import near the other foundry imports:

```tsx
import { rollTarget } from "../../foundry/actor/rolls";
```

Change the breakdown modal render line (near the end of the component):

```tsx
{breakdown && (
  <BreakdownModal
    req={breakdown}
    onClose={() => setBreakdown(null)}
    onRoll={breakdown.roll ? () => rollTarget(actorId, breakdown.roll!) : undefined}
  />
)}
```

- [ ] **Step 3: Make skills always tappable + carry a roll target**

In `src/app/sheet/SkillsPanel.tsx`, change the `StatRow`'s `onClick` (remove the `s.breakdown ?` guard; pass `parts: s.breakdown ?? []` and a skill `roll` target):

```tsx
          onClick={() => onShowBreakdown({ title: s.label, total: s.mod, parts: s.breakdown ?? [], roll: { kind: "skill", slug: s.slug } })}
```

- [ ] **Step 4: Make saves + perception tappable with roll targets (AC/class DC unchanged)**

In `src/app/sheet/VitalsPanel.tsx`, update the saves and perception rows in the Defenses section. Leave the Armor Class and Class DC rows exactly as they are (no `roll` → display-only).

Saves row:

```tsx
        {d.saves.map((s) => <StatRow key={s.slug} label={s.label} value={sign(s.mod)} right={<RankPip rank={s.rank} />} onClick={() => onShowBreakdown({ title: s.label, total: s.mod, parts: s.breakdown ?? [], roll: { kind: "save", slug: s.slug } })} />)}
```

Perception row:

```tsx
        <StatRow label="Perception" value={sign(d.perception.mod)} right={<RankPip rank={d.perception.rank} />} onClick={() => onShowBreakdown({ title: "Perception", total: d.perception.mod, parts: d.perception.breakdown ?? [], roll: { kind: "perception" } })} />
```

- [ ] **Step 5: Verify typecheck + build + tests**

Run: `npm run typecheck && npm run build && npm test`
Expected: all clean/green. (The mapper tests are unaffected — no view types changed.)

- [ ] **Step 6: Commit**

```bash
git add src/app/sheet/BreakdownModal.tsx src/app/sheet/CharacterSheet.tsx src/app/sheet/SkillsPanel.tsx src/app/sheet/VitalsPanel.tsx
git commit -m "Phase 3 (Slice 1): Roll button on skill/save/perception breakdowns" \
  -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Live verification, damage-button spike, roadmap update

No code unless the spike surfaces an issue. This is the Slice-1 checkpoint gate.

- [ ] **Step 1: Full automated verification**

Run: `npm run typecheck && npm run build && npm test`
Expected: typecheck clean, build succeeds, all test files green (`chatView`, `chatStore`, `rolls`, `store`, plus the existing suites).

- [ ] **Step 2: Manual checklist (GM on desktop Chrome + player on mobile/emulated Chrome)**

Confirm each:
- Tap a skill → breakdown popup shows modifiers + a **Roll** button. Tap Roll → a result appears as a toast and in the **Chat** tab within ~1s.
- Tap a save and Perception → same. Tap **AC** and a **Class DC** → breakdown shows with **no** Roll button.
- Roll a stat with no breakdown data → popup shows "No breakdown available." + total + Roll button; rolling still works.
- The toast shows for **your** rolls only; a GM/other-player message lands in the Chat tab but raises **no** toast. Tapping the toast jumps to the Chat tab; the toast self-dismisses after ~5s.
- Open the app mid-session → the Chat tab is seeded with recent visible messages (not empty).
- Chat tab is readable on a dark mobile screen (card text legible, not light-on-light).

- [ ] **Step 3: Damage-button spike (architecture-determining for Slice 2)**

Have the GM (or a strike, if testing ahead) post a chat card with an **Apply Damage** button into the player's visible log. In the mobile Chat tab, tap the button.
- If damage applies (HP updates on the sheet) → PF2e's listeners attach to our rendered element via the `renderChatMessageHTML` emit. Record "buttons work" — Slice 2 needs no custom damage buttons.
- If nothing happens or the button is dead/unstyled → record the failure mode (no listener vs. broken styling). Slice 2 will add custom apply-damage buttons from `message.rolls`/flags. Do **not** fix it now; Slice 1 (checks) needs no damage buttons.

Write the outcome as a short note at the bottom of the spec file `docs/superpowers/specs/2026-06-11-phase-3-rolling-design.md` under a new `## Spike result` heading, and commit it.

- [ ] **Step 4: Update the roadmap**

In `pf2e-mobile-companion-plan.md`, under **Phase 3**, check the two Slice-1 bullets and annotate the phase with the slice status and doc links. Replace the existing two unchecked bullets:

```markdown
- [x] Skill/save/perception checks: `actor.skills.athletics.roll()`, `actor.saves.reflex.roll()`, `actor.perception.roll()` — via the breakdown popup's Roll button (Slice 1, `skipDialog`).
```

and

```markdown
- [x] Roll results: subscribe to `createChatMessage` and render a chat feed — Chat tab (full history) + cross-tab toast for own results (Slice 1).
```

Add this note directly under the Phase 3 heading:

```markdown
> **Slice 1 done (2026-06-11):** checks + chat feed. Spec: `docs/superpowers/specs/2026-06-11-phase-3-rolling-design.md` · Plan: `docs/superpowers/plans/2026-06-11-phase-3-rolling-slice-1.md`. Next: Slice 2 (strikes), Slice 3 (spells). Damage-apply buttons: see Spike result in the spec.
```

- [ ] **Step 5: Commit**

```bash
git add pf2e-mobile-companion-plan.md docs/superpowers/specs/2026-06-11-phase-3-rolling-design.md
git commit -m "Phase 3 (Slice 1): mark checks + chat feed done; record damage-button spike" \
  -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage:**
- *Rolling via live API, skipDialog* → Task 3 (`rolls.ts`).
- *Tap stat → popup → Roll; skill/save/perception only; AC/DC display-only* → Task 7.
- *Chat as 6th bottom tab* → Task 6 (store/TabBar/TabContent).
- *Auto-toast for own results; tap → Chat tab; suppressed on Chat tab* → Tasks 2 (`toast` logic) + 5 (`ChatToast`).
- *Real PF2e HTML via `renderHTML()` as a live element; listener hook* → Task 4.
- *Seed from history + live `createChatMessage`/`deleteChatMessage`; honor `visible`* → Task 6 (`useChatFeed`).
- *Pure `buildChatView` + toast-filter predicate (`isOwn`) TDD* → Task 1.
- *Damage-button spike* → Task 8 Step 3.
- *Strikes/Spells* → out of scope for Slice 1 (specced for later slices), per the approved slice plan.

**Deviation from spec (noted):** the spec sketched a `rollable`/`rollKey` flag on the view types; the plan instead carries the `RollTarget` on the `BreakdownRequest` the panels build. Same behavior (rows open the modal regardless of breakdown; rolls dispatch by kind), but no view-type changes — which keeps the exact-match mapper tests (`characterView.skills.test.ts`, `characterView.stats.test.ts`) green.

**Placeholder scan:** no TBD/TODO; every code step shows complete content; commands have expected output.

**Type consistency:** `ChatView`, `ChatMessageLike`, `ChatContext`, `Outcome` (Task 1) are reused unchanged in Tasks 2/4/6. `RollTarget`/`rollTarget` (Task 3) are reused in Task 7. `useChatStore` API (`seed/push/remove/dismissToast/messages/toast`) is consistent across Tasks 2/5/6. `BreakdownRequest.roll` (Task 7 Step 1) matches the `RollTarget` shape from Task 3.
