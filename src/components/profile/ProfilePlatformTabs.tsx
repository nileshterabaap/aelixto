import { PlatformTab } from "@/hooks/useUserPlatformTabs";

interface ProfilePlatformTabsProps {
  tabs: PlatformTab[];
  activeTab: string;
  onTabChange: (platform: string) => void;
}

export const ProfilePlatformTabs = ({
  tabs,
  activeTab,
  onTabChange,
}: ProfilePlatformTabsProps) => {
  if (tabs.length === 0) return null;

  return (
    <div className="mb-6 -mx-6 px-6 overflow-x-auto no-scrollbar">
      <div className="flex gap-2 min-w-max pb-2">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => onTabChange(tab.key)}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium
              transition-all whitespace-nowrap
              ${
                activeTab === tab.key
                  ? "bg-foreground text-background shadow-md"
                  : "border border-foreground/30 hover:bg-foreground/5"
              }
            `}
          >
            <img src={tab.icon} alt={tab.label} className="h-4 w-4" />
            <span>{tab.label}</span>
            <span className="text-xs opacity-70">({tab.count})</span>
          </button>
        ))}
      </div>
    </div>
  );
};
