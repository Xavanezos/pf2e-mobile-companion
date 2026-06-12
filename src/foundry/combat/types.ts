// Type contract for the combat tracker: the view the UI renders, plus the
// structural shapes of the live Encounter + Combatant documents the mapper reads.

/** One row in the initiative order. */
export interface CombatantView {
  id: string;
  name: string;                 // "Unknown" when the player may not see the real name
  img: string | null;
  initiative: number | null;    // null = not yet rolled → renders "–"
  isCurrent: boolean;           // this is game.combat.combatant
  isMine: boolean;              // belongs to the active character
  defeated: boolean;
  hp: { value: number; max: number } | null; // null when not visible to the viewer
}

/** What the Combat tab renders. */
export interface EncounterView {
  round: number;
  started: boolean;
  combatants: CombatantView[];  // turn order (already initiative-sorted by PF2e)
  myCombatantId: string | null; // the active character's combatant, if present
  canRollInitiative: boolean;   // mine exists && initiative == null
  isMyTurn: boolean;            // current combatant is the active character
}

/** Viewer context the mapper needs to apply visibility rules. */
export interface EncounterViewContext {
  isGM: boolean;
  characterActorId: string | null;
}

// ---------- Source (the live documents, structurally) ----------

/** A live CombatantPF2e — only the fields the mapper reads. */
export interface CombatantLike {
  id: string;
  name: string;
  initiative: number | null;
  hidden: boolean;
  defeated?: boolean;
  playersCanSeeName?: boolean;  // PF2e getter on the live combatant
  img?: string | null;          // Foundry Combatant#img fallback
  token?: { texture?: { src?: string | null } } | null;
  actor?: {
    id: string;
    img?: string | null;
    hasPlayerOwner?: boolean;
    system?: { attributes?: { hp?: { value?: number; max?: number } } };
  } | null;
}

/** The live EncounterPF2e — only the fields the mapper reads. */
export interface EncounterLike {
  round: number;
  started: boolean;
  combatant?: { id?: string } | null; // the current-turn combatant
  turns: CombatantLike[];             // ordered turn list
}
