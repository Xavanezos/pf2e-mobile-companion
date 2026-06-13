// View + source shapes for the spell detail popup (tap-for-info).

export interface SpellDetailView {
  name: string;
  img?: string;
  rank: number;
  glyph: string | null;
  traits: string[];
  meta: { label: string; value: string }[];
  descriptionHtml: string;
}
export interface SpellDetailLike {
  name: string;
  img?: string;
  system?: {
    level?: { value?: number };
    traits?: { value?: string[]; rarity?: string; traditions?: string[] };
    time?: { value?: string };
    range?: { value?: string };
    area?: { type?: string; value?: number } | null;
    target?: { value?: string };
    duration?: { value?: string };
    defense?: { save?: { statistic?: string; basic?: boolean } } | null;
    description?: { value?: string };
  };
}
