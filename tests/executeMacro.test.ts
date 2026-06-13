import { describe, it, expect } from "vitest";
import { executeMacro } from "../src/foundry/macros/hotbar";

interface Exec { scope: unknown; }

/** Stub the Foundry globals. `opts.macro/actor === false` makes that lookup miss;
 *  `opts.token` gives the actor an active Token placeable on the viewed scene. */
function stub(opts: { macro?: boolean; actor?: boolean; token?: object } = {}) {
  const execs: Exec[] = [];
  const actor = { id: "a1", name: "Ezren", getActiveTokens: () => (opts.token ? [opts.token] : []) };
  const macro = { execute: (scope: unknown) => { execs.push({ scope }); return Promise.resolve(true); } };
  (globalThis as { game?: unknown }).game = {
    macros: { get: () => (opts.macro === false ? undefined : macro) },
    actors: { get: () => (opts.actor === false ? undefined : actor) },
    user: { id: "u1" },
  };
  (globalThis as { ui?: unknown }).ui = { notifications: { error: () => {} } };
  return { execs, actor };
}

describe("executeMacro", () => {
  it("executes the macro with { actor } scope when the actor resolves", async () => {
    const { execs, actor } = stub();
    await executeMacro("m1", "a1");
    expect(execs).toHaveLength(1);
    expect((execs[0].scope as { actor?: unknown }).actor).toBe(actor);
  });

  it("also passes the actor's active token when one is on the viewed scene", async () => {
    const token = { id: "t1" };
    const { execs, actor } = stub({ token });
    await executeMacro("m1", "a1");
    expect((execs[0].scope as { actor?: unknown }).actor).toBe(actor);
    expect((execs[0].scope as { token?: unknown }).token).toBe(token);
  });

  it("executes with empty scope when no actor id is given", async () => {
    const { execs } = stub();
    await executeMacro("m1", null);
    expect(execs[0].scope).toEqual({});
  });

  it("never throws when the macro is missing", async () => {
    stub({ macro: false });
    await expect(executeMacro("gone", "a1")).resolves.toBeUndefined();
  });
});
