import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  FlatList,
  Text,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { authAPI } from '@/lib/api/auth';
import { getEventImageUrl, getProfileImageUrl, EVENT_PLACEHOLDER } from '@/lib/utils/imageUtils';
import { EventCard } from '@/components/EventCard';
import { EventCardSkeleton } from '@/components/EventCardSkeleton';
import { useFocusEffect } from 'expo-router';
import { Modal } from '@/components/Modal';
import { BackButton } from '@/components/BackButton';
import { useBottomPadding } from '@/hooks/useBottomPadding';
import { useAppStore } from '@/store/useAppStore'; // ← assuming you use this for user state

// Reuse same card width/spacing logic as home screen
const { width } = Dimensions.get('window');
const CARD_WIDTH = width * 0.82;
const CARD_SPACING = 16;
const HORIZONTAL_PADDING = (width - CARD_WIDTH) / 2;

const convertEvent = (apiEvent: any) => {
  const eventId = apiEvent._id || apiEvent.id;
  const priceValue = apiEvent.ticketPrice || apiEvent.price?.price || 0;

  return {
    id: eventId || '',
    title: apiEvent.title || '',
    description: apiEvent.description || '',
    date: apiEvent.date ? String(apiEvent.date).split('T')[0] : '',
    time: apiEvent.time || '',
    venue: apiEvent.location || '',
    city: (apiEvent.location || '').split(',')[0] || apiEvent.location || '',
    image: getEventImageUrl(apiEvent) || EVENT_PLACEHOLDER,
    organizerId: apiEvent.createdBy?._id || '',
    organizerName: apiEvent.createdBy?.fullName || apiEvent.organizerName || 'Organizer',
    price: priceValue,
    accessType: priceValue > 0 ? 'paid' : 'open',
    joinedUsers: (apiEvent.joinedUsers || []).map((u: any) => ({
      id: u._id || u.id,
      name: u.fullName || u.name,
      avatarUrl: getProfileImageUrl(u),
    })),
    joinedCount: apiEvent.joinedCount ?? (apiEvent.joinedUsers?.length ?? 0),
    // Adding fields that home screen version likely expects
    hostAvatarUrl: apiEvent.createdBy ? getProfileImageUrl(apiEvent.createdBy) : null,
    category: 'Event', // or derive if you have category field
  };
};

export default function LikedEventsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const bottomPadding = useBottomPadding();
  const user = useAppStore((state) => state.user);

  const [likedEvents, setLikedEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchLikedEvents = async (isRefreshing = false) => {
    if (!user?._id) {
      setLikedEvents([]);
      setLoading(false);
      return;
    }

    try {
      if (isRefreshing) setRefreshing(true);
      else setLoading(true);

      const response = await authAPI.getProfile();

      if (response.success && response.user?.likedEvents) {
        console.log('likedEvents raw length:', response.user.likedEvents.length);

        const liked = response.user.likedEvents
          .filter((e: any) => e && typeof e === 'object' && (e._id || e.id))
          .map(convertEvent);

        console.log('processed liked events:', liked.length);
        setLikedEvents(liked);
      } else {
        setLikedEvents([]);
      }
    } catch (error: any) {
      console.error('Failed to fetch liked events:', error?.message || error);
      // IMPORTANT: Do NOT clear list on error → keep previous good data
      // setLikedEvents([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchLikedEvents();
    }, [user?._id])
  );

  // Debug: log whenever likedEvents changes
  useEffect(() => {
    console.log('likedEvents state updated → length:', likedEvents.length);
  }, [likedEvents]);

  return (
    <View className="flex-1 bg-white">
      {/* Header */}
      <View
        className="px-4 py-2 shadow-xs flex-row items-center gap-2 bg-white z-10"
        style={{ paddingTop: insets.top + 8 }}
      >
        <BackButton onPress={() => router.back()} />
        <Text className="text-lg font-bold text-gray-900">Liked Events</Text>
      </View>

      {/* Content - matched layout with home screen */}
      <FlatList
        data={
          loading
            ? Array.from({ length: 6 }, (_, i) => ({ id: `skeleton-${i}`, isSkeleton: true }))
            : likedEvents
        }
        keyExtractor={(item) => item.id || item._id || String(Math.random())}
        numColumns={2}
        columnWrapperStyle={{
          gap: 4,
          marginBottom: 4,
        }}
        contentContainerStyle={{
          paddingTop: insets.top + 4,
          paddingHorizontal: 2,
          paddingBottom: bottomPadding + 16,
          flexGrow: 1,
        }}
        renderItem={({ item }) => (
          <View className="flex-1">
            {item.isSkeleton ? (
              <EventCardSkeleton />
            ) : (
              <EventCard event={item} />
              // ^^^ Same call style as in home/index page
            )}
          </View>
        )}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchLikedEvents(true)}
            tintColor="#DC2626"
            colors={['#DC2626']}
          />
        }
        ListEmptyComponent={
          !loading ? (
            <View className="flex-1 items-center justify-center py-20 px-6">
              <Text className="text-gray-500 text-base font-medium">
                No events liked yet
              </Text>
              <Text className="text-gray-400 text-sm mt-2 text-center">
                Events you like will appear here.
              </Text>
            </View>
          ) : null
        }
      />
    </View>
  );
}