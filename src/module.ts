const MODULE_ID = "pf2e-mobile-companion";

// Hooks are registered synchronously at module-eval time so they exist before
// Foundry fires `init`. The React app (App.tsx) is imported lazily inside the
// `ready` handler — never statically — because in dev it carries
// @vitejs/plugin-react's Fast Refresh guard, which throws unless the Refresh
// preamble has been installed first (see installReactRefreshPreamble).
Hooks.once("init", () => {
  console.log(`${MODULE_ID} | init hook fired — module loaded`);
});

Hooks.once("ready", async () => {
  console.log(`${MODULE_ID} | ready hook fired — mounting React app`);

  await installReactRefreshPreamble();

  const { createElement } = await import("react");
  const { createRoot } = await import("react-dom/client");
  const { App } = await import("./app/App");

  document.getElementById(`${MODULE_ID}-root`)?.remove();
  const container = document.createElement("div");
  container.id = `${MODULE_ID}-root`;
  document.body.appendChild(container);

  createRoot(container).render(createElement(App));
});

/**
 * Vite normally injects @vitejs/plugin-react's Fast Refresh preamble into
 * index.html. Foundry serves its own HTML, so we install it ourselves before
 * any React component module loads. Dev-only: `import.meta.env.DEV` is false in
 * production builds, so this whole block is stripped.
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
