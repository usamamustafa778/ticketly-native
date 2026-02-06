import { button, type Size } from '@/lib/designSystem';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import React from 'react';
import { ActivityIndicator, Text, TouchableOpacity } from 'react-native';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'outline';

interface ButtonProps {
  children: string;
  onPress: () => void;
  size?: Size;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  icon?: keyof typeof MaterialIcons.glyphMap;
  iconPosition?: 'left' | 'right';
  className?: string;
  fullWidth?: boolean;
}

const variantStyles: Record<ButtonVariant, { bg: string; text: string; border?: string }> = {
  primary: { bg: 'bg-primary', text: 'text-white' },
  secondary: { bg: 'bg-gray-100', text: 'text-gray-900', border: 'border border-gray-200' },
  ghost: { bg: 'bg-transparent', text: 'text-gray-700' },
  outline: { bg: 'bg-transparent', text: 'text-primary', border: 'border border-primary' },
};

export const Button: React.FC<ButtonProps> = ({
  children,
  onPress,
  size = 'lg',
  variant = 'primary',
  disabled = false,
  loading = false,
  icon,
  iconPosition = 'left',
  className = '',
  fullWidth = false,
}) => {
  const preset = button[size];
  const variantStyle = variantStyles[variant];
  const iconSize = preset.icon;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.7}
      className={`
        flex-row items-center justify-center
        px-4
        ${preset.container}
        ${variantStyle.bg}
        ${variantStyle.border ?? ''}
        ${fullWidth ? 'w-full' : ''}
        ${disabled ? 'opacity-50' : ''}
        ${className}
      `}
    >
      {loading ? (
        <ActivityIndicator size="small" color={variant === 'primary' ? '#FFFFFF' : '#DC2626'} />
      ) : (
        <>
          {icon && iconPosition === 'left' && (
            <MaterialIcons name={icon} size={iconSize} color={variant === 'primary' ? '#FFFFFF' : '#374151'} style={{ marginRight: 6 }} />
          )}
          <Text className={`${preset.text} ${variantStyle.text} font-semibold`}>{children}</Text>
          {icon && iconPosition === 'right' && (
            <MaterialIcons name={icon} size={iconSize} color={variant === 'primary' ? '#FFFFFF' : '#374151'} style={{ marginLeft: 6 }} />
          )}
        </>
      )}
    </TouchableOpacity>
  );
};
