import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Dynamic bottom padding based on system navigation mode (useSafeAreaInsets).
 *
 * - Gestures enabled (insets.bottom > 0): Apply safe area for home indicator clearance.
 * - Buttons enabled (insets.bottom === 0): Use minimal padding (10px).
 *
 * @param extraSpacing - Additional padding when gestures (default 20). When buttons, uses 10.
 * @returns bottomPadding for content that sits above the tab bar
 */
export function useBottomPadding(extraSpacing = 20) {
  const insets = useSafeAreaInsets();

  const hasHomeIndicator = insets.bottom > 0;
  const tabBarBaseHeight = Platform.OS === 'ios' ? 56 : 52 + 2;
  const safeAreaBottom = hasHomeIndicator ? Math.max(insets.bottom, 6) : 0;
  const tabBarTotalHeight = tabBarBaseHeight + safeAreaBottom;
  const spacing = hasHomeIndicator ? extraSpacing : 10;

  return tabBarTotalHeight + spacing;
}
