export type UiMode = "auto" | "on" | "off";

export interface DetectMobileInput {
  ua: string;
  width: number;
  override: UiMode;
}

const MOBILE_UA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i;
const WIDTH_BREAKPOINT = 900;

export function isMobileUA(ua: string): boolean {
  return MOBILE_UA.test(ua);
}

export interface DeviceSignals {
  ua: string;
  maxTouchPoints: number;
}

/** True when the client is a phone or tablet. iPadOS 13+ Safari reports a
 *  desktop "Macintosh" UA, so an iPad is distinguished from a real Mac (which
 *  has no touchscreen) by multi-touch support. */
export function isMobileDevice({ ua, maxTouchPoints }: DeviceSignals): boolean {
  if (isMobileUA(ua)) return true;
  return /Macintosh/i.test(ua) && maxTouchPoints > 1;
}

/** Pure decision: should the mobile UI be active given device + override? */
export function detectMobile({ ua, width, override }: DetectMobileInput): boolean {
  if (override === "on") return true;
  if (override === "off") return false;
  return isMobileUA(ua) || width <= WIDTH_BREAKPOINT;
}

export type MapRenderer = "canvas" | "lite";

/** Pure: the `core.noCanvas` value a given Map renderer needs. The canvas map
 *  needs the canvas ON (noCanvas false); the lite DOM map needs it OFF (true). */
export function desiredNoCanvas(renderer: MapRenderer): boolean {
  return renderer === "lite";
}
