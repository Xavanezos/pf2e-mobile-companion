export function Placeholder({ title, phase }: { title: string; phase: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-zinc-500">
      <i className="fas fa-hammer text-3xl" aria-hidden="true" />
      <div className="text-lg font-semibold text-zinc-300">{title}</div>
      <div className="text-sm">{phase}</div>
    </div>
  );
}
