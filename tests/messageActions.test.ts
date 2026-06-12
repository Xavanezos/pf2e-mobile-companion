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
