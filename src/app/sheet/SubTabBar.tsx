import { useAppStore, type SheetSubTab } from "../store";

const SUB_TABS: { id: SheetSubTab; label: string }[] = [
  { id: "vitals", label: "Vitals" },
  { id: "skills", label: "Skills" },
  { id: "items", label: "Items" },
  { id: "feats", label: "Feats" },
  { id: "bio", label: "Bio" },
];

export function SubTabBar() {
  const active = useAppStore((s) => s.sheetSubTab);
  const setActive = useAppStore((s) => s.setSheetSubTab);
  return (
    <nav className="flex shrink-0 gap-1 overflow-x-auto border-b border-zinc-800 bg-zinc-900 px-2 py-1">
      {SUB_TABS.map((t) => (
        <button
          key={t.id}
          onClick={() => setActive(t.id)}
          className={`min-h-11 whitespace-nowrap rounded-md px-3 text-sm font-medium ${
            active === t.id ? "bg-indigo-600 text-white" : "text-zinc-400"
          }`}
        >
          {t.label}
        </button>
      ))}
    </nav>
  );
}
