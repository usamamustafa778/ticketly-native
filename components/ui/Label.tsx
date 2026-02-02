import React from 'react';
import { View, Text } from 'react-native';

export type LabelVariant =
  | 'success'
  | 'warning'
  | 'error'
  | 'info'
  | 'neutral'
  | 'primary';

const variantStyles: Record<
  LabelVariant,
  { bg: string; text: string; border?: string }
> = {
  success: { bg: 'bg-[#10B981]', text: 'text-white' },
  warning: { bg: 'bg-[#F59E0B]', text: 'text-white' },
  error: { bg: 'bg-[#EF4444]', text: 'text-white' },
  info: { bg: 'bg-[#3B82F6]', text: 'text-white' },
  neutral: { bg: 'bg-[#6B7280]', text: 'text-white' },
  primary: { bg: 'bg-primary', text: 'text-white' },
};

export interface LabelProps {
  children: string;
  variant?: LabelVariant;
  /** Small pill (ticket/event status); default true */
  small?: boolean;
  className?: string;
}

/**
 * Status label/badge for ticket cards (status), events (pending/approved), etc.
 */
export const Label: React.FC<LabelProps> = ({
  children,
  variant = 'neutral',
  small = true,
  className = '',
}) => {
  const styles = variantStyles[variant];
  const sizeClass = small ? 'px-2 py-0.5 rounded-full' : 'px-3 py-1 rounded-lg';

  return (
    <View className={`${styles.bg} ${sizeClass} self-start ${className}`}>
      <Text
        className={`${styles.text} ${small ? 'text-[10px]' : 'text-xs'} font-semibold`}
      >
        {children}
      </Text>
    </View>
  );
};
