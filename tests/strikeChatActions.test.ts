import { describe, it, expect, beforeEach } from "vitest";
import { rollAttackCardDamage, previewAttackCardDamage, attackCardLabel } from "../src/foundry/actor/strikeChatActions";

interface Call { method: string; args: unknown[]; }

function stub(): Call[] {
  const calls: Call[] = [];
  const formulaFor = (m: string, a: unknown[]) =>
    (a[0] as { getFormula?: boolean })?.getFormula ? (m === "critical" ? "2d8+8 slashing" : "1d8+4 slashing") : undefined;
  const strike = {
    label: "Longsword",
    damage: (...a: unknown[]) => { calls.push({ method: "damage", args: a }); return Promise.resolve(formulaFor("damage", a)); },
    critical: (...a: unknown[]) => { calls.push({ method: "critical", args: a }); return Promise.resolve(formulaFor("critical", a)); },
  };
  const message = { _attack: strike, item: { name: "Longsword" } };
  (globalThis as { game?: unknown }).game = {
    messages: { get: (id: string) => (id === "m1" ? message : null) },
    user: { settings: { showDamageDialogs: false } },
  };
  (globalThis as { ui?: unknown }).ui = { notifications: { error: () => {} } };
  (globalThis as { PointerEvent?: unknown }).PointerEvent = class {
    shiftKey: boolean;
    constructor(public type: string, init?: { shiftKey?: boolean }) { this.shiftKey = !!init?.shiftKey; }
  } as unknown;
  return calls;
}

describe("strike chat actions", () => {
  let calls: Call[];
  beforeEach(() => { calls = stub(); });

  it("rolls damage via the message's resolved strike with a click event", async () => {
    await rollAttackCardDamage("m1");
    expect(calls[0].method).toBe("damage");
    expect((calls[0].args[0] as { event?: { type?: string } }).event?.type).toBe("click");
  });

  it("rolls critical when critical:true", async () => {
    await rollAttackCardDamage("m1", { critical: true });
    expect(calls[0].method).toBe("critical");
  });

  it("previews the damage formula without rolling (getFormula)", async () => {
    expect(await previewAttackCardDamage("m1")).toBe("1d8+4 slashing");
    expect((calls[0].args[0] as { getFormula?: boolean }).getFormula).toBe(true);
  });

  it("returns the strike label for the popup title", () => {
    expect(attackCardLabel("m1")).toBe("Longsword");
  });

  it("never throws / returns null when the message has no strike", async () => {
    await expect(rollAttackCardDamage("missing")).resolves.toBeUndefined();
    expect(await previewAttackCardDamage("missing")).toBeNull();
  });
});
