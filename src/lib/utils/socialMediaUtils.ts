/**
 * Utility functions for processing social media handles
 */

/**
 * Cleans a Twitter handle by removing URLs, @ symbols, and extracting just the username
 * @param handle - The raw Twitter handle or URL
 * @returns The cleaned username without @ symbol
 */
export function cleanTwitterHandle(handle: string | null | undefined): string {
  if (!handle) return '';
  
  // Remove whitespace
  handle = handle.trim();
  
  // If it's a full Twitter URL, extract the username
  if (handle.includes('twitter.com/') || handle.includes('x.com/')) {
    const match = handle.match(/(?:twitter\.com\/|x\.com\/)([^/?#]+)/);
    if (match && match[1]) {
      return match[1];
    }
  }
  
  // Remove @ symbol if present
  if (handle.startsWith('@')) {
    return handle.substring(1);
  }
  
  return handle;
}

/**
 * Cleans an Instagram handle by removing URLs, @ symbols, and extracting just the username
 * @param handle - The raw Instagram handle or URL
 * @returns The cleaned username without @ symbol
 */
export function cleanInstagramHandle(handle: string | null | undefined): string {
  if (!handle) return '';
  
  // Remove whitespace
  handle = handle.trim();
  
  // If it's a full Instagram URL, extract the username
  if (handle.includes('instagram.com/')) {
    const match = handle.match(/instagram\.com\/([^/?#]+)/);
    if (match && match[1]) {
      return match[1];
    }
  }
  
  // Remove @ symbol if present
  if (handle.startsWith('@')) {
    return handle.substring(1);
  }
  
  return handle;
}

/**
 * Formats a social media handle for display (adds @ symbol)
 * @param handle - The username without @ symbol
 * @returns The formatted handle with @ symbol
 */
export function formatSocialHandle(handle: string | null | undefined): string {
  if (!handle) return '';
  return handle.startsWith('@') ? handle : `@${handle}`;
}

/**
 * Constructs a Twitter URL from a handle
 * @param handle - The Twitter handle (with or without @)
 * @returns The full Twitter URL
 */
export function getTwitterUrl(handle: string | null | undefined): string {
  if (!handle) return '';
  const cleanHandle = cleanTwitterHandle(handle);
  return cleanHandle ? `https://twitter.com/${cleanHandle}` : '';
}

/**
 * Constructs an Instagram URL from a handle
 * @param handle - The Instagram handle (with or without @)
 * @returns The full Instagram URL
 */
export function getInstagramUrl(handle: string | null | undefined): string {
  if (!handle) return '';
  const cleanHandle = cleanInstagramHandle(handle);
  return cleanHandle ? `https://instagram.com/${cleanHandle}` : '';
} 