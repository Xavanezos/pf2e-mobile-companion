import type { ToggleView } from "../../foundry/actor/types";

/** Pinned strip of combat roll-option toggles (Rage / Panache / stance …). Each is a
 *  `<label>`+`<input type=checkbox>` — NOT a bordered `<button>` (Tailwind-v4 reset).
 *  `alwaysActive` toggles arrive checked + disabled. Renders nothing when empty. */
export function ToggleBar({ toggles, onToggle }: {
  toggles: ToggleView[];
  onToggle: (toggle: ToggleView, value: boolean) => void;
}) {
  if (toggles.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2 border-b border-zinc-800 bg-zinc-950 px-3 py-2">
      {toggles.map((t) => (
        <label
          key={`${t.domain}:${t.option}:${t.itemId}`}
          className={`flex items-center gap-1.5 rounded-md bg-zinc-800 px-2 py-1 text-xs font-medium ${t.enabled ? "cursor-pointer text-zinc-100" : "cursor-not-allowed text-zinc-500"}`}
        >
          <input
            type="checkbox"
            checked={t.checked}
            disabled={!t.enabled}
            onChange={(e) => onToggle(t, e.target.checked)}
            className="h-3.5 w-3.5 accent-indigo-500"
          />
          <span>{t.label}</span>
        </label>
      ))}
    </div>
  );
}
