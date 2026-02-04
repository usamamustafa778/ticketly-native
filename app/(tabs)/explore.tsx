import { EventCardSkeleton } from '@/components/EventCardSkeleton';
import { useAppStore } from '@/store/useAppStore';
import { eventsAPI } from '@/lib/api/events';
import { CACHE_KEYS, getCached, setCached } from '@/lib/cache';
import { useRouter, useFocusEffect } from 'expo-router';
import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import AnimatedReanimated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  cancelAnimation,
} from 'react-native-reanimated';
import { getEventImageUrl, getProfileImageUrl } from '@/lib/utils/imageUtils';
import {
  Animated,
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Text,
  TextInput,
  View,
  Platform,
  RefreshControl,
  ScrollView,
  Dimensions,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBottomPadding } from '@/hooks/useBottomPadding';
import { Modal } from '@/components/Modal';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import type { Event } from '@/lib/api/events';
import type { Event as AppEvent } from '@/data/mockData';

const CATEGORY_ORDER = [
  'Music',
  'Sports',
  'Technology',
  'Conference',
  'Workshop',
  'Social',
  'Arts',
  'Education',
  'Health',
  'Business',
  'Food & Drink',
  'Community',
  'Other',
];

function categoryForDisplay(apiCategory: string | undefined): string {
  if (!apiCategory?.trim()) return 'Other';
  const lower = apiCategory.trim().toLowerCase();
  const found = CATEGORY_ORDER.find((o) => o.toLowerCase() === lower);
  return found || 'Other';
}

function getEventPrice(apiEvent: Event): number {
  if (apiEvent.price?.price === 'free' || apiEvent.price?.currency === null) return 0;
  if (typeof apiEvent.price?.price === 'number') return apiEvent.price.price;
  return apiEvent.ticketPrice ?? 0;
}

const convertEvent = (apiEvent: Event): AppEvent => {
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
    category: categoryForDisplay(apiEvent.category),
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

const IMAGE_GAP = 1;

export default function ExploreScreen() {
  const router = useRouter();
  const events = useAppStore((state) => state.events);
  const setEvents = useAppStore((state) => state.setEvents);
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorModalMessage, setErrorModalMessage] = useState('');
  const [sBackgroundFetching, setIsBackgroundFetching] = useState(false);
  const loadingLineProgress = useSharedValue(0);
  const lastScrollY = useRef(0);
  const headerTranslateY = useRef(new Animated.Value(0)).current;

  // Dynamic bottom padding: Gestures (insets.bottom > 0) = safe area + 20px; Buttons (insets.bottom === 0) = 10px
  const bottomPadding = useBottomPadding();

  const loadEvents = useCallback(async (showRefreshing = false) => {
    // Public data: try cache first for instant display, but skip cache that looks like Home data (category "Event" → all show as "Other")
    let hadCache = false;
    if (!showRefreshing) {
      const cached = await getCached<any[]>(CACHE_KEYS.EVENTS_APPROVED);
      if (cached && Array.isArray(cached) && cached.length > 0) {
        const hasRealCategories = cached.some(
          (e: any) => e.category && e.category !== 'Event' && CATEGORY_ORDER.includes(e.category)
        );
        if (hasRealCategories) {
          hadCache = true;
          setEvents(cached);
          setLoading(false);
        }
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
      }
    } catch (error: any) {
      setErrorModalMessage(error.response?.data?.message || 'Failed to load events');
      setShowErrorModal(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setIsBackgroundFetching(false);
    }
  }, []);

  // Run events API every time user enters Explore so categories are always correct (not overwritten by Home's "Event" category)
  useFocusEffect(
    useCallback(() => {
      loadEvents();
    }, [loadEvents])
  );

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

  const onRefresh = () => {
    loadEvents(true);
  };

  const filteredEvents = useMemo(() => {
    if (!searchQuery.trim()) {
      return events;
    }
    const query = searchQuery.toLowerCase();
    return events.filter(
      (event) =>
        event.title.toLowerCase().includes(query) ||
        event.description.toLowerCase().includes(query) ||
        event.venue.toLowerCase().includes(query) ||
        event.city.toLowerCase().includes(query) ||
        (event.category && event.category.toLowerCase().includes(query))
    );
  }, [events, searchQuery]);

  const eventsByCategory = useMemo(() => {
    const groups: Record<string, AppEvent[]> = {};
    for (const e of filteredEvents) {
      const cat = e.category || 'Other';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(e);
    }
    return groups;
  }, [filteredEvents]);

  const orderedCategories = useMemo(() => {
    const fromOrder = CATEGORY_ORDER.filter((cat) => eventsByCategory[cat]?.length);
    const rest = Object.keys(eventsByCategory).filter((cat) => !CATEGORY_ORDER.includes(cat));
    return [...fromOrder, ...rest];
  }, [eventsByCategory]);

  const safeTop = insets.top + 12;
  const headerContentHeight = 56;
  const headerHeight = safeTop + headerContentHeight;

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
          className="bg-white shadow-xs overflow-hidden"
          style={{ paddingTop: safeTop }}
        >
          {/* Search bar with icons (Pinterest-style) - same horizontal padding as Home */}
          <View className="pb-2 flex-row items-center gap-2" style={{ paddingHorizontal: 2 }}>
            <View className="flex-1 flex-row items-center bg-gray-100 rounded-xl px-3 py-2.5 gap-2">
              <MaterialIcons name="search" size={22} color="#6B7280" />
              <TextInput
                className="flex-1 text-gray-900 text-base py-0"
                placeholder="Search for events"
                placeholderTextColor="#6B7280"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>
          </View>
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
      </Animated.View>

      {/* List: paddingTop so content starts below header; pull-to-refresh on both loading and list */}
      {loading ? (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingTop: headerHeight,
            paddingHorizontal: 2,
            paddingBottom: bottomPadding,
          }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#DC2626"
              colors={["#DC2626"]}
            />
          }
        >
          <View className="flex-row flex-wrap" style={{ gap: 2 }}>
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <View key={i} className="flex-1 min-w-[48%]">
                <EventCardSkeleton />
              </View>
            ))}
          </View>
        </ScrollView>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingTop: headerHeight,
            paddingHorizontal: 2,
            paddingBottom: bottomPadding,
          }}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#DC2626"
              colors={["#DC2626"]}
            />
          }
        >
          {orderedCategories.length === 0 ? (
            <View className="items-center justify-center py-20" style={{ paddingHorizontal: 2 }}>
              <MaterialIcons name="event-busy" size={56} color="#9CA3AF" />
              <Text className="text-gray-500 text-base mt-4 text-center">No events found</Text>
            </View>
          ) : (
            orderedCategories.map((category) => {
              const categoryEvents = eventsByCategory[category] || [];
              const displayEvents = categoryEvents.slice(0, 4);
              return (
                <View key={category} className="mb-6">
                  <View className="flex-row items-center justify-between px-2 mb-3">
                    <Text className="text-gray-900 text-xl font-bold">{category}</Text>
                    <TouchableOpacity
                      onPress={() => router.push(`/events/${encodeURIComponent(category)}`)}
                      className="w-9 h-9 rounded-full bg-gray-100 items-center justify-center"
                    >
                      <MaterialIcons name="search" size={20} color="#374151" />
                    </TouchableOpacity>
                  </View>
                  <View
                    className="flex-row mb-3 border border-transparent rounded-2xl overflow-hidden"
                    style={{ gap: IMAGE_GAP }}
                  >
                    {displayEvents.map((event) => (
                      <TouchableOpacity
                        key={event.id}
                        activeOpacity={0.85}
                        style={{ flex: 1, aspectRatio: 2 / 4 }}
                        onPress={() => router.push(`/event-details/${event.id}`)}
                        className="overflow-hidden max-w-[50%] bg-gray-200"
                      >
                        <Image
                          source={{ uri: event.image || 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=800' }}
                          className="w-full h-full "
                          resizeMode="cover"
                        />
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
      )}

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
