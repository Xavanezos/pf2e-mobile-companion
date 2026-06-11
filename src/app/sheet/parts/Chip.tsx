import type { ReactNode } from "react";

export function Chip({ children, tone = "default", onClick }: {
  children: ReactNode;
  tone?: "default" | "warn";
  onClick?: () => void;
}) {
  const tones = { default: "bg-zinc-800 text-zinc-200", warn: "bg-orange-900 text-orange-200" };
  const cls = `inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold ${tones[tone]}`;
  return onClick
    ? <button onClick={onClick} className={`${cls} min-h-0`}>{children}</button>
    : <span className={cls}>{children}</span>;
}
