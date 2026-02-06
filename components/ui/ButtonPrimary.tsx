import { Button } from '@/components/ui/Button';
import type { Size } from '@/lib/designSystem';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import React from 'react';

export interface ButtonPrimaryProps {
  children: string;
  onPress: () => void;
  size?: Size;
  paddingleft?: number;
  paddingright?: number;
  disabled?: boolean;
  loading?: boolean;
  icon?: keyof typeof MaterialIcons.glyphMap;
  iconPosition?: 'left' | 'right';
  className?: string;
  fullWidth?: boolean;
}

/**
 * Primary button – main actions (e.g. Submit, Create event, Login).
 */
export const ButtonPrimary: React.FC<ButtonPrimaryProps> = (props) => (
  <Button {...props} variant="primary" />
);
