/**
 * Callback when session expires (refresh token failed or missing).
 * Registered by the app so the API client can trigger logout without importing the store.
 */
let onSessionExpired: (() => void) | null = null;

export function setOnSessionExpired(callback: (() => void) | null): void {
  onSessionExpired = callback;
}

export function getOnSessionExpired(): (() => void) | null {
  return onSessionExpired;
}

export function triggerSessionExpired(): void {
  onSessionExpired?.();
}
