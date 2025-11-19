/**
 * Decode HTML entities in text
 * Converts &quot;, &#x2019;, etc. to their proper characters
 */
export function decodeHtmlEntities(text: string): string {
  if (!text) return text;
  
  // Create a temporary element to leverage browser's built-in HTML entity decoding
  const textarea = document.createElement('textarea');
  textarea.innerHTML = text;
  return textarea.value;
}
