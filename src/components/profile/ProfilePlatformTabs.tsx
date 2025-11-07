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
              transition-all whitespace-nowrap min-w-[140px]
              ${
                activeTab === tab.key
                  ? "bg-foreground text-background"
                  : "bg-background border-2 border-foreground/20 hover:border-foreground/40"
              }
            `}
          >
            <img src={tab.icon} alt={tab.label} className="h-5 w-5" />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};
