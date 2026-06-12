import { describe, it, expect, beforeEach } from "vitest";
import { rollStrikeAttack, rollStrikeDamage, rollStrikeCritical } from "../src/foundry/actor/strikeActions";

interface Call { method: string; args: unknown[]; }

function stub(): Call[] {
  const calls: Call[] = [];
  const variant = (i: number) => ({
    roll: (...args: unknown[]) => { calls.push({ method: `variant${i}.roll`, args }); return Promise.resolve(); },
  });
  const strike = {
    slug: "longsword",
    variants: [variant(0), variant(1), variant(2)],
    damage: (...args: unknown[]) => { calls.push({ method: "damage", args }); return Promise.resolve(); },
    critical: (...args: unknown[]) => { calls.push({ method: "critical", args }); return Promise.resolve(); },
  };
  const actor = { system: { actions: [strike] } };
  (globalThis as { game?: unknown }).game = {
    actors: { get: () => actor },
    user: { settings: { showCheckDialogs: true, showDamageDialogs: false } },
  };
  (globalThis as { ui?: unknown }).ui = { notifications: { error: () => {} } };
  (globalThis as { PointerEvent?: unknown }).PointerEvent = class {
    shiftKey: boolean;
    constructor(public type: string, init?: { shiftKey?: boolean }) { this.shiftKey = !!init?.shiftKey; }
  } as unknown;
  return calls;
}

describe("strike actions", () => {
  let calls: Call[];
  beforeEach(() => { calls = stub(); });

  it("rolls the chosen MAP variant with a skip-dialog click event (mirrors showCheckDialogs)", async () => {
    await rollStrikeAttack("a", 0, 1);
    expect(calls[0].method).toBe("variant1.roll");
    const arg = calls[0].args[0] as { event?: { type?: string; shiftKey?: boolean } };
    expect(arg.event?.type).toBe("click");
    expect(arg.event?.shiftKey).toBe(true);
  });

  it("rolls damage and critical with showDamageDialogs mirrored into the event", async () => {
    await rollStrikeDamage("a", 0);
    await rollStrikeCritical("a", 0);
    expect(calls.map((c) => c.method)).toEqual(["damage", "critical"]);
    const dmgArg = calls[0].args[0] as { event?: { shiftKey?: boolean } };
    expect(dmgArg.event?.shiftKey).toBe(false);
  });

  it("never throws when the strike or variant is missing", async () => {
    await expect(rollStrikeAttack("a", 99, 0)).resolves.toBeUndefined();
    await expect(rollStrikeAttack("a", 0, 9)).resolves.toBeUndefined();
    expect(calls).toEqual([]);
  });
});
