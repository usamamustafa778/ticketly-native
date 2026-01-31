import { EventCard } from '@/components/EventCard';
import { EventCardSkeleton } from '@/components/EventCardSkeleton';
import { useAppStore } from '@/store/useAppStore';
import { eventsAPI } from '@/lib/api/events';
import { useRouter } from 'expo-router';
import React, { useEffect, useState, useRef, useMemo } from 'react';
import { getEventImageUrl, getProfileImageUrl } from '@/lib/utils/imageUtils';
import { API_BASE_URL } from '@/lib/config';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PROFILE_CACHE_KEY } from '@/lib/api/auth';
import { useFocusEffect } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Modal } from '@/components/Modal';
import {
  Dimensions,
  Image,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Animated,
  Easing,
  Platform,
  RefreshControl,
} from 'react-native';

export type HomeFilter =
  | 'all'
  | 'myevents'
  | 'today'
  | 'tomorrow'
  | 'thisweek'
  | 'thisweekend'
  | 'nextweek'
  | 'nextweekend'
  | 'thismonth';

const FILTER_OPTIONS: { key: HomeFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'myevents', label: 'My Events' },
  { key: 'today', label: 'Today' },
  { key: 'tomorrow', label: 'Tomorrow' },
  { key: 'thisweek', label: 'This Week' },
  { key: 'thisweekend', label: 'This Weekend' },
  { key: 'nextweek', label: 'Next Week' },
  { key: 'nextweekend', label: 'Next Weekend' },
  { key: 'thismonth', label: 'This Month' },
];

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
  const day = d.getDay();
  return day === 0 || day === 6;
}

function eventMatchesFilter(event: { date: string; organizerId?: string }, filter: HomeFilter, userId?: string): boolean {
  const parts = event.date.split('-').map(Number);
  const eventDate = new Date(parts[0], (parts[1] || 1) - 1, parts[2] || 1);
  eventDate.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (filter === 'all') return true;
  if (filter === 'myevents') {
    if (!userId) return false;
    return event.organizerId === userId;
  }
  if (filter === 'today') return isSameDay(eventDate, today);
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Event } from '@/lib/api/events';

const { width } = Dimensions.get('window');
const CARD_WIDTH = width * 0.82; // 82% of screen width for better peek effect
const CARD_SPACING = 16; // Space between cards
const HORIZONTAL_PADDING = (width - CARD_WIDTH) / 2; // Center padding to center the cards

// Normalize profile URLs coming from backend (especially localhost URLs)
const normalizeProfileUrl = (url?: string | null): string | undefined => {
  if (!url) return undefined;

  // If backend returned a localhost URL (old data), rewrite it to use the current API base URL
  if (url.includes('localhost') || url.includes('127.0.0.1')) {
    const baseUrl = API_BASE_URL.replace('/api', '');
    try {
      const parsed = new URL(url);
      const path = parsed.pathname || '';
      return `${baseUrl}${path}`;
    } catch {
      const uploadsIndex = url.indexOf('/uploads');
      if (uploadsIndex !== -1) {
        const path = url.substring(uploadsIndex);
        return `${baseUrl}${path}`;
      }
    }
  }

  return url;
};

// Derive numeric price for cards: event.price { price, currency } or ticketPrice
function getEventPrice(apiEvent: Event): number {
  if (apiEvent.price?.price === 'free' || apiEvent.price?.currency === null) return 0;
  if (typeof apiEvent.price?.price === 'number') return apiEvent.price.price;
  return apiEvent.ticketPrice ?? 0;
}

// Helper function to convert API event to app event format
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
      avatarUrl: normalizeProfileUrl(user.profileImageUrl || undefined),
    })),
    joinedCount: apiEvent.joinedCount ?? (apiEvent.joinedUsers?.length ?? 0),
  };
};

// Convert cached/API event (id or _id, date with T) to card format for "My Events" from profile cache
const convertCachedEvent = (apiEvent: any) => {
  const eventId = apiEvent._id || apiEvent.id || '';
  const dateStr = apiEvent.date
    ? (String(apiEvent.date).includes('T') ? String(apiEvent.date).split('T')[0] : apiEvent.date)
    : '';
  const location = apiEvent.location ?? '';
  const price =
    apiEvent.price?.price === 'free' || apiEvent.price?.currency === null
      ? 0
      : typeof apiEvent.price?.price === 'number'
        ? apiEvent.price.price
        : apiEvent.ticketPrice ?? 0;
  return {
    id: eventId,
    title: apiEvent.title || '',
    description: apiEvent.description || '',
    date: dateStr,
    time: apiEvent.time || '',
    venue: location,
    city: location.split(',')[0] || location,
    category: 'Event',
    image: getEventImageUrl(apiEvent) || 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=800',
    organizerId: apiEvent.createdBy?._id || apiEvent.createdBy?.id || '',
    organizerName: apiEvent.createdBy?.fullName || apiEvent.organizerName || 'Organizer',
    price,
    accessType: price > 0 ? ('paid' as const) : ('open' as const),
    registeredUsers: [],
    likedUsers: [],
    hostAvatarUrl: apiEvent.createdBy ? getProfileImageUrl(apiEvent.createdBy as any) : null,
    joinedUsers: (apiEvent.joinedUsers || []).map((u: any) => ({
      id: u._id || u.id,
      name: u.name || u.fullName,
      avatarUrl: normalizeProfileUrl(u.profileImageUrl || u.avatarUrl),
    })),
    joinedCount: apiEvent.joinedCount ?? (apiEvent.joinedUsers?.length ?? 0),
  };
};

export default function HomeScreen() {
  const router = useRouter();
  const user = useAppStore((state) => state.user);
  const setUser = useAppStore((state) => state.setUser);
  const setEvents = useAppStore((state) => state.setEvents);
  const insets = useSafeAreaInsets();
  const [featuredEvents, setFeaturedEvents] = useState<any[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<HomeFilter>('all');
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorModalMessage, setErrorModalMessage] = useState('');
  const [currentSlide, setCurrentSlide] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);
  const scrollX = useRef(new Animated.Value(0)).current;
  const animatedScales = useRef<Animated.Value[]>([]);
  const lastScrollY = useRef(0);
  const headerTranslateY = useRef(new Animated.Value(0)).current;

  // Hydrate user from profile cache when home tab is focused so "My Events" can show createdEvents from localStorage
  useFocusEffect(
    React.useCallback(() => {
      let cancelled = false;
      (async () => {
        try {
          const raw = await AsyncStorage.getItem(PROFILE_CACHE_KEY);
          if (cancelled || !raw) return;
          const cached = JSON.parse(raw) as { success?: boolean; user?: any };
          if (!cached?.user) return;
          const u = cached.user;
          if (!u._id && u.id) u._id = u.id;
          if (!cancelled) setUser(u);
        } catch (_) {
          // Ignore cache parse errors
        }
      })();
      return () => { cancelled = true; };
    }, [setUser])
  );

  // Calculate bottom padding: tab bar height + safe area bottom + extra padding
  // Tab bar layout: iOS height=90 (includes paddingBottom=30), Android height=75 + paddingBottom + marginBottom=10
  // Total space from bottom: iOS = 90 + insets.bottom, Android = 75 + max(insets.bottom, 50) + 10 + insets.bottom
  const tabBarTotalHeight = Platform.OS === 'ios'
    ? 90 + insets.bottom // iOS: height includes padding, add safe area
    : 75 + Math.max(insets.bottom, 50) + 10 + insets.bottom; // Android: height + paddingBottom + marginBottom + safe area
  const bottomPadding = tabBarTotalHeight + 20; // Extra 20px for comfortable spacing

  useEffect(() => {
    // Load events on mount - no authentication required
    loadEvents();
  }, []);

  const loadEvents = async (showRefreshing = false) => {
    try {
      if (showRefreshing) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      const response = await eventsAPI.getApprovedEvents();
      if (response.success && response.events) {
        const convertedEvents = response.events.map(convertEvent);
        setEvents(convertedEvents);
        setUpcomingEvents(convertedEvents); // Show all events, not just 6
        // Set first 5 events as featured for carousel
        if (convertedEvents.length > 0) {
          const featured = convertedEvents.slice(0, Math.min(5, convertedEvents.length));
          setFeaturedEvents(featured);
          // Initialize animated scales for each card
          animatedScales.current = featured.map((_, index) =>
            new Animated.Value(index === 0 ? 1 : 0.92)
          );
        }
      }
    } catch (error: any) {
      setErrorModalMessage(error.response?.data?.message || 'Failed to load events');
      setShowErrorModal(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    loadEvents(true);
  };

  const filteredEvents = useMemo(() => {
    // "My Events" tab: show createdEvents from profile cache (localStorage) when available
    if (activeFilter === 'myevents' && user?.createdEvents && Array.isArray(user.createdEvents) && user.createdEvents.length > 0) {
      const first = user.createdEvents[0];
      if (typeof first === 'object' && first !== null && (first.id || first._id)) {
        return user.createdEvents.map((e: any) => convertCachedEvent(e));
      }
    }
    return upcomingEvents.filter((event) =>
      eventMatchesFilter(event, activeFilter, user?._id)
    );
  }, [upcomingEvents, activeFilter, user?._id, user?.createdEvents]);

  const safeTop = 60 + insets.top;
  const headerRowHeight = 52;
  const filterRowHeight = 44;
  const headerHeight = safeTop + headerRowHeight + filterRowHeight;

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    const diff = y - lastScrollY.current;
    if (y <= 30) {
      Animated.timing(headerTranslateY, { toValue: 0, duration: 200, useNativeDriver: true }).start();
    } else if (diff > 15) {
      Animated.timing(headerTranslateY, { toValue: -headerHeight, duration: 200, useNativeDriver: true }).start();
    } else if (diff < -15) {
      Animated.timing(headerTranslateY, { toValue: 0, duration: 200, useNativeDriver: true }).start();
    }
    lastScrollY.current = y;
  };

  return (
    <View className="flex-1 bg-white">
      {/* Header: hides when scrolling down, shows when scrolling up */}
      <Animated.View
        pointerEvents="box-none"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 10,
          transform: [{ translateY: headerTranslateY }],
        }}
      >
        <View
          className="bg-white border-b border-gray-200"
          style={{ paddingTop: safeTop }}
          pointerEvents="box-none"
        >
          <View className="px-5 pb-3 flex-row items-center justify-between" pointerEvents="box-none">
            <View className="w-10" />
            <Text className="text-2xl font-bold text-gray-900">ticketly</Text>
            <TouchableOpacity
              className="w-10 h-10 items-center justify-center"
              onPress={() => router.push('/(tabs)/explore')}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <MaterialIcons name="search" size={26} color="#111827" />
            </TouchableOpacity>
          </View>
          {/* Filter chips: sticky with header on scroll up */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 12 }}
            className="flex-row"
          >
            {FILTER_OPTIONS.map(({ key, label }) => {
              const isActive = activeFilter === key;
              return (
                <TouchableOpacity
                  key={key}
                  onPress={() => setActiveFilter(key)}
                  className="rounded-full px-4 py-2 mr-2"
                  style={{
                    backgroundColor: isActive ? '#FEF2F2' : '#F3F4F6',
                    borderWidth: isActive ? 2 : 0,
                    borderColor: isActive ? '#DC2626' : 'transparent',
                  }}
                >
                  <Text
                    className="text-sm font-semibold"
                    style={{ color: isActive ? '#DC2626' : '#6B7280' }}
                  >
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </Animated.View>

      {/* Content: paddingTop so list starts below header; header hides on scroll down, shows on scroll up */}
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingTop: headerHeight, paddingBottom: bottomPadding }}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        overScrollMode="always"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#DC2626"
            colors={["#DC2626"]}
          />
        }
      >
        {/* Upcoming Events */}
        <View className="px-5 pt-5">
          <Text className="text-gray-900 text-xl font-bold mb-4">Upcoming Events</Text>
          {loading ? (
            <View className="flex-row flex-wrap justify-between">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <EventCardSkeleton key={i} />
              ))}
            </View>
          ) : filteredEvents.length === 0 ? (
            <View className="py-14 items-center justify-center">
              <MaterialIcons name="event-busy" size={48} color="#4B5563" />
              <Text className="text-[#9CA3AF] text-base font-medium mt-3">No data found</Text>
              <Text className="text-[#6B7280] text-sm mt-1 text-center px-6">
                {activeFilter === 'myevents'
                  ? "You haven't created any events yet."
                  : upcomingEvents.length === 0
                    ? 'No events available yet.'
                    : 'No events match this filter.'}
              </Text>
              {activeFilter === 'myevents' && (
                <TouchableOpacity
                  className="bg-primary py-4 px-8 rounded-xl mt-6"
                  onPress={() => router.push('/create-event')}
                  activeOpacity={0.8}
                >
                  <Text className="text-white text-base font-semibold">Create event</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <View className="flex-row flex-wrap justify-between">
              {filteredEvents.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      <Modal
        visible={showErrorModal}
        onClose={() => setShowErrorModal(false)}
        title="Error"
        message={errorModalMessage}
        primaryButtonText="OK"
        onPrimaryPress={() => setShowErrorModal(false)}
        variant="error"
      />
    </View>
  );
}
