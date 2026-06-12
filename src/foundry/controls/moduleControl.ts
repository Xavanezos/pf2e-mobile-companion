import type { UiMode, MapRenderer } from "../mobile";

/** Minimal shape of a Foundry v14 scene-control tool — the subset we set. */
export interface ControlTool {
  name: string;
  order: number;
  title: string;
  icon: string;
  toggle: boolean;
  active: boolean;
  onChange?: (event: Event, active: boolean) => void;
}

/** Minimal shape of a Foundry v14 scene control (a toolbar category). */
export interface ModuleControl {
  name: string;
  order: number;
  title: string;
  icon: string;
  tools: Record<string, ControlTool>;
  activeTool: string;
}

export interface ModuleControlInput {
  uiMode: UiMode;
  mapRenderer: MapRenderer;
  onSelectUiMode: (mode: UiMode) => void;
  onSelectMapRenderer: (value: MapRenderer) => void;
}

const UI_MODE_TOOLS: ReadonlyArray<{ value: UiMode; title: string; icon: string }> = [
  { value: "auto", title: "Automatic", icon: "fa-solid fa-wand-magic-sparkles" },
  { value: "on", title: "Always on", icon: "fa-solid fa-mobile-screen" },
  { value: "off", title: "Always off", icon: "fa-solid fa-desktop" },
];

const MAP_RENDERER_TOOLS: ReadonlyArray<{ value: MapRenderer; title: string; icon: string }> = [
  { value: "canvas", title: "Foundry canvas", icon: "fa-solid fa-map" },
  { value: "lite", title: "Lite", icon: "fa-solid fa-image" },
];

/**
 * Build the module's scene-controls category. Pure: callers inject the current
 * setting values and the select callbacks, so this has no Foundry dependency.
 *
 * Each choice is a `toggle` tool whose `active` flag mirrors the current setting
 * value (radio behaviour). Tapping a tool fires its select callback with that
 * tool's value, regardless of the toggle's new on/off state — re-selecting the
 * already-active value is a harmless no-op that keeps it highlighted.
 */
export function buildModuleControl(input: ModuleControlInput): ModuleControl {
  const { uiMode, mapRenderer, onSelectUiMode, onSelectMapRenderer } = input;
  const tools: Record<string, ControlTool> = {};
  let order = 0;

  for (const t of UI_MODE_TOOLS) {
    tools[`uiMode-${t.value}`] = {
      name: `uiMode-${t.value}`,
      order: order++,
      title: t.title,
      icon: t.icon,
      toggle: true,
      active: uiMode === t.value,
      onChange: () => onSelectUiMode(t.value),
    };
  }

  for (const t of MAP_RENDERER_TOOLS) {
    tools[`map-${t.value}`] = {
      name: `map-${t.value}`,
      order: order++,
      title: t.title,
      icon: t.icon,
      toggle: true,
      active: mapRenderer === t.value,
      onChange: () => onSelectMapRenderer(t.value),
    };
  }

  return {
    name: "pf2e-mobile-companion",
    order: 100,
    title: "PF2e Mobile",
    icon: "fa-solid fa-mobile-screen",
    tools,
    activeTool: "uiMode-auto",
  };
}
