/** Renders a PF2e action-economy glyph from the mapper's code
 *  ("1" | "2" | "3" | "reaction" | "free"). Font-independent fallback. */
export function ActionGlyph({ code }: { code: string | null }) {
  if (!code) return null;
  if (code === "reaction") return <i className="fas fa-bolt text-amber-300" title="Reaction" aria-label="Reaction" />;
  if (code === "free") return <span className="text-xs font-bold text-emerald-300" title="Free action">◇</span>;
  return (
    <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-zinc-700 text-[10px] font-bold" title={`${code} actions`}>
      {code}
    </span>
  );
}
