type TabId = "video" | "sources" | "comments" | "channel";

const TABS: { id: TabId; label: string }[] = [
  { id: "video", label: "VIDEO" },
  { id: "sources", label: "SOURCES" },
  { id: "comments", label: "COMMENTS" },
  { id: "channel", label: "CHANNEL" },
];

interface TabBarProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

export function TabBar({ activeTab, onTabChange }: TabBarProps) {
  return (
    <div className="flex border-b border-[var(--aptv-border)]">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`flex-1 py-2.5 text-xs font-semibold tracking-wider transition-colors ${
            activeTab === tab.id
              ? "text-[var(--aptv-gold)] border-b-2 border-[var(--aptv-gold)]"
              : "text-slate-500 hover:text-slate-300"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
