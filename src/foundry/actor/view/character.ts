import type { CharacterLike, CharacterView } from "../types";
import { mapHeader } from "./header";
import { mapDefenses, mapAbilities, mapTraits } from "./defenses";
import { mapSkills } from "./skills";
import { mapConditions, mapEffects } from "./conditions";
import { mapInventory } from "./inventory";
import { mapFeats } from "./feats";
import { mapBio } from "./bio";

export function buildCharacterView(a: CharacterLike): CharacterView {
  return {
    id: a.id,
    header: mapHeader(a),
    defenses: mapDefenses(a),
    abilities: mapAbilities(a),
    traits: mapTraits(a),
    skills: mapSkills(a),
    conditions: mapConditions(a),
    effects: mapEffects(a),
    inventory: mapInventory(a),
    featGroups: mapFeats(a),
    bio: mapBio(a),
  };
}
