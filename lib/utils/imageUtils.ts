import { API_BASE_URL } from '@/lib/config';

/**
 * Helper to get the full URL for an event image.
 * Uses imageUrl from API; rewrites to current API_BASE_URL for dynamic backend switching.
 */
export const getEventImageUrl = (event: { image?: string | null; imageUrl?: string | null }): string | null => {
  const baseUrl = API_BASE_URL.replace('/api', '');
  const urlOrPath = event?.imageUrl ?? event?.image;
  if (!urlOrPath) return null;

  // Extract path from full URL or use as path
  let path: string;
  if (urlOrPath.startsWith('http://') || urlOrPath.startsWith('https://')) {
    try {
      path = new URL(urlOrPath).pathname;
    } catch {
      const i = urlOrPath.indexOf('/uploads');
      path = i !== -1 ? urlOrPath.substring(i) : urlOrPath;
    }
  } else {
    path = urlOrPath.startsWith('/') ? urlOrPath : `/${urlOrPath}`;
  }
  return path ? `${baseUrl}${path}` : null;
};

/**
 * Helper to get the full URL for a profile image.
 * Uses profileImageUrl from API; rewrites to current API_BASE_URL for dynamic backend switching.
 */
export const getProfileImageUrl = (user: { profileImageUrl?: string | null }): string | null => {
  const baseUrl = API_BASE_URL.replace('/api', '');
  const urlOrPath = user?.profileImageUrl;
  if (!urlOrPath) return null;

  let path: string;
  if (urlOrPath.startsWith('http://') || urlOrPath.startsWith('https://')) {
    try {
      path = new URL(urlOrPath).pathname;
    } catch {
      const i = urlOrPath.indexOf('/uploads');
      path = i !== -1 ? urlOrPath.substring(i) : urlOrPath;
    }
  } else {
    path = urlOrPath.startsWith('/') ? urlOrPath : `/${urlOrPath}`;
  }
  return path ? `${baseUrl}${path}` : null;
};

