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
