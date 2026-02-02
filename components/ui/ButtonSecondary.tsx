import React from 'react';
import { Button } from '@/components/ui/Button';
import type { Size } from '@/lib/designSystem';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

export interface ButtonSecondaryProps {
  children: string;
  onPress: () => void;
  size?: Size;
  disabled?: boolean;
  loading?: boolean;
  icon?: keyof typeof MaterialIcons.glyphMap;
  iconPosition?: 'left' | 'right';
  className?: string;
  fullWidth?: boolean;
}

/**
 * Secondary button – secondary actions (e.g. Cancel, Back).
 */
export const ButtonSecondary: React.FC<ButtonSecondaryProps> = (props) => (
  <Button {...props} variant="secondary" />
);
