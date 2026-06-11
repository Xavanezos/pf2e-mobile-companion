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

/** Pure decision: should the mobile UI be active given device + override? */
export function detectMobile({ ua, width, override }: DetectMobileInput): boolean {
  if (override === "on") return true;
  if (override === "off") return false;
  return isMobileUA(ua) || width <= WIDTH_BREAKPOINT;
}
