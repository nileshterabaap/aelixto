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
    <div className="mb-6 overflow-x-auto no-scrollbar">
      <div className="flex gap-3 min-w-max pb-2">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => onTabChange(tab.key)}
            className={`
              flex items-center justify-center gap-2 px-6 py-3 rounded-full text-sm font-semibold
              transition-all whitespace-nowrap shadow-sm hover:shadow-md
              ${
                activeTab === tab.key
                  ? "bg-foreground text-background"
                  : "bg-background border border-foreground/30 text-foreground hover:bg-foreground/5"
              }
            `}
          >
            {tab.icon && (
              <img src={tab.icon} alt={tab.label} className="h-5 w-5 rounded-sm" />
            )}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};
