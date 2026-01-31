import { useEffect, useState } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';

/**
 * To support static rendering, this value needs to be re-calculated on the client side for web
 */
export function useColorScheme() {
  // Force a light theme across the app (white background).
  // Keep hooks here to avoid changing runtime behavior in unexpected ways.
  useEffect(() => {}, []);
  useRNColorScheme();
  return 'light' as const;
}
