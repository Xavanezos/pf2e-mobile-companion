import { useState } from "react";
import { Modal } from "./parts/Modal";
import { parseAmount } from "../../foundry/actor/hp";

export type HpMode = "damage" | "heal" | "set";

export function HpNumpad({ hp, onSubmit, onSetTemp, onClose }: {
  hp: { value: number; temp: number; max: number };
  onSubmit: (mode: HpMode, amount: number) => void;
  onSetTemp: (value: number) => void;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<HpMode>("damage");
  const [raw, setRaw] = useState("");
  const [temp, setTemp] = useState(String(hp.temp));
  const amount = parseAmount(raw);
  const press = (d: string) => setRaw((r) => (r + d).slice(0, 4));
  const modes: HpMode[] = ["damage", "heal", "set"];

  return (
    <Modal title={`Hit Points — ${hp.value}/${hp.max}`} onClose={onClose}>
      <div className="mb-3 grid grid-cols-3 gap-1">
        {modes.map((m) => (
          <button key={m} onClick={() => setMode(m)}
            className={`min-h-11 rounded-md text-sm font-semibold capitalize ${mode === m ? "bg-indigo-600 text-white" : "bg-zinc-800 text-zinc-300"}`}>
            {m}
          </button>
        ))}
      </div>
      <div className="mb-2 text-center text-3xl font-bold tabular-nums">{raw || "0"}</div>
      <div className="grid grid-cols-3 gap-1">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
          <button key={d} onClick={() => press(d)} className="min-h-12 rounded-md bg-zinc-800 text-lg font-semibold">{d}</button>
        ))}
        <button onClick={() => setRaw("")} className="min-h-12 rounded-md bg-zinc-800 text-sm">Clr</button>
        <button onClick={() => press("0")} className="min-h-12 rounded-md bg-zinc-800 text-lg font-semibold">0</button>
        <button onClick={() => setRaw((r) => r.slice(0, -1))} aria-label="Backspace" className="min-h-12 rounded-md bg-zinc-800">
          <i className="fas fa-delete-left" aria-hidden="true" />
        </button>
      </div>
      <button onClick={() => { onSubmit(mode, amount); onClose(); }} disabled={amount === 0}
        className="mt-3 min-h-12 w-full rounded-md bg-emerald-600 font-semibold text-white disabled:opacity-40 capitalize">
        Apply {mode}
      </button>
      <div className="mt-3 flex items-center gap-2">
        <label className="text-sm text-zinc-400">Temp HP</label>
        <input inputMode="numeric" value={temp} onChange={(e) => setTemp(e.target.value)}
          className="w-16 rounded-md bg-zinc-800 px-2 py-1 text-center" />
        <button onClick={() => onSetTemp(parseAmount(temp))} className="min-h-11 rounded-md bg-zinc-700 px-3 text-sm">Set</button>
      </div>
    </Modal>
  );
}
