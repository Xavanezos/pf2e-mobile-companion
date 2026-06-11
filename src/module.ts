import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App";

const MODULE_ID = "pf2e-mobile-companion";

Hooks.once("init", () => {
  console.log(`${MODULE_ID} | init hook fired — module loaded`);
});

Hooks.once("ready", () => {
  console.log(`${MODULE_ID} | ready hook fired — mounting React app`);

  // Remove any stale root (e.g. after a Vite full reload) before mounting.
  document.getElementById(`${MODULE_ID}-root`)?.remove();

  const container = document.createElement("div");
  container.id = `${MODULE_ID}-root`;
  document.body.appendChild(container);

  createRoot(container).render(createElement(App));
});
