import { EventCard } from '@/components/EventCard';
import { EventCardSkeleton } from '@/components/EventCardSkeleton';
import { BackButton } from '@/components/BackButton';
import { eventsAPI } from '@/lib/api/events';
import type { Event } from '@/lib/api/events';
import { CACHE_KEYS, getCached, setCached } from '@/lib/cache';
import { getEventImageUrl, getProfileImageUrl, EVENT_PLACEHOLDER } from '@/lib/utils/imageUtils';
import { useAppStore } from '@/store/useAppStore';
import { useRouter, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBottomPadding } from '@/hooks/useBottomPadding';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import type { Event as AppEvent } from '@/data/mockData';

const CATEGORY_ORDER = [
  'Music', 'Sports', 'Technology', 'Conference', 'Workshop', 'Social',
  'Arts', 'Education', 'Health', 'Business', 'Food & Drink', 'Community', 'Other',
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

function convertEvent(apiEvent: Event): AppEvent {
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
    image: getEventImageUrl(apiEvent) || EVENT_PLACEHOLDER,
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
}

export default function EventsByCategoryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { category: categoryParam } = useLocalSearchParams<{ category: string }>();
  const category = categoryParam ? decodeURIComponent(categoryParam) : 'Other';
  const events = useAppStore((state) => state.events);
  const setEvents = useAppStore((state) => state.setEvents);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const bottomPadding = useBottomPadding();
  const { height } = Dimensions.get('window');

  const loadEvents = useCallback(async (showRefreshing = false) => {
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
  }, [setEvents]);

  useEffect(() => {
    if (events.length === 0) {
      loadEvents();
    } else {
      setLoading(false);
    }
  }, []);

  const categoryEvents = useMemo(
    () => events.filter((e) => (e.category || 'Other') === category),
    [events, category]
  );

  const safeTop = insets.top;
  const headerHeight = safeTop + 52;

  return (
    <View className="flex-1 bg-white">
      <View
        className="px-4 py-2 shadow-xs flex-row items-center gap-2 bg-white z-10"
        style={{ paddingTop: insets.top + 8 }}
      >
        <BackButton onPress={() => router.back()} />
        <Text className="text-lg font-bold text-gray-900">{category}</Text>
      </View>

      <FlatList
        data={loading ? Array.from({ length: 6 }, (_, i) => ({ id: `skeleton-${i}`, _skeleton: true } as any)) : categoryEvents}
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: insets.top + 4,
          paddingHorizontal: 2,
          paddingBottom: bottomPadding + 16,
          flexGrow: 1,
          minHeight: height - headerHeight - 80,
        }}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={{ gap: 4, marginBottom: 4 }}
        renderItem={({ item }) => (
          <View className="flex-1">
            {item._skeleton ? (
              <EventCardSkeleton />
            ) : (
              <EventCard
                event={item as AppEvent}
                onPress={() => router.push(`/event-details/${item.id}`)}
              />
            )}
          </View>
        )}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadEvents(true)}
            tintColor="#DC2626"
            colors={['#DC2626']}
          />
        }
        // ListHeaderComponent={
        //     <View className="px-0 mb-4 mt-2">
        //       <Text className="text-gray-900 text-lg font-semibold mt-0.5">{category}</Text>
        //     </View>
        // }
        ListEmptyComponent={
          !loading ? (
            <View className="py-14 items-center justify-center">
              <MaterialIcons name="event-busy" size={48} color="#4B5563" />
              <Text className="text-gray-500 text-base font-medium mt-3">No events in this category</Text>
              <Text className="text-gray-400 text-sm mt-1 text-center px-6">
                There are no events in "{category}" right now.
              </Text>
            </View>
          ) : null
        }
      />
    </View>
  );
}
