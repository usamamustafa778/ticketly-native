import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  Modal as RNModal,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import ColorPicker, { Panel1, HueSlider } from 'reanimated-color-picker';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { BackButton } from '@/components/BackButton';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { eventsAPI, type Event } from '@/lib/api/events';
import { TicketPreview } from '@/components/TicketPreview';

import {
  mergeTicketTheme,
  DEFAULT_TICKET_THEME,
  PRESET_THEMES,
  BACKGROUND_ELEMENTS,
  PATTERN_WEIGHTS,
  type TicketTheme,
  type PatternWeight,
} from '@/lib/types/ticketTheme';
import { isValidHex, normalizeHex } from '@/lib/utils/colorUtils';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const THEME_KEYS: (keyof TicketTheme)[] = [
  'gradientStart',
  'gradientEnd',
  'primaryTextColor',
  'accentColor',
  'brandColor',
];

const LABELS: Partial<Record<keyof TicketTheme, string>> = {
  gradientStart: 'Gradient start',
  gradientEnd: 'Gradient end',
  primaryTextColor: 'Text color',
  accentColor: 'Accent / divider / background',
  brandColor: 'Brand / logo',
};

export default function EventTicketThemeScreen() {
  const router = useRouter();
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const id = Array.isArray(eventId) ? eventId[0] : eventId;

  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [theme, setTheme] = useState<Partial<TicketTheme>>({});
  const [editColorKey, setEditColorKey] = useState<keyof TicketTheme | null>(null);
  const [editHex, setEditHex] = useState('');
  const colorPickerRef = useRef<{ setColor: (color: string, duration?: number) => void }>(null);

  // Sync typed hex to color picker when user edits the input (debounced to avoid conflict with picker gestures)
  useEffect(() => {
    if (!editColorKey || !isValidHex(editHex)) return;
    const t = setTimeout(() => {
      colorPickerRef.current?.setColor(normalizeHex(editHex), 0);
    }, 150);
    return () => clearTimeout(t);
  }, [editHex, editColorKey]);

  useEffect(() => {
    if (!id) return;
    const fetchEvent = async () => {
      try {
        setLoading(true);
        const response = await eventsAPI.getEventById(id);
        if (response.success && response.event) {
          setEvent(response.event);
          setTheme(response.event.ticketTheme || {});
        }
      } catch (err) {
        console.error('Error fetching event:', err);
        Alert.alert('Error', 'Failed to load event');
      } finally {
        setLoading(false);
      }
    };
    fetchEvent();
  }, [id]);

  const handlePreset = (presetTheme: TicketTheme) => {
    setTheme((prev) => ({
      ...presetTheme,
      // Preserve user's pattern selection when switching presets
      backgroundElement: prev?.backgroundElement ?? presetTheme.backgroundElement ?? 'none',
      patternWeight: prev?.patternWeight ?? presetTheme.patternWeight ?? 'medium',
    }));
  };

  const openColorEdit = (key: keyof TicketTheme) => {
    const merged = mergeTicketTheme(theme);
    setEditColorKey(key);
    setEditHex(merged[key] ?? DEFAULT_TICKET_THEME[key] ?? '#FFFFFF');
  };

  const applyColorEdit = () => {
    if (editColorKey && isValidHex(editHex)) {
      setTheme((prev) => ({ ...prev, [editColorKey]: editHex }));
    }
    setEditColorKey(null);
    setEditHex('');
  };

  const handleSave = async () => {
    if (!id) return;
    try {
      setSaving(true);
      const themeToSave = mergeTicketTheme(theme);
      await eventsAPI.updateEvent(id, {
        ticketTheme: {
          gradientStart: themeToSave.gradientStart,
          gradientEnd: themeToSave.gradientEnd,
          primaryTextColor: themeToSave.primaryTextColor,
          accentColor: themeToSave.accentColor,
          brandColor: themeToSave.brandColor,
          gradientDirection: themeToSave.gradientDirection ?? DEFAULT_TICKET_THEME.gradientDirection,
          backgroundElement: themeToSave.backgroundElement ?? 'none',
          patternWeight: themeToSave.patternWeight ?? 'medium',
        },
      });
      Alert.alert('Saved', 'Ticket theme has been updated.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || 'Failed to save theme');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !event) {
    // Simple skeleton shimmer for ticket theme screen
    return (
      <View className="flex-1 bg-white px-3 pt-3">
        <View className="flex-row items-center justify-between mb-3">
          <View className="w-8 h-8 rounded-full bg-gray-200" />
          <View className="w-32 h-4 rounded-full bg-gray-200" />
          <View className="w-8 h-8 rounded-full bg-gray-200" />
        </View>
        <View className="rounded-xl h-56 bg-gray-200 mb-4" />
        <View className="h-3 w-24 rounded-full bg-gray-200 mb-2" />
        <View className="flex-row justify-between">
          {Array.from({ length: 5 }).map((_, i) => (
            <View key={i} className="w-14 items-center">
              <View className="w-9 h-9 rounded-full bg-gray-200 mb-1" />
              <View className="h-2 w-10 rounded-full bg-gray-200" />
            </View>
          ))}
        </View>
      </View>
    ); 
  }

  const mergedTheme = mergeTicketTheme(theme);
  const insets = useSafeAreaInsets();

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-white"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
         <View
        className="px-4 py-2 shadow-xs flex-row items-center gap-2 bg-white z-10"
        style={{ paddingTop: insets.top + 8 }}
      >
        <BackButton onPress={() => router.back()} />
        <Text className="text-lg font-bold text-gray-900">Event Ticket Theme</Text>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 24, paddingHorizontal: 12, paddingTop: 12 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Preview */}
        <Text className="text-gray-900 text-xs font-semibold mb-1">Preview</Text>
        <TicketPreview theme={theme} event={event} preview />

        {/* Presets */}
        <Text className="text-gray-900 text-xs font-semibold mt-4 mb-1">Presets</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-0.5">
          {PRESET_THEMES.map((preset) => (
            <TouchableOpacity
              key={preset.name}
              onPress={() => handlePreset(preset.theme)}
              className="mr-2 p-2 rounded-lg border border-gray-200 items-center min-w-[64px]"
            >
              <View
                className="w-9 h-9 rounded mb-1"
                style={{
                  backgroundColor: preset.theme.gradientStart,
                  borderWidth: 1,
                  borderColor: preset.theme.gradientEnd,
                }}
              />
              <Text className="text-gray-700 text-[10px] font-medium">{preset.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Background element */}
        {(() => {
          const currentElement = mergedTheme.backgroundElement ?? 'none';
          const currentIndex = BACKGROUND_ELEMENTS.findIndex((e) => e.id === currentElement);
          const value = currentIndex >= 0 ? currentIndex : 0;
          const currentItem = BACKGROUND_ELEMENTS[value];
          return (
            <>
              <View className="mt-4 mb-1">
                <Text className="text-gray-900 text-xs font-semibold">Background pattern</Text>
                <Text className="text-[10px] text-gray-500 mt-0.5">
                  {currentItem?.name}{currentItem?.style !== 'No pattern' ? ` (${currentItem?.style})` : ''}
                </Text>
              </View>
              <View className="flex-row items-center gap-2">
                <Text className="text-[10px] text-gray-500">None</Text>
                <Slider
                  style={{ flex: 1, height: 32 }}
                  minimumValue={0}
                  maximumValue={BACKGROUND_ELEMENTS.length - 1}
                  step={1}
                  value={value}
                  onValueChange={(v) => {
                    const idx = Math.round(v);
                    const el = BACKGROUND_ELEMENTS[idx]?.id ?? 'none';
                    setTheme((prev) => ({ ...prev, backgroundElement: el }));
                  }}
                  minimumTrackTintColor="#DC2626"
                  maximumTrackTintColor="#E5E7EB"
                  thumbTintColor="#DC2626"
                />
                <Text className="text-[10px] text-gray-500">Dynamic</Text>
              </View>
            </>
          );
        })()}

        {/* Pattern weight - only when a pattern is selected */}
        {(mergedTheme.backgroundElement ?? 'none') !== 'none' && (() => {
          const valueToWeight: PatternWeight[] = ['sharper', 'sharp', 'thin', 'medium', 'thick', 'thicker'];
          const weightToValue: Record<PatternWeight, number> = Object.fromEntries(
            valueToWeight.map((id, i) => [id, i])
          ) as Record<PatternWeight, number>;
          const currentWeight = mergedTheme.patternWeight ?? 'medium';
          const currentValue = weightToValue[currentWeight] ?? 3;
          const currentLabel = PATTERN_WEIGHTS.find((w) => w.id === currentWeight);
          return (
            <>
              <View className="mt-4 mb-1">
                <Text className="text-gray-900 text-xs font-semibold">Pattern weight</Text>
                <Text className="text-[10px] text-gray-500 mt-0.5">{currentLabel?.description}</Text>
              </View>
              <View className="flex-row items-center gap-2">
                <Text className="text-[10px] text-gray-500">Sharper</Text>
                <Slider
                  style={{ flex: 1, height: 32 }}
                  minimumValue={0}
                  maximumValue={5}
                  step={1}
                  value={currentValue}
                  onValueChange={(v) => setTheme((prev) => ({ ...prev, patternWeight: valueToWeight[Math.round(v)] }))}
                  minimumTrackTintColor="#DC2626"
                  maximumTrackTintColor="#E5E7EB"
                  thumbTintColor="#DC2626"
                />
                <Text className="text-[10px] text-gray-500">Thicker</Text>
              </View>
            </>
          );
        })()}

        {/* Custom colors */}
        <Text className="text-gray-900 text-xs font-semibold mt-4 mb-1">Customize colors</Text>
        {THEME_KEYS.map((key) => (
          <TouchableOpacity
            key={key}
            onPress={() => openColorEdit(key)}
            className="flex-row items-center py-2 border-b border-gray-100"
          >
            <View
              className="w-8 h-8 rounded mr-2 border border-gray-200"
              style={{ backgroundColor: mergedTheme[key] }}
            />
            <Text className="text-gray-800 text-xs flex-1">{LABELS[key]}</Text>
            <Text className="text-gray-500 text-[10px] font-mono">{mergedTheme[key]}</Text>
            <MaterialIcons name="chevron-right" size={16} color="#9CA3AF" />
          </TouchableOpacity>
        ))}

        {/* Save */}
        <TouchableOpacity
          onPress={handleSave}
          disabled={saving}
          className="mt-4 py-2.5 rounded-lg bg-primary items-center"
        >
          {saving ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <Text className="text-white font-semibold text-xs">Save theme</Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* Color edit modal - with color picker */}
      <RNModal
        visible={editColorKey !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setEditColorKey(null)}
      >
        <GestureHandlerRootView style={{ flex: 1 }}>
          <Pressable
            className="flex-1 bg-black/60 justify-center items-center p-3"
            onPress={() => setEditColorKey(null)}
          >
            <Pressable
              className="bg-white rounded-xl p-4 w-full max-w-sm"
              onPress={(e) => e.stopPropagation()}
            >
              <Text className="text-gray-900 text-sm font-semibold mb-3">
                {editColorKey ? LABELS[editColorKey] : 'Edit color'}
              </Text>

              {/* Color picker */}
              <ColorPicker
                ref={colorPickerRef}
                value={normalizeHex(isValidHex(editHex) ? editHex : (editColorKey ? String(mergedTheme[editColorKey] ?? '#FFFFFF') : '#FFFFFF'))}
                onChangeJS={(colors) => setEditHex(colors.hex)}
                style={{ width: '100%', marginBottom: 16 }}
                sliderThickness={22}
                thumbSize={24}
                boundedThumb
              >
                <Panel1 style={{ height: 140, borderRadius: 8, marginBottom: 8 }} />
                <HueSlider style={{ borderRadius: 8 }} />
              </ColorPicker>

              {/* Hex input */}
              <View className="flex-row items-center mb-3">
                <View
                  className="w-10 h-10 rounded-lg mr-2 border border-gray-200"
                  style={{
                    backgroundColor:
                      isValidHex(editHex) ? editHex : (editColorKey ? mergedTheme[editColorKey] : '#ccc') || '#ccc',
                  }}
                />
                <TextInput
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-xs font-mono text-gray-900"
                  placeholder="#FFFFFF"
                  placeholderTextColor="#9CA3AF"
                  value={editHex}
                  onChangeText={(t) => setEditHex(t === '' ? '' : t.startsWith('#') ? t : `#${t}`)}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              <View className="flex-row gap-2">
                <TouchableOpacity
                  className="flex-1 py-2 rounded-lg bg-gray-100 items-center"
                  onPress={() => {
                    setEditColorKey(null);
                    setEditHex('');
                  }}
                >
                  <Text className="text-gray-700 text-xs font-semibold">Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  className="flex-1 py-2 rounded-lg bg-primary items-center"
                  onPress={applyColorEdit}
                >
                  <Text className="text-white text-xs font-semibold">Apply</Text>
                </TouchableOpacity>
              </View>
            </Pressable>
          </Pressable>
        </GestureHandlerRootView>
      </RNModal>
    </KeyboardAvoidingView>
  );
}
