import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface CollapsibleCaptionProps {
  content: string;
  maxChars?: number;
  className?: string;
}

const TRUNCATE_THRESHOLD = 25;

export const CollapsibleCaption = ({ 
  content, 
  maxChars = TRUNCATE_THRESHOLD,
  className = "text-sm mb-3"
}: CollapsibleCaptionProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  if (!content) return null;
  
  const shouldTruncate = content.length > maxChars;
  const truncatedText = shouldTruncate 
    ? content.slice(0, maxChars).trimEnd() 
    : content;

  return (
    <div className={className}>
      <AnimatePresence mode="wait" initial={false}>
        {!isExpanded ? (
          <motion.p
            key="collapsed"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="leading-relaxed"
          >
            {truncatedText}
            {shouldTruncate && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsExpanded(true);
                }}
                className="text-muted-foreground hover:text-foreground transition-colors font-medium"
              >
                ...more
              </button>
            )}
          </motion.p>
        ) : (
          <motion.div
            key="expanded"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ 
              duration: 0.4, 
              ease: [0.25, 0.1, 0.25, 1] // circOut approximation
            }}
            className="overflow-hidden"
          >
            <p className="leading-relaxed">
              {content}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsExpanded(false);
                }}
                className="text-muted-foreground hover:text-foreground transition-colors font-medium ml-1"
              >
                show less
              </button>
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
