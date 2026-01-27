import { useState, useRef, useEffect } from 'react';

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

  // Check if text overflows after 2 lines
  useEffect(() => {
    const el = textRef.current;
    if (el) {
      // Compare scrollHeight vs clientHeight to detect overflow
      setIsTruncated(el.scrollHeight > el.clientHeight);
    }
  }, [content]);

  if (!content) return null;

  return (
    <p className={className}>
      <span
        ref={textRef}
        className={isExpanded ? '' : 'line-clamp-2'}
        style={!isExpanded ? { 
          display: '-webkit-box',
          WebkitLineClamp: maxLines,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden'
        } : undefined}
      >
        {content}
      </span>
      {isTruncated && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsExpanded(!isExpanded);
          }}
          className="text-muted-foreground hover:text-foreground transition-colors font-medium ml-1"
        >
          {isExpanded ? 'less' : '... more'}
        </button>
      )}
    </p>
  );
};
