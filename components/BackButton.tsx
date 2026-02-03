import React from 'react';
import { TouchableOpacity } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

type BackButtonVariant = 'light' | 'dark';

interface BackButtonProps {
  onPress: () => void;
  variant?: BackButtonVariant;
  className?: string;
}

/**
 * Consistent back button used across all pages.
 * - light: On white/light backgrounds (bg-gray-100, dark icon)
 * - dark: On dark/image overlays (bg-black/50, white icon)
 */
export function BackButton({ onPress, variant = 'light', className = '' }: BackButtonProps) {
  const isDark = variant === 'dark';
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      className={`w-7 h-7 rounded-full items-center justify-center ${
        isDark ? 'bg-black/50' : 'bg-gray-100'
      } ${className}`}
    >
      <MaterialIcons
        name="arrow-back"
        size={18}
        color={isDark ? '#FFFFFF' : '#111827'}
      />
    </TouchableOpacity>
  );
}
