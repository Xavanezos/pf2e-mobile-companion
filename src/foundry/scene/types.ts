// Type contract for the lightweight battle map: the view the renderer draws,
// plus the structural shapes of the live Scene + Token documents the mapper reads.

import type { ConditionView, EffectView, ConditionLike, EffectLike } from "../actor/types";

/** Scene→pixel geometry (a structural subset of Foundry's SceneDimensions).
 *  Computed canvas-free by Scene#prepareBaseData; passed into the pure mapper. */
export interface SceneDimensionsLike {
  width: number;        // full padded canvas width, px
  height: number;       // full padded canvas height, px
  size: number;         // px per grid square
  sceneX: number;       // background image left within the padded canvas
  sceneY: number;       // background image top
  sceneWidth: number;   // background image width, px
  sceneHeight: number;  // background image height, px
}

/** One token, ready to position over the background. */
export interface TokenView {
  id: string;
  name: string;                  // "" when the player may not see it (no nameplate)
  img: string | null;
  left: number;
  top: number;                   // scene px (padded-canvas space) = token.x / token.y (footprint top-left)
  width: number;
  height: number;                // visible art size, px (PF2e creature size × grid size)
  footprintW: number;
  footprintH: number;            // grid footprint, px (token grid units × size); art is centred within it
  scaleX: number;
  scaleY: number;                // Foundry texture.scaleX/scaleY — art zoom within the frame (1 = none)
  isMine: boolean;               // active character owns the actor → draggable
  controllable: boolean;         // viewer owns the actor (or is GM) → tap selects it (Token#control)
  isCurrent: boolean;            // current combatant's token → turn ring
  targeted: boolean;             // in the user's target set → reticle
  hidden: boolean;               // GM-hidden (only listed for the GM; rendered dimmed)
  disposition: number;           // CONST.TOKEN_DISPOSITIONS (-2 secret … 1 friendly)
  hp: { value: number; max: number } | null; // null when the viewer may not see it
  conditions: ConditionView[];   // active PF2e conditions (frightened, prone, …)
  effects: EffectView[];         // active PF2e effects (spell buffs, …)
}

/** What the Map tab renders. */
export interface SceneView {
  id: string;                    // active scene id (for moveToken dispatch)
  background: string | null;     // scene.background.src
  grid: { type: number; color: string; alpha: number; distance: number } | null; // CONST.GRID_TYPES, line color/opacity, feet per square
  dims: SceneDimensionsLike;
  tokens: TokenView[];
  hasScene: true;
}

/** Viewer context the mapper needs to apply visibility rules. */
export interface SceneViewContext {
  isGM: boolean;
  characterActorId: string | null;
  currentTokenId: string | null; // game.combat?.combatant?.tokenId on this scene
  targetedIds: string[];         // game.user.targets.ids → which tokens show a reticle
}

/** A live TokenDocumentPF2e — only the fields the mapper reads. */
export interface TokenLike {
  id: string;
  name: string;
  x: number;
  y: number;                     // top-left, padded-canvas px
  width: number;
  height: number;                // grid units
  hidden: boolean;
  disposition?: number;
  isSecret?: boolean;            // PF2e getter: SECRET disposition the viewer can't reveal
  playersCanSeeName?: boolean;   // PF2e getter
  texture?: { src?: string | null; scaleX?: number; scaleY?: number } | null;
  actor?: {
    id: string;
    hasPlayerOwner?: boolean;
    isOwner?: boolean;             // current viewer owns this actor (un-masks unidentified effects)
    system?: { attributes?: { hp?: { value?: number; max?: number } }; traits?: { size?: { value?: string } } };
    conditions?: { active: ConditionLike[] };
    itemTypes?: { effect: EffectLike[] };
  } | null;
}

/** The live ScenePF2e — only the fields the mapper reads. `tokens` is accepted as
 *  a plain array or a Foundry EmbeddedCollection ({ contents }). */
export interface SceneLike {
  id: string;
  background?: { src?: string | null } | null;
  grid?: { type: number; color: string; alpha: number; distance: number } | null;
  tokens: TokenLike[] | { contents: TokenLike[] };
}
