import { useAppStore } from "./store";
import { SheetTab } from "./SheetTab";
import { ChatTab } from "./tabs/ChatTab";
import { ActionsTab } from "./tabs/ActionsTab";
import { Placeholder } from "./tabs/Placeholder";

export function TabContent() {
  const activeTab = useAppStore((s) => s.activeTab);
  switch (activeTab) {
    case "sheet":
      return <SheetTab />;
    case "actions":
      return <ActionsTab />;
    case "combat":
      return <Placeholder title="Combat Tracker" phase="Coming in Phase 5" />;
    case "chat":
      return <ChatTab />;
    case "journal":
      return <Placeholder title="Journals" phase="Coming in Phase 6" />;
    case "map":
      return <Placeholder title="Battle Map" phase="Coming in Phase 7" />;
    default:
      return null;
  }
}
