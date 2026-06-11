/** A row of filled/empty pips. Optional onAdjust(delta) wires tap=+1 / tap-on-filled=-1. */
export function Pips({ value, max, label, onAdjust }: {
  value: number;
  max: number;
  label: string;
  onAdjust?: (delta: 1 | -1) => void;
}) {
  const pips = Array.from({ length: max }, (_, i) => i < value);
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs uppercase tracking-wide text-zinc-500">{label}</span>
      <div className="flex items-center gap-1">
        {pips.map((on, i) => (
          <button
            key={i}
            aria-label={`${label} ${i + 1}`}
            disabled={!onAdjust}
            onClick={() => onAdjust?.(i < value ? -1 : 1)}
            className={`h-4 w-4 rounded-full border ${on ? "border-amber-400 bg-amber-400" : "border-zinc-600 bg-transparent"}`}
          />
        ))}
      </div>
    </div>
  );
}
