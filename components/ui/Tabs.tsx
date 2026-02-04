import React from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';

export interface TabItem<T extends string = string> {
  key: T;
  label: string;
}

interface TabsProps<T extends string = string> {
  items: TabItem<T>[];
  activeKey: T;
  onSelect: (key: T) => void;
  /** Optional: pass layout callback for scroll-to-active (e.g. home filter bar) */
  onTabLayout?: (key: T, layout: { x: number; width: number }) => void;
  /** Optional: ref for the horizontal ScrollView (for scrollTo when activeKey changes) */
  scrollRef?: React.RefObject<ScrollView | null>;
  scrollViewProps?: React.ComponentProps<typeof ScrollView>;
  className?: string;
}

const activeBg = ' border-b-2 border-primary';
const inactiveBg = '';
const activeText = 'text-primary';
const inactiveText = 'text-gray-800';

/**
 * Horizontal tab bar – active = light red tint + primary text, inactive = gray.
 * Used on home (filters), profile (Created/Joined/Liked), user profile, event-filter.
 */
export function Tabs<T extends string = string>({
  items,
  activeKey,
  onSelect,
  onTabLayout,
  scrollRef,
  scrollViewProps = {},
  className = '',
}: TabsProps<T>) {

  const isCompactLayout = items.length <= 4;
  const content = (
    <>
      {items.map(({ key, label }) => {
        const isActive = activeKey === key;
        return (
          <TouchableOpacity
            key={key}
            onPress={() => onSelect(key)}
            activeOpacity={1}
            onLayout={
              onTabLayout
                ? (e) => {
                    const { x, width } = e.nativeEvent.layout;
                    onTabLayout(key, { x, width });
                  }
                : undefined
            }
            className={`rounded-sm px-2.5 py-1 ${isCompactLayout ? 'flex-1 items-center' : ''} ${isActive ? activeBg : inactiveBg}`}
          >
            <Text
              className={`text-sm font-semibold ${isActive ? activeText : inactiveText}`}
            >
              {label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </>
  );

  if (items.length > 4) {
    return (
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 8 }}
        className={`w-full flex-row ${className}`}
        {...scrollViewProps}
      >
        {content}
      </ScrollView>
    );
  }

  return (
    <View className={`w-full flex flex-row items-center px-3 ${className}`}>
      {content}
    </View>
  );
}

/**
 * Row of equal-width tabs (e.g. profile Created / Joined / Liked).
 * Same design as Tabs: active = light red tint + primary text, inactive = gray.
 */
export function TabsRow<T extends string = string>({
  items,
  activeKey,
  onSelect,
  className = '',
}: Omit<TabsProps<T>, 'onTabLayout' | 'scrollViewProps'>) {
  return (
    <View className={`flex-row ${className}`}>
      {items.map(({ key, label }) => {
        const isActive = activeKey === key;
        return (
          <TouchableOpacity
            key={key}
            onPress={() => onSelect(key)}
            activeOpacity={1}
            className={`flex-1 py-1 items-center ${isActive ? activeBg : inactiveBg}`}
          >
            <Text
              className={`text-xs font-semibold ${isActive ? activeText : inactiveText}`}
            >
              {label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
