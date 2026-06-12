import { useState } from "react";
import { Modal } from "./sheet/parts/Modal";
import {
  getUiMode, setUiMode, getMapRenderer, setMapRenderer,
} from "../foundry/settings";
import type { UiMode, MapRenderer } from "../foundry/mobile";

const UI_MODE_CHOICES: { value: UiMode; label: string }[] = [
  { value: "auto", label: "Automatic" },
  { value: "on", label: "Always on" },
  { value: "off", label: "Always off" },
];

const MAP_RENDERER_CHOICES: { value: MapRenderer; label: string }[] = [
  { value: "canvas", label: "Foundry canvas (full)" },
  { value: "lite", label: "Lite (fast)" },
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
  const [uiMode, setUiModeState] = useState<UiMode>(getUiMode());
  const [mapRenderer, setMapRendererState] = useState<MapRenderer>(getMapRenderer());

  return (
    <Modal title="Settings" onClose={onClose}>
      <Group
        heading="Mobile UI mode"
        choices={UI_MODE_CHOICES}
        selected={uiMode}
        onSelect={(value) => { setUiModeState(value); void setUiMode(value); }}
      />
      <Group
        heading="Battle map renderer"
        choices={MAP_RENDERER_CHOICES}
        selected={mapRenderer}
        onSelect={(value) => { setMapRendererState(value); void setMapRenderer(value); }}
      />
    </Modal>
  );
}
