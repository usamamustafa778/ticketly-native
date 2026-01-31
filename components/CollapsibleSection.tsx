import React, { useEffect, useRef } from 'react';
import { View, LayoutChangeEvent } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
} from 'react-native-reanimated';

const DURATION_MS = 500;

interface CollapsibleSectionProps {
  expanded: boolean;
  children: React.ReactNode;
}

export function CollapsibleSection({ expanded, children }: CollapsibleSectionProps) {
  const height = useSharedValue(0);
  const contentHeightRef = useRef(0);

  const easing = Easing.bezier(0.25, 0.1, 0.25, 1);
  const timingConfig = { duration: DURATION_MS, easing };

  useEffect(() => {
    if (expanded) {
      // Opening: animate from 0 to content height (top to bottom)
      const h = contentHeightRef.current;
      if (h > 0) height.value = withTiming(h, timingConfig);
    } else {
      // Closing: animate from content height to 0 (bottom to top)
      height.value = withTiming(0, timingConfig);
    }
  }, [expanded]);

  const onContentLayout = (e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    if (h > 0) {
      contentHeightRef.current = h;
      if (expanded) {
        // Opening: animate when we get layout (e.g. initial mount or section switch)
        height.value = withTiming(h, timingConfig);
      }
    }
  };

  const animatedStyle = useAnimatedStyle(() => ({
    height: height.value,
    overflow: 'hidden' as const,
  }));

  return (
    <Animated.View style={animatedStyle}>
      <View
        onLayout={onContentLayout}
        style={{ position: 'absolute', top: 0, left: 0, right: 0 }}
        collapsable={false}
      >
        {children}
      </View>
    </Animated.View>
  );
}
