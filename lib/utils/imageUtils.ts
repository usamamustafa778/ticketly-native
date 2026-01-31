import { API_BASE_URL } from '@/lib/config';

/**
 * Helper function to get the full URL for an event image
 * Similar to getProfileImageUrl for profile images
 * 
 * @param event - Event object with image and optional imageUrl properties
 * @returns Full URL string or null if no image
 */
export const getEventImageUrl = (event: { image?: string | null; imageUrl?: string | null }): string | null => {
  if (!event?.image) return null;

  // If imageUrl is provided, prefer it
  if (event.imageUrl) {
    // If backend returned a localhost URL (old data), rewrite it to use the current API base URL
    if (
      event.imageUrl.includes('localhost') ||
      event.imageUrl.includes('127.0.0.1')
    ) {
      // Strip `/api` from API_BASE_URL and keep only the path part from the original URL
      const baseUrl = API_BASE_URL.replace('/api', '');
      try {
        const url = new URL(event.imageUrl);
        const path = url.pathname || '';
        return `${baseUrl}${path}`;
      } catch {
        // Fallback: if URL parsing fails, try to find `/uploads` in the string
        const uploadsIndex = event.imageUrl.indexOf('/uploads');
        if (uploadsIndex !== -1) {
          const path = event.imageUrl.substring(uploadsIndex);
          return `${baseUrl}${path}`;
        }
      }
    }
    return event.imageUrl;
  }

  // Otherwise, construct from image and API_BASE_URL
  if (event.image.startsWith('http')) {
    return event.image;
  }

  // Remove /api from API_BASE_URL if present, then add image path
  const baseUrl = API_BASE_URL.replace('/api', '');
  return `${baseUrl}${event.image}`;
};

/**
 * Helper function to get the full URL for a profile image
 * Extracted from profile.tsx for reusability
 * 
 * @param user - User object with profileImage and optional profileImageUrl properties
 * @returns Full URL string or null if no image
 */
export const getProfileImageUrl = (user: { profileImage?: string | null; profileImageUrl?: string | null }): string | null => {
  if (!user?.profileImage) return null;

  // If profileImageUrl is provided, prefer it
  if (user.profileImageUrl) {
    // If backend returned a localhost URL (old data), rewrite it to use the current API base URL
    if (
      user.profileImageUrl.includes('localhost') ||
      user.profileImageUrl.includes('127.0.0.1')
    ) {
      // Strip `/api` from API_BASE_URL and keep only the path part from the original URL
      const baseUrl = API_BASE_URL.replace('/api', '');
      try {
        const url = new URL(user.profileImageUrl);
        const path = url.pathname || '';
        return `${baseUrl}${path}`;
      } catch {
        // Fallback: if URL parsing fails, try to find `/uploads` in the string
        const uploadsIndex = user.profileImageUrl.indexOf('/uploads');
        if (uploadsIndex !== -1) {
          const path = user.profileImageUrl.substring(uploadsIndex);
          return `${baseUrl}${path}`;
        }
      }
    }
    return user.profileImageUrl;
  }

  // Otherwise, construct from profileImage and API_BASE_URL
  if (user.profileImage.startsWith('http')) {
    return user.profileImage;
  }

  // Remove /api from API_BASE_URL if present, then add profileImage
  const baseUrl = API_BASE_URL.replace('/api', '');
  return `${baseUrl}${user.profileImage}`;
};

