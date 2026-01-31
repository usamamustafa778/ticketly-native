import React from 'react';
import {
  Modal as RNModal,
  View,
  Text,
  TouchableOpacity,
  Pressable,
} from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

export type ModalVariant = 'default' | 'success' | 'error' | 'info';

export interface ModalProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  /** Optional: omit for title-only dialogs */
  message?: string;
  primaryButtonText?: string;
  onPrimaryPress?: () => void;
  secondaryButtonText?: string;
  onSecondaryPress?: () => void;
  /** Visual variant: default (primary red), success (green), error (red), info (gray) */
  variant?: ModalVariant;
  /** Show handle bar at top (same as gender/currency modals) */
  showHandle?: boolean;
}

const VARIANT_STYLES: Record<ModalVariant, { icon: keyof typeof MaterialIcons.glyphMap; color: string; bgLight: string }> = {
  default: { icon: 'info-outline', color: '#DC2626', bgLight: 'bg-primary' },
  success: { icon: 'check-circle-outline', color: '#10B981', bgLight: 'bg-[#10B981]' },
  error: { icon: 'error-outline', color: '#EF4444', bgLight: 'bg-[#EF4444]' },
  info: { icon: 'info-outline', color: '#9CA3AF', bgLight: 'bg-[#6B7280]' },
};

export const Modal: React.FC<ModalProps> = ({
  visible,
  onClose,
  title,
  message,
  primaryButtonText = 'OK',
  onPrimaryPress,
  secondaryButtonText,
  onSecondaryPress,
  variant = 'default',
  showHandle = true,
}) => {
  const handlePrimaryPress = () => {
    if (onPrimaryPress) {
      onPrimaryPress();
    }
    onClose();
  };

  const handleSecondaryPress = () => {
    if (onSecondaryPress) {
      onSecondaryPress();
    }
    onClose();
  };

  const style = VARIANT_STYLES[variant];
  const primaryBg = variant === 'default' ? 'bg-primary' : style.bgLight;

  return (
    <RNModal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable
        className="flex-1 bg-black/70 justify-center items-center p-5"
        onPress={onClose}
      >
        <Pressable
          className="bg-white rounded-2xl border border-gray-200 p-6 w-full max-w-[400px]"
          onPress={(e) => e.stopPropagation()}
        >
          {showHandle && (
            <View className="items-center pt-1 pb-3">
              <View className="w-10 h-1 rounded-full bg-gray-300" />
            </View>
          )}
          {title && (
            <View className="items-center mb-2">
              <View
                className="w-12 h-12 rounded-full items-center justify-center mb-2"
                style={{ backgroundColor: style.color + '33' }}
              >
                <MaterialIcons name={style.icon} size={28} color={style.color} />
              </View>
              <Text className="text-gray-900 text-xl font-bold text-center">{title}</Text>
            </View>
          )}
          {message != null && message !== '' && (
            <Text className="text-gray-600 text-base leading-6 mb-6 text-center">{message}</Text>
          )}
          <View className="flex-row gap-3">
            {secondaryButtonText && (
              <TouchableOpacity
                className="flex-1 py-3.5 rounded-xl items-center bg-gray-100 border border-gray-200"
                onPress={handleSecondaryPress}
              >
                <Text className="text-gray-900 text-base font-semibold">{secondaryButtonText}</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              className={`flex-1 py-3.5 rounded-xl items-center ${primaryBg}`}
              onPress={handlePrimaryPress}
            >
              <Text className="text-white text-base font-semibold">{primaryButtonText}</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </RNModal>
  );
};
