import { useState, useRef, useLayoutEffect } from 'react';

interface CollapsibleCaptionProps {
  content: string;
  maxLines?: number;
  className?: string;
}

export const CollapsibleCaption = ({ 
  content, 
  maxLines = 2,
  className = "text-sm mb-3"
}: CollapsibleCaptionProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isTruncated, setIsTruncated] = useState(false);
  const textRef = useRef<HTMLSpanElement>(null);

  // Check if text overflows after 2 lines - use useLayoutEffect for accurate measurement
  useLayoutEffect(() => {
    const el = textRef.current;
    if (!el || isExpanded) return;
    
    // Force a reflow to ensure accurate measurement
    requestAnimationFrame(() => {
      if (el) {
        const isOverflowing = el.scrollHeight > el.clientHeight + 1; // +1 for rounding
        setIsTruncated(isOverflowing);
      }
    });
  }, [content, isExpanded]);

  if (!content) return null;

  return (
    <p className={className}>
      <span
        ref={textRef}
        style={!isExpanded ? { 
          display: '-webkit-box',
          WebkitLineClamp: maxLines,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden'
        } : undefined}
      >
        {content}
      </span>
      {isTruncated && !isExpanded && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsExpanded(true);
          }}
          className="text-muted-foreground hover:text-foreground transition-colors font-medium ml-1"
        >
          ... more
        </button>
      )}
      {isExpanded && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsExpanded(false);
          }}
          className="text-muted-foreground hover:text-foreground transition-colors font-medium ml-1"
        >
          less
        </button>
      )}
    </p>
  );
};