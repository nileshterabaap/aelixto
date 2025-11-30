import { useState } from 'react';

interface InstagramCaptionDisplayProps {
  caption: string;
  maxLength?: number;
}

export const InstagramCaptionDisplay = ({ caption, maxLength = 125 }: InstagramCaptionDisplayProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  if (!caption || caption.length <= maxLength) {
    return (
      <div className="text-sm text-foreground/80 mt-2 px-1">
        {caption}
      </div>
    );
  }

  const truncatedText = caption.substring(0, maxLength);

  return (
    <div className="text-sm text-foreground/80 mt-2 px-1">
      {isExpanded ? (
        <span>{caption}</span>
      ) : (
        <>
          <span>{truncatedText}... </span>
          <button 
            onClick={() => setIsExpanded(true)}
            className="text-muted-foreground hover:text-foreground transition-colors font-normal"
          >
            more
          </button>
        </>
      )}
    </div>
  );
};
