import { useAppStore } from "./store";
import { SheetTab } from "./SheetTab";
import { Placeholder } from "./tabs/Placeholder";

export function TabContent() {
  const activeTab = useAppStore((s) => s.activeTab);
  switch (activeTab) {
    case "sheet":
      return <SheetTab />;
    case "actions":
      return <Placeholder title="Actions & Macros" phase="Coming in Phase 4" />;
    case "combat":
      return <Placeholder title="Combat Tracker" phase="Coming in Phase 5" />;
    case "journal":
      return <Placeholder title="Journals" phase="Coming in Phase 6" />;
    case "map":
      return <Placeholder title="Battle Map" phase="Coming in Phase 7" />;
    default:
      return null;
  }
}
