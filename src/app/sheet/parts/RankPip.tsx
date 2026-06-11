const RANK_LETTER = ["U", "T", "E", "M", "L"] as const;
const RANK_TONE = ["text-zinc-500", "text-zinc-300", "text-sky-300", "text-violet-300", "text-amber-300"] as const;

/** Proficiency rank as a single letter U/T/E/M/L. */
export function RankPip({ rank }: { rank: 0 | 1 | 2 | 3 | 4 }) {
  return <span className={`w-4 text-center text-xs font-bold ${RANK_TONE[rank]}`} title={`Rank ${rank}`}>{RANK_LETTER[rank]}</span>;
}
