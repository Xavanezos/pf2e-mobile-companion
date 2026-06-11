import { create } from "zustand";

export type TabId = "sheet" | "actions" | "combat" | "chat" | "journal" | "map";
export type SheetSubTab = "vitals" | "skills" | "spells" | "items" | "feats" | "profs" | "bio";

export interface AppState {
  activeTab: TabId;
  setActiveTab: (tab: TabId) => void;
  actorId: string | null;
  setActorId: (id: string | null) => void;
  sheetSubTab: SheetSubTab;
  setSheetSubTab: (tab: SheetSubTab) => void;
}

/** Mirrors UI state only; Foundry Documents remain the source of truth. */
export const useAppStore = create<AppState>((set) => ({
  activeTab: "sheet",
  setActiveTab: (tab) => set({ activeTab: tab }),
  actorId: null,
  setActorId: (id) => set({ actorId: id }),
  sheetSubTab: "vitals",
  setSheetSubTab: (tab) => set({ sheetSubTab: tab }),
}));
