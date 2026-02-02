import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
  Platform,
  Modal as RNModal,
  Pressable,
  PanResponder,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { authAPI, type PublicUserProfile } from '@/lib/api/auth';
import { CACHE_KEYS, getCached, setCached } from '@/lib/cache';
import { getProfileImageUrl, getEventImageUrl } from '@/lib/utils/imageUtils';
import { BackButton } from '@/components/BackButton';
import { EventCard } from '@/components/EventCard';
import { ButtonPrimary } from '@/components/ui/ButtonPrimary';
import { TabsRow } from '@/components/ui/Tabs';

type TabKey = 'created' | 'joined' | 'liked';

function convertEvent(apiEvent: any) {
  const eventId = apiEvent._id || apiEvent.id || (apiEvent as any)?._id || (apiEvent as any)?.id;
  const dateStr = apiEvent.date
    ? String(apiEvent.date).includes('T')
      ? String(apiEvent.date).split('T')[0]
      : apiEvent.date
    : '';
  const priceNum =
    apiEvent.price?.price === 'free' || apiEvent.price?.currency === null
      ? 0
      : typeof apiEvent.price?.price === 'number'
        ? apiEvent.price.price
        : apiEvent.ticketPrice ?? 0;
  return {
    id: eventId || '',
    title: apiEvent.title || '',
    description: apiEvent.description ?? '',
    date: dateStr,
    time: apiEvent.time || '',
    venue: apiEvent.location || '',
    city: (apiEvent.location || '').split(',')[0] || apiEvent.location || '',
    category: 'Event',
    image: getEventImageUrl(apiEvent as any) || 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=800',
    organizerId: apiEvent.createdBy?._id || apiEvent.createdBy?.id || '',
    organizerName: apiEvent.createdBy?.fullName || 'Organizer',
    price: priceNum,
    accessType: priceNum > 0 ? ('paid' as const) : ('open' as const),
    registeredUsers: [],
    likedUsers: [],
    hostAvatarUrl: apiEvent.createdBy ? getProfileImageUrl(apiEvent.createdBy as any) : null,
    joinedUsers: (apiEvent.joinedUsers || []).map((u: any) => ({
      id: u._id || u.id,
      name: u.name || u.fullName,
      avatarUrl: getProfileImageUrl({ profileImageUrl: u.profileImageUrl }) || undefined,
    })),
    joinedCount: apiEvent.joinedCount ?? (apiEvent.joinedUsers?.length ?? 0),
  };
}

export default function UserProfileScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const [profile, setProfile] = useState<PublicUserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('created');
  const [showImageViewer, setShowImageViewer] = useState(false);

  // No bottom tab bar on user page (outside tabs folder), so no extra bottom padding needed
  const bottomPadding = 20;

  const TAB_ORDER: TabKey[] = ['created', 'joined', 'liked'];
  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;

  const panResponder = useRef(
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
        const currentTab = activeTabRef.current;
        if (dx < -SWIPE_THRESHOLD) {
          const idx = TAB_ORDER.indexOf(currentTab);
          if (idx < TAB_ORDER.length - 1) setActiveTab(TAB_ORDER[idx + 1]);
        } else if (dx > SWIPE_THRESHOLD) {
          const idx = TAB_ORDER.indexOf(currentTab);
          if (idx > 0) setActiveTab(TAB_ORDER[idx - 1]);
        }
      },
    })
  ).current;

  const fetchProfile = useCallback(
    async (showRefreshing = false) => {
      if (!id) {
        setError('User ID is required');
        setLoading(false);
        return;
      }
      // Public data: cache first (works for logged-in and logged-out users)
      let hadCache = false;
      if (!showRefreshing) {
        const cached = await getCached<PublicUserProfile>(CACHE_KEYS.USER_PROFILE_BY_ID(id));
        if (cached) {
          hadCache = true;
          setProfile(cached);
          setError(null);
          setLoading(false);
        }
      }
      try {
        if (showRefreshing) setRefreshing(true);
        else if (!hadCache) setLoading(true);
        setError(null);
        const response = await authAPI.getUserProfileById(id);
        if (response.success && response.user) {
          await setCached(CACHE_KEYS.USER_PROFILE_BY_ID(id), response.user);
          setProfile(response.user);
        } else if (!hadCache) {
          setError('User not found');
        }
      } catch (err: any) {
        const msg = err.response?.data?.message || err.message || 'Failed to load profile';
        if (!hadCache) {
          setError(msg);
          setProfile(null);
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [id]
  );

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const onRefresh = () => fetchProfile(true);

  const createdEvents = (profile?.createdEvents || []).map(convertEvent);
  const joinedEvents = (profile?.joinedEvents || [])
    .map((item: any) => (item?.event ? convertEvent(item.event) : null))
    .filter((e): e is NonNullable<typeof e> => e != null);
  const likedEvents = (profile?.likedEvents || []).map(convertEvent);
  const showLikedTab = (profile?.likedEventsVisibility ?? 'public') === 'public';

  const currentEvents =
    activeTab === 'created' ? createdEvents : activeTab === 'joined' ? joinedEvents : likedEvents;

  const profileImageUrl = profile ? (getProfileImageUrl(profile) || undefined) : undefined;

  if (loading && !profile) {
    return (
      <View className="flex-1 bg-white">
        <View className="flex-1 items-center justify-center p-10">
          <ActivityIndicator size="large" color="#DC2626" />
          <Text className="text-gray-700 text-base mt-4">Loading profile...</Text>
        </View>
      </View>
    );
  }

  if (error || !profile) {
    return (
      <View className="flex-1 bg-white">
        <View className="flex-1 items-center justify-center p-10">
          <Text className="text-[#EF4444] text-lg mb-6">{error || 'User not found'}</Text>
          <ButtonPrimary onPress={() => router.back()}>
            Go Back
          </ButtonPrimary>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-white" {...panResponder.panHandlers}>
      {/* Fixed back button - stays on top when scrolling */}
      <View
        style={{
          position: 'absolute',
          top: insets.top + 8,
          left: 16,
          zIndex: 10,
        }}
      >
        <BackButton onPress={() => router.back()} />
      </View>
      <FlatList
        key={activeTab}
        data={currentEvents}
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: insets.top + 48,
          paddingBottom: bottomPadding,
          paddingHorizontal: 2,
        }}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={{ gap: 2, marginBottom: 2 }}
        renderItem={({ item }) => (
          <View className="flex-1">
            <EventCard
              event={item}
              onPress={() => router.push(`/event-details/${item.id}`)}
            />
          </View>
        )}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#DC2626"
            colors={['#DC2626']}
          />
        }
        ListHeaderComponent={
          <>
            <View className="items-center py-6 pb-4">
              <TouchableOpacity
                onPress={() => setShowImageViewer(true)}
                activeOpacity={0.8}
                className="relative"
              >
                <View className="w-[100px] h-[100px] rounded-full overflow-hidden">
                  <View className="w-full h-full rounded-full bg-primary items-center justify-center overflow-hidden">
                    {profileImageUrl ? (
                      <Image
                        source={{ uri: profileImageUrl }}
                        className="w-full h-full"
                        resizeMode="cover"
                      />
                    ) : (
                      <Text className="text-white text-4xl font-bold">
                        {(profile.fullName || profile.username || '?').charAt(0).toUpperCase()}
                      </Text>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
              <Text className="text-gray-900 text-2xl font-bold mb-1">
                {profile.fullName || profile.username || 'User'}
              </Text>
              {profile.username && (
                <Text className="text-gray-500 text-sm">@{profile.username}</Text>
              )}
              {profile.companyName && (
                <Text className="text-primary text-base font-semibold mt-1">{profile.companyName}</Text>
              )}
            </View>
            <View className="flex-row justify-around px-16 py-2">
              <View className="items-center">
                <Text className="text-gray-900 text-base font-bold mb-0.5">{createdEvents.length}</Text>
                <Text className="text-[#9CA3AF] text-[10px]">Created</Text>
              </View>
              <View className="items-center">
                <Text className="text-gray-900 text-base font-bold mb-0.5">{joinedEvents.length}</Text>
                <Text className="text-[#9CA3AF] text-[10px]">Joined</Text>
              </View>
              <View className="items-center">
                <Text className="text-gray-900 text-base font-bold mb-0.5">{likedEvents.length}</Text>
                <Text className="text-[#9CA3AF] text-[10px]">Liked</Text>
              </View>
            </View>
            <View className="mx-10">
              <View className="py-2 mb-3 translate-y-[-2px] bg-white">
                <TabsRow
                  items={[
                    { key: 'created', label: 'Created Events' },
                    { key: 'joined', label: 'Joined Events' },
                    { key: 'liked', label: 'Liked Events' },
                  ]}
                  activeKey={activeTab}
                  onSelect={setActiveTab}
                />
              </View>
            </View>
          </>
        }
        ListEmptyComponent={
          <View className="px-3 py-10 items-center">
            <MaterialIcons name="event-busy" size={48} color="#4B5563" />
            <Text className="text-[#9CA3AF] text-base mt-3">
              No {activeTab} events yet
            </Text>
          </View>
        }
      />

      {/* Profile Image Viewer (same as profile page) */}
      <RNModal
        visible={showImageViewer}
        transparent
        animationType="fade"
        onRequestClose={() => setShowImageViewer(false)}
      >
        <Pressable
          className="flex-1 bg-black justify-center items-center"
          onPress={() => setShowImageViewer(false)}
        >
          <View className="w-[320px] h-[320px] rounded-full overflow-hidden items-center justify-center bg-primary">
            {profileImageUrl ? (
              <Image
                source={{ uri: profileImageUrl }}
                className="w-full h-full"
                resizeMode="cover"
              />
            ) : (
              <Text className="text-white text-8xl font-bold">
                {(profile?.fullName || profile?.username || '?').charAt(0).toUpperCase()}
              </Text>
            )}
          </View>
          <TouchableOpacity
            className="absolute right-4 bg-white/20 w-10 h-10 rounded-full items-center justify-center"
            style={{ top: insets.top + 8 }}
            onPress={() => setShowImageViewer(false)}
          >
            <MaterialIcons name="close" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </Pressable>
      </RNModal>
    </View>
  );
}
