import type { CharacterLike, FeatGroupView, FeatView } from "../types";

/** category key → label + display order. Unknown categories fall through to "other". */
const FEAT_GROUPS: Record<string, { label: string; order: number }> = {
  ancestry: { label: "Ancestry Feats", order: 0 },
  background: { label: "Background Feats", order: 1 },
  class: { label: "Class Feats", order: 2 },
  classfeature: { label: "Class Features", order: 3 },
  general: { label: "General Feats", order: 4 },
  skill: { label: "Skill Feats", order: 5 },
  bonus: { label: "Bonus Feats", order: 6 },
};
const OTHER_FEAT_GROUP = { label: "Other", order: 7 };

export function actionGlyph(
  actionType: { value?: string | null } | undefined,
  actions: { value?: number | null } | undefined,
): string | null {
  const type = actionType?.value;
  if (type === "action") return actions?.value ? String(actions.value) : "1";
  if (type === "reaction") return "reaction";
  if (type === "free") return "free";
  return null;
}

export function mapFeats(a: CharacterLike): FeatGroupView[] {
  const groups = new Map<string, FeatGroupView>();
  for (const f of a.itemTypes.feat) {
    const cat = f.system.category;
    const meta = FEAT_GROUPS[cat] ?? OTHER_FEAT_GROUP;
    const key = FEAT_GROUPS[cat] ? cat : "other";
    if (!groups.has(key)) groups.set(key, { key, label: meta.label, feats: [] });
    const view: FeatView = {
      id: f.id, name: f.name, img: f.img,
      actionGlyph: actionGlyph(f.system.actionType, f.system.actions),
      traits: f.system.traits?.value ?? [],
      level: f.system.level?.value ?? 0,
    };
    groups.get(key)!.feats.push(view);
  }
  for (const g of groups.values()) g.feats.sort((x, y) => x.level - y.level || x.name.localeCompare(y.name));
  return [...groups.values()].sort(
    (x, y) => (FEAT_GROUPS[x.key]?.order ?? OTHER_FEAT_GROUP.order) - (FEAT_GROUPS[y.key]?.order ?? OTHER_FEAT_GROUP.order),
  );
}
