import type { ReactNode } from "react";

export function StatRow({ label, value, right, onClick }: {
  label: ReactNode;
  value: ReactNode;
  right?: ReactNode;
  onClick?: () => void;
}) {
  const inner = (
    <>
      <span className="text-zinc-300">{label}</span>
      <span className="flex items-center gap-2 font-semibold tabular-nums">{value}{right}</span>
    </>
  );
  return onClick
    ? <button onClick={onClick} className="flex min-h-11 w-full items-center justify-between px-1 py-2 text-left">{inner}</button>
    : <div className="flex min-h-11 items-center justify-between px-1 py-2">{inner}</div>;
}
