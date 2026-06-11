import { describe, it, expect } from "vitest";
import { detectMobile, isMobileUA } from "../src/foundry/mobile";

const DESKTOP_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";
const ANDROID_UA =
  "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36";

describe("isMobileUA", () => {
  it("detects Android phones", () => expect(isMobileUA(ANDROID_UA)).toBe(true));
  it("rejects desktop", () => expect(isMobileUA(DESKTOP_UA)).toBe(false));
});

describe("detectMobile override", () => {
  it("forces on regardless of device", () =>
    expect(detectMobile({ ua: DESKTOP_UA, width: 1920, override: "on" })).toBe(true));
  it("forces off regardless of device", () =>
    expect(detectMobile({ ua: ANDROID_UA, width: 360, override: "off" })).toBe(false));
});

describe("detectMobile auto", () => {
  it("true for a mobile UA even on a wide viewport", () =>
    expect(detectMobile({ ua: ANDROID_UA, width: 1200, override: "auto" })).toBe(true));
  it("true for a narrow viewport (DevTools emulation) even with desktop UA", () =>
    expect(detectMobile({ ua: DESKTOP_UA, width: 800, override: "auto" })).toBe(true));
  it("false for a wide desktop", () =>
    expect(detectMobile({ ua: DESKTOP_UA, width: 1920, override: "auto" })).toBe(false));
});
