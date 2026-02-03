import { EventCard } from '@/components/EventCard';
import { EventCardSkeleton } from '@/components/EventCardSkeleton';
import { Tabs } from '@/components/ui/Tabs';
import { eventsAPI } from '@/lib/api/events';
import type { Event } from '@/lib/api/events';
import { CACHE_KEYS, getCached, setCached } from '@/lib/cache';
import { getEventImageUrl, getProfileImageUrl } from '@/lib/utils/imageUtils';
import { useAppStore } from '@/store/useAppStore';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, FlatList, RefreshControl, ScrollView, TouchableOpacity, PanResponder, Dimensions, Platform } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBottomPadding } from '@/hooks/useBottomPadding';

export type DateFilter =
  | 'tomorrow'
  | 'thisweek'
  | 'thisweekend'
  | 'nextweek'
  | 'nextweekend'
  | 'thismonth';

const DATE_FILTER_OPTIONS: { key: DateFilter; label: string }[] = [
  { key: 'tomorrow', label: 'Tomorrow' },
  { key: 'thisweek', label: 'This Week' },
  { key: 'thisweekend', label: 'This Weekend' },
  { key: 'nextweek', label: 'Next Week' },
  { key: 'nextweekend', label: 'Next Weekend' },
  { key: 'thismonth', label: 'This Month' },
];

const DATE_FILTER_HEADINGS: Record<DateFilter, string> = {
  tomorrow: "Tomorrow's Events",
  thisweek: "This Week's Events",
  thisweekend: "This Weekend's Events",
  nextweek: "Next Week's Events",
  nextweekend: "Next Weekend's Events",
  thismonth: "This Month's Events",
};

function getStartOfWeek(d: Date): Date {
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.getFullYear(), d.getMonth(), diff);
}

function getEndOfWeek(d: Date): Date {
  const start = getStartOfWeek(d);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return end;
}

function getStartOfNextWeek(d: Date): Date {
  const start = getStartOfWeek(d);
  const next = new Date(start);
  next.setDate(next.getDate() + 7);
  return next;
}

function getEndOfNextWeek(d: Date): Date {
  const start = getStartOfNextWeek(d);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return end;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function isWeekend(d: Date): boolean {
  return d.getDay() === 0 || d.getDay() === 6;
}

function eventMatchesDateFilter(event: { date: string }, filter: DateFilter): boolean {
  const parts = event.date.split('-').map(Number);
  const eventDate = new Date(parts[0], (parts[1] || 1) - 1, parts[2] || 1);
  eventDate.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (filter === 'tomorrow') {
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return isSameDay(eventDate, tomorrow);
  }
  if (filter === 'thisweek') {
    const start = getStartOfWeek(today);
    const end = getEndOfWeek(today);
    return eventDate >= start && eventDate <= end;
  }
  if (filter === 'thisweekend') {
    const start = getStartOfWeek(today);
    const end = getEndOfWeek(today);
    if (eventDate < start || eventDate > end) return false;
    return isWeekend(eventDate);
  }
  if (filter === 'nextweek') {
    const start = getStartOfNextWeek(today);
    const end = getEndOfNextWeek(today);
    return eventDate >= start && eventDate <= end;
  }
  if (filter === 'nextweekend') {
    const start = getStartOfNextWeek(today);
    const end = getEndOfNextWeek(today);
    if (eventDate < start || eventDate > end) return false;
    return isWeekend(eventDate);
  }
  if (filter === 'thismonth') {
    return eventDate.getMonth() === today.getMonth() && eventDate.getFullYear() === today.getFullYear();
  }
  return true;
}

function getEventPrice(apiEvent: Event): number {
  if (apiEvent.price?.price === 'free' || apiEvent.price?.currency === null) return 0;
  if (typeof apiEvent.price?.price === 'number') return apiEvent.price.price;
  return apiEvent.ticketPrice ?? 0;
}

const convertEvent = (apiEvent: Event) => {
  const location = apiEvent.location ?? '';
  const price = getEventPrice(apiEvent);
  return {
    id: apiEvent._id,
    title: apiEvent.title,
    description: apiEvent.description ?? '',
    date: apiEvent.date,
    time: apiEvent.time,
    venue: location,
    city: location.split(',')[0] || location,
    category: 'Event',
    image: getEventImageUrl(apiEvent) || 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=800',
    organizerId: apiEvent.createdBy?._id || '',
    organizerName: apiEvent.createdBy?.fullName || apiEvent.organizerName || 'Organizer',
    price,
    accessType: price > 0 ? ('paid' as const) : ('open' as const),
    registeredUsers: [],
    likedUsers: [],
    hostAvatarUrl: apiEvent.createdBy ? getProfileImageUrl(apiEvent.createdBy as any) : null,
    joinedUsers: (apiEvent.joinedUsers || []).map((user) => ({
      id: user._id,
      name: user.name,
      avatarUrl: getProfileImageUrl({ profileImageUrl: user.profileImageUrl }) || undefined,
    })),
    joinedCount: apiEvent.joinedCount ?? (apiEvent.joinedUsers?.length ?? 0),
  };
};

export default function EventFilterScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const events = useAppStore((state) => state.events);
  const setEvents = useAppStore((state) => state.setEvents);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<DateFilter>('tomorrow');
  const bottomPadding = useBottomPadding();
  const filterScrollRef = useRef<ScrollView | null>(null);
  const tabLayoutsRef = useRef<Record<string, { x: number; width: number }>>({});
  const activeFilterRef = useRef(activeFilter);
  activeFilterRef.current = activeFilter;

  const { height } = Dimensions.get('window');
  const SWIPE_THRESHOLD = 40;
  const filterPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        const { dx, dy } = gestureState;
        return Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 35;
      },
      onMoveShouldSetPanResponderCapture: (_, gestureState) => {
        const { dx, dy } = gestureState;
        return Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 35;
      },
      onPanResponderTerminationRequest: () => false,
      onPanResponderRelease: (_, gestureState) => {
        const { dx } = gestureState;
        const currentFilter = activeFilterRef.current;
        const idx = DATE_FILTER_OPTIONS.findIndex((f) => f.key === currentFilter);
        if (dx < -SWIPE_THRESHOLD && idx < DATE_FILTER_OPTIONS.length - 1) {
          setActiveFilter(DATE_FILTER_OPTIONS[idx + 1].key);
        } else if (dx > SWIPE_THRESHOLD && idx > 0) {
          setActiveFilter(DATE_FILTER_OPTIONS[idx - 1].key);
        }
      },
    })
  ).current;

  useEffect(() => {
    loadEvents();
  }, []);

  const loadEvents = async (showRefreshing = false) => {
    if (showRefreshing) setRefreshing(true);
    else setLoading(true);
    try {
      const cached = await getCached<any[]>(CACHE_KEYS.EVENTS_APPROVED);
      if (cached && Array.isArray(cached) && cached.length > 0) {
        setEvents(cached);
      }
      const response = await eventsAPI.getApprovedEvents();
      if (response.success && response.events) {
        const converted = response.events.map(convertEvent);
        await setCached(CACHE_KEYS.EVENTS_APPROVED, converted);
        setEvents(converted);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const filteredEvents = useMemo(() => {
    return events.filter((e) => eventMatchesDateFilter(e, activeFilter));
  }, [events, activeFilter]);

  const safeTop = insets.top;
  const headerHeight = safeTop + 52;
  const swipeAreaMinHeight = Math.max(400, height - headerHeight - bottomPadding - 20);

  // Scroll filter bar so active tab is visible (like home page)
  useEffect(() => {
    const scrollToActive = () => {
      if (!filterScrollRef.current) return;
      const layout = tabLayoutsRef.current[activeFilter];
      const idx = DATE_FILTER_OPTIONS.findIndex((f) => f.key === activeFilter);
      const padding = 12;
      let scrollX = 0;
      if (layout && typeof layout.x === 'number') {
        scrollX = Math.max(0, layout.x - padding);
      } else if (idx >= 0) {
        scrollX = Math.max(0, idx * 80 - padding);
      }
      filterScrollRef.current.scrollTo({ x: scrollX, animated: true });
    };
    const delays = Platform.OS !== 'web' ? [100, 300, 600, 900] : [0, 80, 200];
    const timeouts: ReturnType<typeof setTimeout>[] = [];
    delays.forEach((delay) => timeouts.push(setTimeout(scrollToActive, delay)));
    return () => timeouts.forEach((t) => clearTimeout(t));
  }, [activeFilter]);

  return (
    <View className="flex-1 bg-white">
      <View
        className="border-b mt-3 border-gray-200 bg-white"
        style={{ paddingTop: safeTop, }}
      >
        <View className="flex-row items-center ">
          <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text className="text-gray-900 text-xl font-medium px-2">{'<'}</Text>
          </TouchableOpacity>
          <View className="flex-1">
            <Tabs
              items={DATE_FILTER_OPTIONS}
              activeKey={activeFilter}
              onSelect={setActiveFilter}
              onTabLayout={(key, layout) => {
                tabLayoutsRef.current[key] = layout;
              }}
              scrollRef={filterScrollRef}
              className="flex-row mb-[-8px]"
            />
          </View>
        </View>
      </View>

      <View key={activeFilter} className="flex-1" style={{ minHeight: swipeAreaMinHeight }} {...filterPanResponder.panHandlers}>
        <FlatList
          data={loading ? Array.from({ length: 6 }, (_, i) => ({ id: `skeleton-${i}`, _skeleton: true } as any)) : filteredEvents}
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingHorizontal: 0,
            paddingBottom: bottomPadding,
            flexGrow: 1,
            minHeight: height - 140,
          }}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={{ gap: 2, marginBottom: 2 }}
          renderItem={({ item }) => (
            <View className="flex-1">
              {item._skeleton ? <EventCardSkeleton /> : <EventCard event={item} />}
            </View>
          )}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => loadEvents(true)} tintColor="#DC2626" colors={["#DC2626"]} />
          }
          ListHeaderComponent={
            <View className="px-3 mb-4 mt-2">
              <Text className="text-gray-900 text-xl font-bold">{DATE_FILTER_HEADINGS[activeFilter]}</Text>
            </View>
          }
          ListEmptyComponent={
            !loading ? (
              <View className="px-3 py-14 items-center justify-center">
                <MaterialIcons name="event-busy" size={48} color="#4B5563" />
                <Text className="text-[#9CA3AF] text-base font-medium mt-3">No data found</Text>
                <Text className="text-[#6B7280] text-sm mt-1 text-center px-3">No events match this filter.</Text>
              </View>
            ) : null
          }
        />
      </View>
    </View>
  );
}
