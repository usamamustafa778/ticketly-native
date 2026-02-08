import { API_BASE_URL, CLOUDINARY_IMAGE_BASE_URL } from '@/lib/config';

/** Inline placeholder when event has no image (no external requests). */
export const EVENT_PLACEHOLDER =
  'data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="450" viewBox="0 0 800 450"><rect fill="#374151" width="800" height="450"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#9ca3af" font-family="sans-serif" font-size="18">No image</text></svg>'
  );

/**
 * Backend origin (no /api) for legacy /uploads/ paths.
 */
const getBackendOrigin = (): string => API_BASE_URL.replace(/\/api\/?$/, '');

/**
 * Resolve image value from API to full URL for <Image source={{ uri }} />.
 * - Full URL (http/https) -> use as-is (backward compat).
 * - Legacy path /uploads/... -> prepend backend origin.
 * - Cloudinary relative path -> prepend CLOUDINARY_IMAGE_BASE_URL.
 */
export function resolveImageUrl(pathOrUrl: string | null | undefined): string | null {
  if (!pathOrUrl || typeof pathOrUrl !== 'string') return null;
  const trimmed = pathOrUrl.trim();
  if (!trimmed || trimmed === 'null' || trimmed === 'undefined') return null;

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    if (trimmed.includes('localhost') || trimmed.includes('127.0.0.1')) {
      try {
        const url = new URL(trimmed);
        return `${getBackendOrigin()}${url.pathname}`;
      } catch {
        const i = trimmed.indexOf('/uploads');
        if (i !== -1) return `${getBackendOrigin()}${trimmed.substring(i)}`;
      }
    }
    return trimmed;
  }

  if (trimmed.startsWith('/uploads/')) {
    return `${getBackendOrigin()}${trimmed}`;
  }

  if (CLOUDINARY_IMAGE_BASE_URL) {
    const path = trimmed.startsWith('/') ? trimmed.slice(1) : trimmed;
    return `${CLOUDINARY_IMAGE_BASE_URL}${path}`;
  }

  return trimmed;
}

/**
 * Full URL for event image. Backend returns relative path; we prepend base.
 */
export const getEventImageUrl = (event: { image?: string | null; imageUrl?: string | null }): string | null => {
  const urlOrPath = event?.imageUrl ?? event?.image;
  return resolveImageUrl(urlOrPath ?? null);
};

/**
 * Full URL for profile image. Backend returns relative path; we prepend base.
 */
export const getProfileImageUrl = (user: { profileImageUrl?: string | null; profileImage?: string | null }): string | null => {
  const urlOrPath = user?.profileImageUrl ?? user?.profileImage;
  return resolveImageUrl(urlOrPath ?? null);
};
