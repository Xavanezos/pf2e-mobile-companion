const MOBILE_UA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i;

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

export type MapRenderer = "canvas" | "lite";

/** Pure: the `core.noCanvas` value a given Map renderer needs. The canvas map
 *  needs the canvas ON (noCanvas false); the lite DOM map needs it OFF (true). */
export function desiredNoCanvas(renderer: MapRenderer): boolean {
  return renderer === "lite";
}

export type FontScale = "small" | "medium" | "large";

/** Root font-size in px for a scale. The UI is rem-based, so applying this to the
 *  document root scales the whole app. Unknown values fall back to medium. */
export function fontScalePx(scale: FontScale): number {
  switch (scale) {
    case "small":
      return 14;
    case "large":
      return 18;
    default:
      return 16;
  }
}
