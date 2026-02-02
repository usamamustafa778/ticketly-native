import { EventCard } from '@/components/EventCard';
import { EventCardSkeleton } from '@/components/EventCardSkeleton';
import { useAppStore } from '@/store/useAppStore';
import { eventsAPI } from '@/lib/api/events';
import { CACHE_KEYS, getCached, setCached } from '@/lib/cache';
import { useRouter } from 'expo-router';
import React, { useMemo, useState, useEffect, useRef } from 'react';
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
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Text,
  TextInput,
  View,
  Platform,
  RefreshControl,
  ScrollView,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBottomPadding } from '@/hooks/useBottomPadding';
import { Modal } from '@/components/Modal';
import type { Event } from '@/lib/api/events';

// Helper function to convert API event to app event format
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

  useEffect(() => {
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
        event.city.toLowerCase().includes(query)
    );
  }, [events, searchQuery]);

  const safeTop = insets.top + 12;
  const headerContentHeight = 56; // search/filter input row with padding
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
          className="bg-white border-b border-gray-200 overflow-hidden"
          style={{ paddingTop: safeTop }}
        >
          {/* Search at top of page */}
          <View className="px-3 pb-1">
            <TextInput
              className="bg-gray-50 border border-gray-200 rounded-md py-0.5 px-4 text-gray-900 text-sm"
              placeholder="Search by event..."
              placeholderTextColor="#6B7280"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
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
        <FlatList
          data={filteredEvents}
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingTop: headerHeight - 20,
            paddingHorizontal: 2,
            paddingBottom: bottomPadding,
          }}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          renderItem={({ item }) => (
            <View className="flex-1">
              <EventCard event={item} />
            </View>
          )}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={{ gap: 2, marginBottom: 2 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#DC2626"
              colors={["#DC2626"]}
            />
          }
          ListEmptyComponent={
            <View className="flex-1 items-center justify-center py-15">
              <Text className="text-[#6B7280] text-base">No events found</Text>
            </View>
          }
        />
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
