import type { TabId } from "./store";
import { useAppStore } from "./store";

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: "sheet", label: "Sheet", icon: "fa-user" },
  { id: "actions", label: "Actions", icon: "fa-bolt" },
  { id: "combat", label: "Combat", icon: "fa-dice-d20" },
  { id: "journal", label: "Journal", icon: "fa-book-open" },
  { id: "map", label: "Map", icon: "fa-map" },
];

export function TabBar() {
  const activeTab = useAppStore((s) => s.activeTab);
  const setActiveTab = useAppStore((s) => s.setActiveTab);

  return (
    <nav
      className="flex shrink-0 border-t border-zinc-800 bg-zinc-900"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {TABS.map((tab) => {
        const active = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            aria-pressed={active}
            className={`flex flex-1 flex-col items-center gap-1 py-2 text-xs ${
              active ? "text-indigo-400" : "text-zinc-400"
            }`}
            style={{ minHeight: 56 }}
          >
            <i className={`fas ${tab.icon} text-lg`} aria-hidden="true" />
            <span>{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
