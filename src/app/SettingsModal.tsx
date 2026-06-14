import { useState } from "react";
import { Modal } from "./sheet/parts/Modal";
import {
  getMapRenderer, setMapRenderer,
  getDefaultTab, setDefaultTab,
  getFontScale, setFontScale, applyFontScale,
  getVibrate, setVibrate,
} from "../foundry/settings";
import type { MapRenderer, FontScale } from "../foundry/mobile";
import { TAB_IDS, coerceTabId } from "./store";
import type { TabId } from "./store";

const MAP_RENDERER_CHOICES: { value: MapRenderer; label: string }[] = [
  { value: "canvas", label: "Foundry canvas (full)" },
  { value: "lite", label: "Lite (fast)" },
];

const TAB_LABELS: Record<TabId, string> = {
  sheet: "Sheet",
  actions: "Actions",
  combat: "Combat",
  chat: "Chat",
  journal: "Journal",
  map: "Map",
};

const FONT_SCALE_CHOICES: { value: FontScale; label: string }[] = [
  { value: "small", label: "Small" },
  { value: "medium", label: "Medium" },
  { value: "large", label: "Large" },
];

function Group<T extends string>({ heading, choices, selected, onSelect }: {
  heading: string;
  choices: { value: T; label: string }[];
  selected: T;
  onSelect: (value: T) => void;
}) {
  return (
    <div className="mb-4 last:mb-0">
      <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-400">
        {heading}
      </div>
      <div className="grid gap-1">
        {choices.map((c) => {
          const active = c.value === selected;
          return (
            <button
              key={c.value}
              onClick={() => onSelect(c.value)}
              className={`flex min-h-12 items-center justify-start gap-2 rounded-md px-3 text-left text-sm font-medium ${
                active ? "bg-zinc-700 ring-2 ring-amber-500" : "bg-zinc-800"
              }`}
            >
              <i
                className={`fas fa-check w-4 ${active ? "text-amber-400" : "invisible"}`}
                aria-hidden="true"
              />
              {c.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function SettingsModal({ onClose }: { onClose: () => void }) {
  const [mapRenderer, setMapRendererState] = useState<MapRenderer>(getMapRenderer());
  const [defaultTab, setDefaultTabState] = useState<TabId>(coerceTabId(getDefaultTab()));
  const [fontScale, setFontScaleState] = useState<FontScale>(getFontScale());
  const [vibrate, setVibrateState] = useState<boolean>(getVibrate());

  return (
    <Modal title="Settings" onClose={onClose}>
      <Group
        heading="Battle map renderer"
        choices={MAP_RENDERER_CHOICES}
        selected={mapRenderer}
        onSelect={(value) => { setMapRendererState(value); void setMapRenderer(value); }}
      />
      <Group
        heading="Default tab"
        choices={TAB_IDS.map((id) => ({ value: id, label: TAB_LABELS[id] }))}
        selected={defaultTab}
        onSelect={(value) => { setDefaultTabState(value); void setDefaultTab(value); }}
      />
      <Group
        heading="Font size"
        choices={FONT_SCALE_CHOICES}
        selected={fontScale}
        onSelect={(value) => {
          setFontScaleState(value);
          applyFontScale(value);
          void setFontScale(value);
        }}
      />
      <Group
        heading="Vibrate on your turn"
        choices={[{ value: "on", label: "On" }, { value: "off", label: "Off" }]}
        selected={vibrate ? "on" : "off"}
        onSelect={(value) => {
          const on = value === "on";
          setVibrateState(on);
          void setVibrate(on);
        }}
      />
    </Modal>
  );
}
