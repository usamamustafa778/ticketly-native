import React from 'react';
import { View, TouchableOpacity, ViewStyle } from 'react-native';
import { card, type Size } from '@/lib/designSystem';

interface CardProps {
  children: React.ReactNode;
  size?: Size;
  onPress?: () => void;
  className?: string;
  bordered?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  size = 'sm',
  onPress,
  className = '',
  bordered = true,
}) => {
  const baseClasses = `${card[size]} ${bordered ? 'border border-gray-200' : ''} rounded-lg ${className}`;

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7} className={baseClasses}>
        {children}
      </TouchableOpacity>
    );
  }

  return <View className={baseClasses}>{children}</View>;
};
