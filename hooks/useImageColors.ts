import { useState, useCallback } from 'react';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';
import { imageColorsToTheme } from '@/lib/utils/colorUtils';
import type { TicketTheme } from '@/lib/types/ticketTheme';

export interface ExtractResult {
  theme: Partial<TicketTheme>;
  error?: string;
}

const EXPO_GO_MSG =
  'Color extraction is not available in Expo Go. Use a development build (EAS Build) or the web app to extract colors from images.';

/** react-native-image-colors is a native module - not available in Expo Go. */
export function useImageColors() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const extractThemeFromImage = useCallback(async (imageUrl: string | null): Promise<ExtractResult> => {
    if (!imageUrl) return { theme: {} };

    // Avoid loading native module in Expo Go - it will crash with "Cannot find native module 'ImageColors'"
    const isExpoGo =
      Platform.OS !== 'web' &&
      (Constants.appOwnership === 'expo' || Constants.executionEnvironment === ExecutionEnvironment.StoreClient);
    if (isExpoGo) {
      return { theme: {}, error: EXPO_GO_MSG };
    }

    setLoading(true);
    setError(null);
    try {
      const { getColors } = await import('react-native-image-colors');
      const colors = await getColors(imageUrl, {
        fallback: '#F59E0B',
        cache: true,
      });
      const theme = imageColorsToTheme(
        colors as {
          dominant?: string;
          vibrant?: string;
          darkVibrant?: string;
          lightVibrant?: string;
          darkMuted?: string;
          lightMuted?: string;
        }
      );
      return { theme };
    } catch (err: any) {
      const msg = err?.message || 'Failed to extract colors';
      setError(msg);
      const friendlyMsg =
        msg.includes('ImageColors') || msg.includes('native module')
          ? EXPO_GO_MSG
          : msg;
      return { theme: {}, error: friendlyMsg };
    } finally {
      setLoading(false);
    }
  }, []);

  return { extractThemeFromImage, loading, error };
}
