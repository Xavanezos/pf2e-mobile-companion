/** A row of filled/empty pips flanked by explicit − / + steppers. Unlike `Pips`
 *  (tap-to-toggle), this gives an unambiguous add/remove affordance — used for
 *  hero points and the focus pool. Buttons disable at the 0..max bounds and when
 *  `onAdjust` is absent (read-only). Bordered buttons would vanish under our
 *  Tailwind v4 no-preflight setup, so steppers use bg/ring, not border. */
export function PipStepper({ value, max, label, onAdjust }: {
  value: number;
  max: number;
  label?: string;
  onAdjust?: (delta: 1 | -1) => void;
}) {
  const pips = Array.from({ length: max }, (_, i) => i < value);
  const btn =
    "flex h-6 w-6 items-center justify-center rounded-md bg-zinc-800 text-sm font-bold leading-none text-zinc-200 disabled:opacity-40";
  return (
    <div className="flex items-center gap-1.5">
      {label && <span className="text-xs uppercase tracking-wide text-zinc-500">{label}</span>}
      <button
        aria-label={`${label ?? "Pips"} minus`}
        disabled={!onAdjust || value <= 0}
        onClick={() => onAdjust?.(-1)}
        className={btn}
      >
        −
      </button>
      <div className="flex items-center gap-1">
        {pips.map((on, i) => (
          <span
            key={i}
            className={`h-3.5 w-3.5 rounded-full ${on ? "bg-amber-400" : "bg-zinc-700 ring-1 ring-inset ring-zinc-600"}`}
          />
        ))}
      </div>
      <button
        aria-label={`${label ?? "Pips"} plus`}
        disabled={!onAdjust || value >= max}
        onClick={() => onAdjust?.(1)}
        className={btn}
      >
        +
      </button>
    </div>
  );
}
