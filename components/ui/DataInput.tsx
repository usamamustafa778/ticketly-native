import React from 'react';
import { TextInput, TextInputProps, View, Text } from 'react-native';
import { input, type Size } from '@/lib/designSystem';

export interface DataInputProps extends Omit<TextInputProps, 'className'> {
  label?: string;
  error?: string;
  size?: Size;
  className?: string;
  /** Optional right element (e.g. visibility toggle for password) */
  rightElement?: React.ReactNode;
}

/**
 * Form text input with optional label and error.
 * Used in create/update event, login/signup, settings.
 */
export const DataInput: React.FC<DataInputProps> = ({
  label,
  error,
  size = 'md',
  className = '',
  rightElement,
  ...props
}) => {
  const inputClasses = `
    bg-gray-50 border border-gray-200
    ${input[size]}
    ${error ? 'border-[#EF4444]' : ''}
    ${rightElement ? 'pr-12' : ''}
    ${className}
  `;

  return (
    <View>
      {label ? (
        <Text className="text-gray-900 text-sm font-semibold mb-2">{label}</Text>
      ) : null}
      <View className="relative">
        <TextInput
          placeholderTextColor="#6B7280"
          className={inputClasses}
          {...props}
        />
        {rightElement ? (
          <View className="absolute right-3 top-0 bottom-0 justify-center">
            {rightElement}
          </View>
        ) : null}
      </View>
      {error ? (
        <Text className="text-[#EF4444] text-xs mt-1 px-1">{error}</Text>
      ) : null}
    </View>
  );
};
