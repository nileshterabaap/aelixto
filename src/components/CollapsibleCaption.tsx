import { useState, useRef, useLayoutEffect, useCallback } from 'react';
import { parseTextWithMentions } from './UsernameLink';

interface CollapsibleCaptionProps {
  content: string;
  maxLines?: number;
  className?: string;
  username?: string;
}

export const CollapsibleCaption = ({ 
  content, 
  maxLines = 2,
  className = "text-sm mb-3",
  username
}: CollapsibleCaptionProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isTruncated, setIsTruncated] = useState(false);
  const textRef = useRef<HTMLSpanElement>(null);

  const measure = useCallback(() => {
    const el = textRef.current;
    if (!el || isExpanded) return;
    const isOverflowing = el.scrollHeight > el.clientHeight + 1;
    setIsTruncated(isOverflowing);
  }, [isExpanded]);

  // Measure on mount and content change
  useLayoutEffect(() => {
    measure();
    // Also measure after fonts load and after a short delay for layout settle
    const raf = requestAnimationFrame(measure);
    const timer = setTimeout(measure, 150);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
    };
  }, [content, isExpanded, measure]);

  if (!content) return null;

  const parsedContent = parseTextWithMentions(content);

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
        {username && <UsernameLink username={username} className="font-bold mr-1">{username}</UsernameLink>}
        {parsedContent}
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