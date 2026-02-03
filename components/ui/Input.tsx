import React from 'react';
import { TextInput, TextInputProps, View, Text } from 'react-native';
import { input, type Size } from '@/lib/designSystem';

interface InputProps extends Omit<TextInputProps, 'className'> {
  label?: string;
  error?: string;
  size?: Size;
  className?: string;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  size = 'sm',
  className = '',
  ...props
}) => {
  const inputClasses = `
    bg-gray-50 border border-gray-200
    ${input[size]}
    ${error ? 'border-[#EF4444]' : ''}
    ${className}
  `;

  return (
    <View>
      {label && (
        <Text className="text-gray-900 text-xs font-semibold mb-1">{label}</Text>
      )}
      <TextInput
        placeholderTextColor="#6B7280"
        className={inputClasses}
        {...props}
      />
      {error && (
        <Text className="text-[#EF4444] text-[10px] mt-0.5 px-1">{error}</Text>
      )}
    </View>
  );
};
