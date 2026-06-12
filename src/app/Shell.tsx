import { useState } from "react";
import { useAppStore } from "./store";
import { TabBar } from "./TabBar";
import { TabContent } from "./TabContent";
import { useFullscreen } from "./useFullscreen";
import { useChatFeed } from "./chat/useChatFeed";
import { ChatToast } from "./chat/ChatToast";
import { useTurnAlert } from "./combat/useTurnAlert";
import { SettingsModal } from "./SettingsModal";

export function Shell() {
  const { isFullscreen, toggle } = useFullscreen();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const actorId = useAppStore((s) => s.actorId);
  useChatFeed();
  useTurnAlert(actorId);
  const title = actorId
    ? ((game as any).actors.get(actorId)?.name ?? "PF2e Mobile")
    : "PF2e Mobile";

  return (
    <div className="flex h-full w-full flex-col">
      <header
        className="flex shrink-0 items-center justify-between border-b border-zinc-800 bg-zinc-900 px-4 py-2"
        style={{ paddingTop: "max(0.5rem, env(safe-area-inset-top))" }}
      >
        <span className="truncate font-semibold">{title}</span>
        <div className="flex items-center gap-1">
          <button
            onClick={toggle}
            aria-label="Toggle fullscreen"
            className="flex h-10 w-10 items-center justify-center text-zinc-300"
          >
            <i
              className={`fas ${isFullscreen ? "fa-compress" : "fa-expand"}`}
              aria-hidden="true"
            />
          </button>
          <button
            onClick={() => setSettingsOpen(true)}
            aria-label="Settings"
            className="flex h-10 w-10 items-center justify-center text-zinc-300"
          >
            <i className="fas fa-gear" aria-hidden="true" />
          </button>
        </div>
      </header>
      <main className="min-h-0 flex-1 overflow-y-auto">
        <TabContent />
      </main>
      <TabBar />
      <ChatToast />
      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}
