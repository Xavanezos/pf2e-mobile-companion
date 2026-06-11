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
