import React from 'react';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { iconSize as designIconSize, type Size } from '@/lib/designSystem';

export const iconSize = designIconSize;

export type IconSize = keyof typeof designIconSize;

export interface IconProps {
  name: keyof typeof MaterialIcons.glyphMap;
  size?: IconSize | number;
  color?: string;
  className?: string;
  style?: React.ComponentProps<typeof MaterialIcons>['style'];
}

/**
 * Standard-size icon (MaterialIcons). Default size is md (16).
 * Use for consistent icon sizing across the app.
 */
export const Icon: React.FC<IconProps> = ({
  name,
  size = 'md',
  color = '#374151',
  className = '',
  style,
}) => {
  const numericSize =
    typeof size === 'number' ? size : designIconSize[size as IconSize];

  return (
    <MaterialIcons
      name={name}
      size={numericSize}
      color={color}
      style={style}
      className={className}
    />
  );
};
