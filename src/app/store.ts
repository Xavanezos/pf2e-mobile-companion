import { create } from "zustand";

export type TabId = "sheet" | "actions" | "combat" | "journal" | "map";

export interface AppState {
  activeTab: TabId;
  setActiveTab: (tab: TabId) => void;
  actorId: string | null;
  setActorId: (id: string | null) => void;
}

/** Mirrors UI state only; Foundry Documents remain the source of truth. */
export const useAppStore = create<AppState>((set) => ({
  activeTab: "sheet",
  setActiveTab: (tab) => set({ activeTab: tab }),
  actorId: null,
  setActorId: (id) => set({ actorId: id }),
}));
