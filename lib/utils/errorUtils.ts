/**
 * Format API/axios error or API response object into a full readable error string for display.
 * Includes message, validation details, status code, etc.
 */
export function formatApiError(error: unknown, fallback = 'An error occurred'): string {
  if (!error || typeof error !== 'object') return fallback;

  const err = error as any;
  const parts: string[] = [];

  // Axios error: error.response.data, or API response object
  const data = err.response?.data ?? err;
  if (data && typeof data === 'object') {
    if (typeof data === 'string') {
      parts.push(data);
    } else {
      if (data.message) parts.push(String(data.message));
      if (data.event?.message && data.event.message !== data.message) parts.push(String(data.event.message));
      if (data.error && data.error !== data.message) parts.push(String(data.error));
      if (Array.isArray(data.details) && data.details.length > 0) {
        const detailStr = data.details
          .map((d: any) => (typeof d === 'string' ? d : d.message || JSON.stringify(d)))
          .join('; ');
        parts.push(detailStr);
      }
      if (data.errors && typeof data.errors === 'object') {
        const errArr = Object.entries(data.errors).map(([k, v]) => `${k}: ${v}`);
        parts.push(errArr.join('; '));
      }
    }
  }

  if (err.response?.status) {
    parts.push(`(Status: ${err.response.status})`);
  }

  if (parts.length === 0 && err.message) {
    parts.push(err.message);
  }

  if (parts.length === 0) {
    return fallback;
  }

  return parts.join(' ');
}
