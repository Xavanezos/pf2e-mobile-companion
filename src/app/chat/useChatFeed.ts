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
