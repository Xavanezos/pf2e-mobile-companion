// Type contract for the macro bar: the view the UI renders, plus the structural
// shapes of the live User (its hotbar) and the live Macro the mapper reads.

/** One button on the macro bar = one populated hotbar slot. */
export interface MacroButtonView {
  id: string;
  slot: number;
  name: string;
  img: string | null;
  canExecute: boolean;
}
export type HotbarView = MacroButtonView[];

/** The live User — only the hotbar record the mapper reads.
 *  `game.user.hotbar` is `Record<number, string>` (slot 1–50 → macro id). */
export interface HotbarUserLike {
  hotbar?: Record<number, string>;
}

/** A live Macro, structurally — the display fields the mapper reads. */
export interface MacroLike {
  id?: string;
  name?: string;
  img?: string | null;
  canExecute?: boolean;
}
