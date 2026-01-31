import { EventCard } from '@/components/EventCard';
import { EventCardSkeleton } from '@/components/EventCardSkeleton';
import { useAppStore } from '@/store/useAppStore';
import { eventsAPI } from '@/lib/api/events';
import { useRouter } from 'expo-router';
import React, { useMemo, useState, useEffect, useRef } from 'react';
import { getEventImageUrl, getProfileImageUrl } from '@/lib/utils/imageUtils';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import {
  Animated,
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Platform,
  RefreshControl,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
      avatarUrl: user.profileImageUrl || undefined,
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
  const lastScrollY = useRef(0);
  const headerTranslateY = useRef(new Animated.Value(0)).current;

  // Calculate bottom padding: tab bar height + safe area bottom + extra padding
  // Tab bar layout: iOS height=90 (includes paddingBottom=30), Android height=75 + paddingBottom + marginBottom=10
  // Total space from bottom: iOS = 90 + insets.bottom, Android = 75 + max(insets.bottom, 50) + 10 + insets.bottom
  const tabBarTotalHeight = Platform.OS === 'ios' 
    ? 90 + insets.bottom // iOS: height includes padding, add safe area
    : 75 + Math.max(insets.bottom, 50) + 10 + insets.bottom; // Android: height + paddingBottom + marginBottom + safe area
  const bottomPadding = tabBarTotalHeight + 20; // Extra 20px for comfortable spacing

  useEffect(() => {
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

  const safeTop = 60 + insets.top;
  const headerContentHeight = 52 + 56; // logo row + search input row with padding
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
          className="bg-white border-b border-gray-200"
          style={{ paddingTop: safeTop }}
        >
          <View className="px-5 pb-3  flex-row items-center justify-between">
            <View className="w-10" />
            <Text className="text-2xl font-bold text-gray-900">ticketly</Text>
            <TouchableOpacity
              className="w-10 h-10 items-center justify-center"
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <MaterialIcons name="search" size={26} color="#111827" />
            </TouchableOpacity>
          </View>
          <View className="px-5 pb-4">
            <TextInput
              className="bg-gray-50 border border-gray-200 rounded-xl py-3 px-4 text-gray-900 text-sm"
              placeholder="Search by event..."
              placeholderTextColor="#6B7280"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
        </View>
      </Animated.View>

      {/* List: paddingTop so content starts below header; pull-to-refresh on both loading and list */}
      {loading ? (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingTop: headerHeight,
            padding: 20,
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
          <View className="flex-row flex-wrap justify-between">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <EventCardSkeleton key={i} />
            ))}
          </View>
        </ScrollView>
      ) : (
        <FlatList
          data={filteredEvents}
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingTop: headerHeight,
            padding: 20,
            paddingBottom: bottomPadding,
          }}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          renderItem={({ item }) => <EventCard event={item} />}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={{ justifyContent: 'space-between' }}
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
