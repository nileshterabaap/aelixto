import { ReactNode, memo } from "react";

interface KeepAliveProps {
  /** Route path this component represents */
  route: string;
  /** Current active route */
  currentRoute: string;
  /** Content to keep alive */
  children: ReactNode;
}

/**
 * KeepAlive wrapper that uses CSS display:none instead of unmounting.
 * This preserves scroll position, embed state, and React component state
 * while hiding the content when navigating away.
 * 
 * Memory-conscious: Only used for heavy routes like Home feed.
 */
export const KeepAlive = memo(({ route, currentRoute, children }: KeepAliveProps) => {
  const isActive = currentRoute === route;
  
  return (
    <div
      style={{ 
        // Only use display:none - avoid visibility:hidden as it can cause scroll issues
        display: isActive ? "block" : "none",
      }}
      // Hint to browser that this content may be hidden
      aria-hidden={!isActive}
    >
      {children}
    </div>
  );
});

KeepAlive.displayName = "KeepAlive";
