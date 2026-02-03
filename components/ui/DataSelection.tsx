import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal as RNModal,
  Pressable,
  ScrollView,
} from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { iconSize } from '@/lib/designSystem';

export interface DataSelectionOption<T = string> {
  value: T;
  label: string;
  /** Optional subtitle or flag (e.g. emoji) */
  subtitle?: string;
}

export interface DataSelectionProps<T = string> {
  label?: string;
  value: T;
  options: DataSelectionOption<T>[];
  onSelect: (value: T) => void;
  placeholder?: string;
  error?: string;
  disabled?: boolean;
  /** Optional: get display label from value (default: find in options) */
  getLabel?: (value: T) => string;
  className?: string;
}

/**
 * Single-select picker: shows current value, opens modal to choose.
 * Used for gender, currency, event type, liked visibility, etc.
 */
export function DataSelection<T extends string = string>({
  label,
  value,
  options,
  onSelect,
  placeholder = 'Select...',
  error,
  disabled = false,
  getLabel,
  className = '',
}: DataSelectionProps<T>) {
  const [open, setOpen] = React.useState(false);

  const displayLabel =
    getLabel?.(value) ??
    options.find((o) => o.value === value)?.label ??
    (value ? String(value) : placeholder);

  const handleSelect = (v: T) => {
    onSelect(v);
    setOpen(false);
  };

  return (
    <View className={className}>
      {label ? (
        <Text className="text-gray-900 text-sm font-semibold mb-2">{label}</Text>
      ) : null}
      <TouchableOpacity
        onPress={() => !disabled && setOpen(true)}
        disabled={disabled}
        activeOpacity={0.7}
        className={`
          flex-row items-center justify-between
          bg-gray-50 border rounded-xl py-3 px-4
          ${error ? 'border-[#EF4444]' : 'border-gray-200'}
          ${disabled ? 'opacity-60' : ''}
        `}
      >
        <Text
          className={`text-base flex-1 ${value ? 'text-gray-900' : 'text-[#6B7280]'}`}
          numberOfLines={1}
        >
          {displayLabel}
        </Text>
        <MaterialIcons
          name="keyboard-arrow-down"
          size={iconSize.lg}
          color="#6B7280"
        />
      </TouchableOpacity>
      {error ? (
        <Text className="text-[#EF4444] text-xs mt-1 px-1">{error}</Text>
      ) : null}

      <RNModal
        visible={open}
        transparent
        animationType="slide"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable
          className="flex-1 justify-end bg-black/50"
          onPress={() => setOpen(false)}
        >
          <Pressable
            className="bg-white rounded-t-2xl max-h-[70%]"
            onPress={(e) => e.stopPropagation()}
          >
            <View className="items-center py-2">
              <View className="w-10 h-1 rounded-full bg-gray-300" />
            </View>
            <ScrollView className="max-h-[400px] px-4 pb-6">
              {options.map((opt) => {
                const isSelected = opt.value === value;
                return (
                  <TouchableOpacity
                    key={String(opt.value)}
                    onPress={() => handleSelect(opt.value)}
                    className="py-3 border-b border-gray-100 flex-row items-center justify-between"
                    activeOpacity={0.7}
                  >
                    <View className="flex-1">
                      <Text
                        className={`text-base font-medium ${isSelected ? 'text-primary' : 'text-gray-900'}`}
                      >
                        {opt.label}
                      </Text>
                      {opt.subtitle ? (
                        <Text className="text-gray-500 text-sm mt-0.5">
                          {opt.subtitle}
                        </Text>
                      ) : null}
                    </View>
                    {isSelected ? (
                      <MaterialIcons
                        name="check"
                        size={iconSize.lg}
                        color="#DC2626"
                      />
                    ) : null}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </RNModal>
    </View>
  );
}
