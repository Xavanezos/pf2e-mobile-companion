/** One combat roll-option toggle (Rage / Panache / stance …). */
export interface ToggleView { domain: string; option: string; itemId: string; label: string; checked: boolean; enabled: boolean; }
export type TogglesView = ToggleView[];

export interface RollOptionToggleLike {
  itemId?: string; label?: string; placement?: string; domain?: string; option?: string;
  checked?: boolean; enabled?: boolean; alwaysActive?: boolean;
}
export interface TogglesActorLike {
  synthetics?: { toggles?: Record<string, Record<string, RollOptionToggleLike>> };
}
