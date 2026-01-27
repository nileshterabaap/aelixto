import { useState, useMemo } from 'react';

interface CollapsibleCaptionProps {
  content: string;
  maxLength?: number;
  className?: string;
}

export const CollapsibleCaption = ({ 
  content, 
  maxLength = 150,
  className = "text-sm mb-3"
}: CollapsibleCaptionProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const shouldTruncate = content.length > maxLength;
  
  const displayedContent = useMemo(() => {
    if (!shouldTruncate || isExpanded) {
      return content;
    }
    // Find the last space before maxLength to avoid cutting words
    const truncateAt = content.lastIndexOf(' ', maxLength);
    return content.slice(0, truncateAt > 0 ? truncateAt : maxLength);
  }, [content, maxLength, isExpanded, shouldTruncate]);

  if (!content) return null;

  return (
    <p className={className}>
      {displayedContent}
      {shouldTruncate && (
        <>
          {!isExpanded && '... '}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
            className="text-muted-foreground hover:text-foreground transition-colors font-medium"
          >
            {isExpanded ? 'less' : 'more'}
          </button>
        </>
      )}
    </p>
  );
};
