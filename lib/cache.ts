/**
 * Local storage cache for public API data.
 * Works for both logged-in and logged-out users - public data is always cached.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_PREFIX = 'cache_';

export const CACHE_KEYS = {
  EVENTS_APPROVED: `${CACHE_PREFIX}events_approved`,
  EVENT_BY_ID: (id: string) => `${CACHE_PREFIX}event_${id}`,
  USER_PROFILE_BY_ID: (id: string) => `${CACHE_PREFIX}user_${id}`,
  TICKET_BY_ID: (id: string) => `${CACHE_PREFIX}ticket_${id}`,
  /** GET /api/tickets/my response – list of user's tickets */
  TICKETS_MY: `${CACHE_PREFIX}tickets_my`,
} as const;

export async function getCached<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function setCached<T>(key: string, data: T): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.warn('Failed to cache data:', key, e);
  }
}

export async function removeCached(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key);
  } catch {
    // ignore
  }
}
