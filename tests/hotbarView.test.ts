import { describe, it, expect } from "vitest";
import { buildHotbarView } from "../src/foundry/macros/hotbar";
import type { HotbarUserLike, MacroLike } from "../src/foundry/macros/types";

/** Build a `getMacro` resolver over a fixture map of id → macro. */
function resolver(map: Record<string, MacroLike>) {
  return (id: string): MacroLike | undefined => map[id];
}

describe("buildHotbarView", () => {
  it("flattens populated slots across pages, sorted by numeric slot, mapping fields", () => {
    const user: HotbarUserLike = { hotbar: { 12: "b", 3: "a", 41: "c" } };
    const get = resolver({
      a: { id: "a", name: "Fireball", img: "icons/a.webp", canExecute: true },
      b: { id: "b", name: "Bless", img: "icons/b.webp", canExecute: true },
      c: { id: "c", name: "Shield", img: "icons/c.webp", canExecute: true },
    });
    expect(buildHotbarView(user, get)).toEqual([
      { id: "a", slot: 3, name: "Fireball", img: "icons/a.webp", canExecute: true },
      { id: "b", slot: 12, name: "Bless", img: "icons/b.webp", canExecute: true },
      { id: "c", slot: 41, name: "Shield", img: "icons/c.webp", canExecute: true },
    ]);
  });

  it("skips dangling slots whose macro no longer resolves (no gap)", () => {
    const user: HotbarUserLike = { hotbar: { 1: "gone", 2: "ok" } };
    const get = resolver({ ok: { id: "ok", name: "Seek", img: null, canExecute: true } });
    expect(buildHotbarView(user, get)).toEqual([
      { id: "ok", slot: 2, name: "Seek", img: null, canExecute: true },
    ]);
  });

  it("returns [] for an empty or missing hotbar", () => {
    expect(buildHotbarView({ hotbar: {} }, resolver({}))).toEqual([]);
    expect(buildHotbarView({}, resolver({}))).toEqual([]);
  });

  it("defaults img to null and canExecute to true when absent; honors canExecute:false", () => {
    const user: HotbarUserLike = { hotbar: { 1: "x", 2: "y" } };
    const get = resolver({
      x: { id: "x", name: "Util" },                 // no img, no canExecute
      y: { id: "y", name: "GM Only", canExecute: false },
    });
    expect(buildHotbarView(user, get)).toEqual([
      { id: "x", slot: 1, name: "Util", img: null, canExecute: true },
      { id: "y", slot: 2, name: "GM Only", img: null, canExecute: false },
    ]);
  });
});
