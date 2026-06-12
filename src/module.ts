import { registerSettings, isMobileActive } from "./foundry/settings";
import { applyTakeover, removeTakeover, isTakeoverActive, reconcileMapRenderer } from "./foundry/takeover";
import { installStrikeRollDialogHook } from "./foundry/actor/strikeActions";

const MODULE_ID = "pf2e-mobile-companion";

// Hooks are registered synchronously at module-eval time so they exist before
// Foundry fires `init`.
Hooks.once("init", () => {
  console.log(`${MODULE_ID} | init`);
  registerSettings(
    () => { void onUiModeChange(); },
    () => { void reconcileMapRenderer(); },
  );
});

Hooks.once("ready", async () => {
  if (!isMobileActive()) {
    console.log(`${MODULE_ID} | desktop mode — leaving Foundry UI intact`);
    return;
  }
  console.log(`${MODULE_ID} | mobile mode — taking over`);
  installStrikeRollDialogHook();
  await installReactRefreshPreamble();
  await applyTakeover(mountApp);
});

/** Re-evaluate when the user flips the UI-mode setting at runtime. */
async function onUiModeChange(): Promise<void> {
  const shouldBeMobile = isMobileActive();
  const active = isTakeoverActive();
  if (shouldBeMobile && !active) {
    installStrikeRollDialogHook();
    await installReactRefreshPreamble();
    await applyTakeover(mountApp);
  } else if (!shouldBeMobile && active) {
    await removeTakeover();
  }
}

/** Lazily import React + the app (kept out of static imports so the dev Fast
 *  Refresh preamble is installed first). */
async function mountApp(container: HTMLElement): Promise<void> {
  const { createElement } = await import("react");
  const { createRoot } = await import("react-dom/client");
  const { App } = await import("./app/App");
  createRoot(container).render(createElement(App));
}

/**
 * Vite injects @vitejs/plugin-react's Fast Refresh preamble into index.html;
 * Foundry serves its own HTML, so we install it ourselves before any React
 * module loads. Dev-only — stripped from production builds.
 */
async function installReactRefreshPreamble(): Promise<void> {
  if (!import.meta.env.DEV) return;
  const win = window as unknown as Record<string, unknown>;
  if (win.__vite_plugin_react_preamble_installed__) return;

  const mod = await import(/* @vite-ignore */ `${import.meta.env.BASE_URL}@react-refresh`);
  const RefreshRuntime = mod.default ?? mod;
  RefreshRuntime.injectIntoGlobalHook(window);
  win.$RefreshReg$ = () => {};
  win.$RefreshSig$ = () => (type: unknown) => type;
  win.__vite_plugin_react_preamble_installed__ = true;
}
