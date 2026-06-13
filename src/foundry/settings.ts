import { isMobileDevice, type MapRenderer } from "./mobile";

export const MODULE_ID = "pf2e-mobile-companion";

/** Register client settings at `init`. `onMapRendererChange` runs when the user
 *  flips the map renderer (from Foundry's settings menu or the in-app cogwheel). */
export function registerSettings(onMapRendererChange: () => void): void {
  (game as any).settings.register(MODULE_ID, "mapRenderer", {
    name: "Battle map renderer",
    hint: "Canvas mirrors Foundry's real map — walls, dynamic lighting, fog of war — on the Map tab only (paused elsewhere). Lite is a faster image-and-tokens map for low-power devices.",
    scope: "client",
    config: true,
    type: String,
    choices: { canvas: "Foundry canvas (full)", lite: "Lite (fast)" },
    default: "canvas",
    onChange: () => onMapRendererChange(),
  });
}

export function getMapRenderer(): MapRenderer {
  return ((game as any).settings.get(MODULE_ID, "mapRenderer") as MapRenderer) ?? "canvas";
}
export async function setMapRenderer(value: MapRenderer): Promise<void> {
  await (game as any).settings.set(MODULE_ID, "mapRenderer", value);
}

/** True when the mobile UI should take over: a real phone or tablet (incl.
 *  modern iPadOS, which reports a desktop UA but exposes multi-touch). */
export function isMobileActive(): boolean {
  return isMobileDevice({
    ua: navigator.userAgent,
    maxTouchPoints: navigator.maxTouchPoints,
  });
}

export function getNoCanvas(): boolean {
  return Boolean((game as any).settings.get("core", "noCanvas"));
}
export async function setNoCanvas(value: boolean): Promise<void> {
  await (game as any).settings.set("core", "noCanvas", value);
}

export { desiredNoCanvas } from "./mobile";
export type { MapRenderer } from "./mobile";
