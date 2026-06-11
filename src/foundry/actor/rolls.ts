/** Live PF2e statistic rolls. Thin glue over the system API, guarded so a
 *  rejected roll surfaces via Foundry's toast and never throws into React —
 *  same contract as `mutations.ts`. The modifier dialog is skipped for v1
 *  (`skipDialog: true`); the breakdown popup already shows the math. */

interface Statistic { roll(args?: Record<string, unknown>): Promise<unknown>; }
interface RollActor {
  skills?: Record<string, Statistic | undefined>;
  saves?: Record<string, Statistic | undefined>;
  perception?: Statistic;
}

function getActor(actorId: string): RollActor | undefined {
  return (game as any).actors.get(actorId) as RollActor | undefined;
}

async function guard(run: () => Promise<unknown>): Promise<void> {
  try {
    await run();
  } catch (err) {
    console.error("[pf2e-mobile] roll failed", err);
    (ui as any)?.notifications?.error?.("Roll failed — see console.");
  }
}

export function rollSkill(actorId: string, slug: string): Promise<void> {
  return guard(() => getActor(actorId)!.skills![slug]!.roll({ skipDialog: true }));
}
export function rollSave(actorId: string, slug: string): Promise<void> {
  return guard(() => getActor(actorId)!.saves![slug]!.roll({ skipDialog: true }));
}
export function rollPerception(actorId: string): Promise<void> {
  return guard(() => getActor(actorId)!.perception!.roll({ skipDialog: true }));
}

/** A roll trigger carried on a BreakdownRequest so CharacterSheet can dispatch
 *  the right statistic when its Roll button is tapped. */
export type RollTarget =
  | { kind: "skill"; slug: string }
  | { kind: "save"; slug: string }
  | { kind: "perception" };

export function rollTarget(actorId: string, target: RollTarget): Promise<void> {
  if (target.kind === "skill") return rollSkill(actorId, target.slug);
  if (target.kind === "save") return rollSave(actorId, target.slug);
  return rollPerception(actorId);
}
