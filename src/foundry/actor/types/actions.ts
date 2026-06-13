/** One action/activity row. `glyph` is an ActionGlyph code ("1"/"2"/"3"/"reaction"/"free") or null. */
export interface ActionItemView {
  id: string;
  name: string;
  img?: string;
  glyph: string | null;
  traits: string[];
  frequency: { value: number; max: number; per: string } | null;
}
export interface ActionGroupView { key: string; label: string; actions: ActionItemView[]; }
export type ActionsView = ActionGroupView[];

/** Live action/feat item, structurally (read by the mapper). */
export interface ActionItemLike {
  id: string;
  name: string;
  img?: string;
  type: string;
  suppressed?: boolean;
  system?: {
    actionType?: { value?: string | null };
    actions?: { value?: number | null };
    traits?: { value?: string[] };
    frequency?: { value?: number; max?: number; per?: string } | null;
  };
}
export interface ActionsActorLike {
  itemTypes?: { action?: ActionItemLike[]; feat?: ActionItemLike[] };
  system?: { exploration?: string[] };
}
