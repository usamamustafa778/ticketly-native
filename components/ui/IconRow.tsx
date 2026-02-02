import React from 'react';
import { View, Text } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { detailRow, type Size } from '@/lib/designSystem';

interface IconRowProps {
  icon: keyof typeof MaterialIcons.glyphMap;
  label: string;
  value?: string;
  size?: Size;
  iconColor?: string;
  children?: React.ReactNode;
}

export const IconRow: React.FC<IconRowProps> = ({
  icon,
  label,
  value,
  size = 'sm',
  iconColor = '#6B7280',
  children,
}) => {
  const preset = detailRow[size];

  return (
    <View className="flex-row items-start" style={{ marginBottom: preset.marginBottom }}>
      <MaterialIcons
        name={icon}
        size={preset.icon}
        color={iconColor}
        style={{ marginRight: preset.gap, marginTop: 1 }}
      />
      <View className="flex-1">
        <Text className={`${preset.label} font-semibold mb-0.5 text-gray-900`}>{label}</Text>
        {value != null && <Text className={`${preset.value} text-gray-700`}>{value}</Text>}
        {children}
      </View>
    </View>
  );
};
