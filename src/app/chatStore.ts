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
