import { describe, it, expect } from "vitest";
import { isMobileUA, isMobileDevice } from "../src/foundry/mobile";

const DESKTOP_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";
const ANDROID_UA =
  "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36";
const IPHONE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
// iPadOS 13+ Safari masquerades as desktop macOS — no "iPad" token.
const IPAD_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15";

describe("isMobileUA", () => {
  it("detects Android phones", () => expect(isMobileUA(ANDROID_UA)).toBe(true));
  it("detects iPhones", () => expect(isMobileUA(IPHONE_UA)).toBe(true));
  it("rejects desktop", () => expect(isMobileUA(DESKTOP_UA)).toBe(false));
  it("does not match a modern iPad / Mac UA on its own", () =>
    expect(isMobileUA(IPAD_UA)).toBe(false));
});

describe("isMobileDevice", () => {
  it("true for an Android phone", () =>
    expect(isMobileDevice({ ua: ANDROID_UA, maxTouchPoints: 5 })).toBe(true));
  it("true for an iPhone", () =>
    expect(isMobileDevice({ ua: IPHONE_UA, maxTouchPoints: 5 })).toBe(true));
  it("true for a modern iPad (Macintosh UA + multi-touch)", () =>
    expect(isMobileDevice({ ua: IPAD_UA, maxTouchPoints: 5 })).toBe(true));
  it("false for a MacBook (Macintosh UA, no touchscreen)", () =>
    expect(isMobileDevice({ ua: IPAD_UA, maxTouchPoints: 0 })).toBe(false));
  it("false for a wide desktop", () =>
    expect(isMobileDevice({ ua: DESKTOP_UA, maxTouchPoints: 0 })).toBe(false));
  it("false for a touchscreen Windows laptop (Windows UA + multi-touch)", () =>
    expect(isMobileDevice({ ua: DESKTOP_UA, maxTouchPoints: 10 })).toBe(false));
});
