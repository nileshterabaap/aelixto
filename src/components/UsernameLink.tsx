import { Link } from "react-router-dom";

interface UsernameLinkProps {
  username: string;
  className?: string;
  children?: React.ReactNode;
}

/**
 * A clickable username that links to the user's profile.
 * Handles both @username and plain username formats.
 */
export const UsernameLink = ({ username, className = "", children }: UsernameLinkProps) => {
  // Remove @ prefix if present for the route
  const cleanUsername = username.startsWith('@') ? username.slice(1) : username;
  
  return (
    <Link 
      to={`/u/${cleanUsername}`}
      className={`hover:underline ${className}`}
      onClick={(e) => e.stopPropagation()}
    >
      {children || username}
    </Link>
  );
};

/**
 * Parses text and converts @mentions into clickable links.
 * Returns an array of React nodes (strings and UsernameLink components).
 */
export const parseTextWithMentions = (text: string): React.ReactNode[] => {
  if (!text) return [];
  
  // Match @username patterns (alphanumeric, underscores, periods)
  const mentionRegex = /@([a-zA-Z0-9_\.]+)/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;
  
  while ((match = mentionRegex.exec(text)) !== null) {
    // Add text before the mention
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    
    // Add the mention as a link
    const username = match[1];
    parts.push(
      <UsernameLink 
        key={`mention-${match.index}`} 
        username={username}
        className="font-semibold text-primary"
      >
        @{username}
      </UsernameLink>
    );
    
    lastIndex = match.index + match[0].length;
  }
  
  // Add remaining text after last mention
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  
  return parts.length > 0 ? parts : [text];
};
