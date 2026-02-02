import { EventCard } from '@/components/EventCard';
import { EventCardSkeleton } from '@/components/EventCardSkeleton';
import { Modal } from '@/components/Modal';
import { ButtonPrimary } from '@/components/ui/ButtonPrimary';
import { Tabs } from '@/components/ui/Tabs';
import { authAPI, PROFILE_CACHE_KEY } from '@/lib/api/auth';
import type { Event } from '@/lib/api/events';
import { eventsAPI } from '@/lib/api/events';
import { CACHE_KEYS, getCached, setCached } from '@/lib/cache';
import { getEventImageUrl, getProfileImageUrl } from '@/lib/utils/imageUtils';
import { useAppStore } from '@/store/useAppStore';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import AnimatedReanimated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  cancelAnimation,
} from 'react-native-reanimated';
import {
  Animated,
  Dimensions,
  FlatList,
  PanResponder,
  Platform,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBottomPadding } from '@/hooks/useBottomPadding';

export type HomeFilter = 'explore' | 'following' | 'today' | 'upcoming';

const FILTER_OPTIONS: { key: HomeFilter; label: string }[] = [
  { key: 'explore', label: 'Explore' },
  { key: 'following', label: 'Following' },
  { key: 'today', label: 'Today' },
  { key: 'upcoming', label: 'Upcoming' },
];

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function eventMatchesFilter(
  event: { id: string; date: string },
  filter: HomeFilter,
  userId?: string,
  joinedEventIds?: string[]
): boolean {
  if (filter === 'explore') return true;
  if (filter === 'following') {
    if (!joinedEventIds?.length) return false;
    return joinedEventIds.includes(event.id);
  }
  if (filter === 'today') {
    const parts = event.date.split('-').map(Number);
    const eventDate = new Date(parts[0], (parts[1] || 1) - 1, parts[2] || 1);
    eventDate.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return isSameDay(eventDate, today);
  }
  return true;
}

function getJoinedEventIds(user: { joinedEvents?: string[] | { event?: { _id?: string; id?: string } }[] } | null): string[] {
  if (!user?.joinedEvents || !Array.isArray(user.joinedEvents)) return [];
  return user.joinedEvents
    .map((j: any) => (typeof j === 'string' ? j : j?.event?._id || j?.event?.id))
    .filter(Boolean);
}

const { width, height } = Dimensions.get('window');
const CARD_WIDTH = width * 0.82; // 82% of screen width for better peek effect
const CARD_SPACING = 16; // Space between cards
const HORIZONTAL_PADDING = (width - CARD_WIDTH) / 2; // Center padding to center the cards

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
      avatarUrl: getProfileImageUrl({ profileImageUrl: user.profileImageUrl }) || undefined,
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
  const [activeFilter, setActiveFilter] = useState<HomeFilter>('explore');
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorModalMessage, setErrorModalMessage] = useState('');
  const [sBackgroundFetching, setIsBackgroundFetching] = useState(false);
  const loadingLineProgress = useSharedValue(0);
  const [currentSlide, setCurrentSlide] = useState(0);
  const filterScrollRef = useRef<ScrollView | null>(null);
  const tabLayoutsRef = useRef<Record<string, { x: number; width: number }>>({});
  const scrollX = useRef(new Animated.Value(0)).current;
  const animatedScales = useRef<Animated.Value[]>([]);
  const activeFilterRef = useRef(activeFilter);
  activeFilterRef.current = activeFilter;

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
        const SWIPE_THRESHOLD = 40;
        const currentFilter = activeFilterRef.current;
        const idx = FILTER_OPTIONS.findIndex((f) => f.key === currentFilter);
        if (dx < -SWIPE_THRESHOLD && idx < FILTER_OPTIONS.length - 1) {
          const nextKey = FILTER_OPTIONS[idx + 1].key;
          if (nextKey === 'upcoming') router.push('/event-filter');
          else setActiveFilter(nextKey);
        } else if (dx > SWIPE_THRESHOLD && idx > 0) {
          setActiveFilter(FILTER_OPTIONS[idx - 1].key);
        }
      },
    })
  ).current;

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

  // Dynamic bottom padding: Gestures (insets.bottom > 0) = safe area + 20px; Buttons (insets.bottom === 0) = 10px
  const bottomPadding = useBottomPadding();

  useEffect(() => {
    // Load events on mount - no authentication required
    loadEvents();
  }, []);

  const loadEvents = async (showRefreshing = false) => {
    // Public data: always try cache first (works for logged-in and logged-out users)
    let hadCache = false;
    if (!showRefreshing) {
      const cached = await getCached<any[]>(CACHE_KEYS.EVENTS_APPROVED);
      if (cached && Array.isArray(cached) && cached.length > 0) {
        hadCache = true;
        setEvents(cached);
        setUpcomingEvents(cached);
        const featured = cached.slice(0, Math.min(5, cached.length));
        setFeaturedEvents(featured);
        animatedScales.current = featured.map((_, index) =>
          new Animated.Value(index === 0 ? 1 : 0.92)
        );
        setLoading(false);
      }
    }
    try {
      if (showRefreshing) setRefreshing(true);
      else if (!hadCache) setLoading(true);
      if (hadCache || showRefreshing) setIsBackgroundFetching(true);
      const response = await eventsAPI.getApprovedEvents();
      if (response.success && response.events) {
        const convertedEvents = response.events.map(convertEvent);
        await setCached(CACHE_KEYS.EVENTS_APPROVED, convertedEvents);
        setEvents(convertedEvents);
        setUpcomingEvents(convertedEvents);
        if (convertedEvents.length > 0) {
          const featured = convertedEvents.slice(0, Math.min(5, convertedEvents.length));
          setFeaturedEvents(featured);
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
      setIsBackgroundFetching(false);
    }
  };

  // Animated loading line - below top bar when cached/refreshing
  useEffect(() => {
    if (!sBackgroundFetching) {
      cancelAnimation(loadingLineProgress);
      loadingLineProgress.value = 0;
      return;
    }
    loadingLineProgress.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1200 }),
        withTiming(0, { duration: 0 })
      ),
      -1
    );
    return () => cancelAnimation(loadingLineProgress);
  }, [sBackgroundFetching, loadingLineProgress]);

  const screenWidth = Dimensions.get('window').width;
  const loadingLineAnimatedStyle = useAnimatedStyle(() => ({
    width: loadingLineProgress.value * screenWidth * 0.4,
  }));

  const onRefresh = async () => {
    await loadEvents(true);
    if (activeFilter === 'following' && user?._id) {
      try {
        const res = await authAPI.getProfile();
        if (res.success && res.user) setUser(res.user);
      } catch (_) {}
    }
  };

  const joinedEventIds = useMemo(() => getJoinedEventIds(user), [user]);

  const filteredEvents = useMemo(() => {
    if (activeFilter === 'upcoming') return upcomingEvents;
    return upcomingEvents.filter((event) => eventMatchesFilter(event, activeFilter, user?._id, joinedEventIds));
  }, [upcomingEvents, activeFilter, user?._id, joinedEventIds]);

  const safeTop = insets.top + 12;
  const filterRowHeight = 36;
  const headerHeight = safeTop + filterRowHeight;
  const swipeAreaMinHeight = Math.max(400, height - headerHeight - bottomPadding - 20);

  // Scroll filter bar so active tab is at the start - multiple retries needed on native (layout timing)
  useEffect(() => {
    const scrollToActive = () => {
      if (!filterScrollRef.current) return;
      const layout = tabLayoutsRef.current[activeFilter];
      const idx = FILTER_OPTIONS.findIndex((f) => f.key === activeFilter);
      const padding = 12;
      let scrollX = 0;
      if (layout && typeof layout.x === 'number') {
        scrollX = Math.max(0, layout.x - padding);
      } else if (idx >= 0) {
        scrollX = Math.max(0, idx * 80 - padding);
      }
      filterScrollRef.current.scrollTo({ x: scrollX, animated: true });
    };
    const isNative = Platform.OS !== 'web';
    const delays = isNative ? [100, 300, 600, 900] : [0, 80, 200];
    const timeouts: ReturnType<typeof setTimeout>[] = [];
    delays.forEach((delay) => {
      timeouts.push(setTimeout(scrollToActive, delay));
    });
    return () => timeouts.forEach((t) => clearTimeout(t));
  }, [activeFilter]);

  return (
    <View className="flex-1 bg-white">
      {/* Header: fixed filter bar at top */}
      <View
        pointerEvents="box-none"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 10,
        }}
      >
        <View
          className="bg-white border-b border-gray-200 overflow-hidden"
          style={{ paddingTop: safeTop }}
          pointerEvents="box-none"
        >
          {/* Filters at top of page */}
          <Tabs
            items={FILTER_OPTIONS}
            activeKey={activeFilter === 'upcoming' ? 'explore' : activeFilter}
            onSelect={(key) => {
              if (key === 'upcoming') router.push('/event-filter');
              else setActiveFilter(key);
            }}
            onTabLayout={(key, layout) => {
              tabLayoutsRef.current[key] = layout;
            }}
            scrollRef={filterScrollRef}
            className="flex-row"
          />
          {/* Loading bar at bottom of top bar - when cached data + API running or pull-to-refresh */}
          {sBackgroundFetching && (
            <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, backgroundColor: '#E5E7EB', zIndex: 1, overflow: 'hidden' }}>
              <AnimatedReanimated.View
                style={[
                  {
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    height: 2,
                    backgroundColor: '#DC2626',
                    zIndex: 10,
                    ...(Platform.OS === 'android' && { elevation: 5 }),
                  },
                  loadingLineAnimatedStyle,
                ]}
              />
            </View>
          )}
        </View>
      </View>

      {/* Content: FlatList like explore page */}
      <View key={activeFilter} className="flex-1" style={{ minHeight: swipeAreaMinHeight }} {...filterPanResponder.panHandlers}>
        <FlatList
          data={loading ? Array.from({ length: 6 }, (_, i) => ({ id: `skeleton-${i}`, _skeleton: true } as any)) : filteredEvents}
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingTop:headerHeight,
            paddingHorizontal: 2,
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
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#DC2626"
              colors={["#DC2626"]}
            />
          }
          ListEmptyComponent={
            !loading ? (
              <View className="px-3 py-14 items-center justify-center">
                <MaterialIcons name="event-busy" size={48} color="#4B5563" />
                <Text className="text-[#9CA3AF] text-base font-medium mt-3">No data found</Text>
                <Text className="text-[#6B7280] text-sm mt-1 text-center px-3">
                  {activeFilter === 'following'
                    ? "You haven't joined any events yet."
                    : upcomingEvents.length === 0
                      ? 'No events available yet.'
                      : 'No events match this filter.'}
                </Text>
                {activeFilter === 'following' && (
                  <ButtonPrimary
                    size="lg"
                    className="mt-6"
                    onPress={() => setActiveFilter('explore')}
                  >
                    Explore events
                  </ButtonPrimary>
                )}
              </View>
            ) : null
          }
        />
      </View>

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
