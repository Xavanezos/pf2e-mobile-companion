import type { ReactNode } from "react";

export function Modal({ title, onClose, children }: {
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-[110000] flex items-end justify-center bg-black/60" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-2xl border-t border-zinc-700 bg-zinc-900 p-4"
        style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <span className="font-semibold">{title}</span>
          <button onClick={onClose} aria-label="Close" className="flex h-9 w-9 items-center justify-center text-zinc-400">
            <i className="fas fa-xmark" aria-hidden="true" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
