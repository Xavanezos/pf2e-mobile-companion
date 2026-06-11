import { useEffect } from "react";
import { useChatStore } from "../chatStore";
import { useAppStore } from "../store";

const TONE: Record<string, string> = {
  criticalSuccess: "border-emerald-400",
  success: "border-emerald-500",
  failure: "border-rose-500",
  criticalFailure: "border-rose-400",
};

/** Cross-tab peek at your latest result. Auto-dismisses after 5s; tap → Chat
 *  tab. Hidden while the Chat tab is already open. */
export function ChatToast() {
  const toast = useChatStore((s) => s.toast);
  const dismiss = useChatStore((s) => s.dismissToast);
  const activeTab = useAppStore((s) => s.activeTab);
  const setActiveTab = useAppStore((s) => s.setActiveTab);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(dismiss, 5000);
    return () => clearTimeout(t);
  }, [toast, dismiss]);

  if (!toast || activeTab === "chat") return null;

  return (
    <button
      onClick={() => { setActiveTab("chat"); dismiss(); }}
      className={`fixed inset-x-3 bottom-20 z-[105000] flex items-center justify-between gap-3 rounded-xl border-l-4 bg-zinc-800/95 px-4 py-3 text-left shadow-lg ${TONE[toast.outcome ?? ""] ?? "border-zinc-600"}`}
    >
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold">{toast.title}</span>
        {toast.outcomeLabel && <span className="text-xs text-zinc-300">{toast.outcomeLabel}</span>}
      </span>
      {toast.total != null && <span className="shrink-0 text-xl font-bold tabular-nums">{toast.total}</span>}
    </button>
  );
}
