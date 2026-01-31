import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
  Platform,
  Modal as RNModal,
  Pressable,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { authAPI, type PublicUserProfile } from '@/lib/api/auth';
import { getProfileImageUrl, getEventImageUrl } from '@/lib/utils/imageUtils';
import { EventCard } from '@/components/EventCard';

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
      avatarUrl: u.profileImageUrl || u.avatarUrl,
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

  const tabBarTotalHeight = Platform.OS === 'ios' ? 90 + insets.bottom : 75 + Math.max(insets.bottom, 50) + 10 + insets.bottom;
  const bottomPadding = tabBarTotalHeight + 20;

  const fetchProfile = useCallback(
    async (showRefreshing = false) => {
      if (!id) {
        setError('User ID is required');
        setLoading(false);
        return;
      }
      try {
        if (showRefreshing) setRefreshing(true);
        else setLoading(true);
        setError(null);
        const response = await authAPI.getUserProfileById(id);
        if (response.success && response.user) {
          setProfile(response.user);
        } else {
          setError('User not found');
        }
      } catch (err: any) {
        const msg = err.response?.data?.message || err.message || 'Failed to load profile';
        setError(msg);
        setProfile(null);
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
    .filter(Boolean);
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
          <TouchableOpacity
            className="bg-primary py-3 px-6 rounded-xl"
            onPress={() => router.back()}
          >
            <Text className="text-white text-base font-semibold">Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-white pt-[60px]">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: bottomPadding }}
        showsVerticalScrollIndicator={false}
        stickyHeaderIndices={[3]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#DC2626"
            colors={['#DC2626']}
          />
        }
      >
        {/* Header - Back button */}
        <View className="flex-row justify-end items-center px-5 pt-5 pb-2">
          <TouchableOpacity
            className="bg-gray-100 w-10 h-10 rounded-lg items-center justify-center"
            onPress={() => router.back()}
          >
            <MaterialIcons name="arrow-back" size={24} color="#111827" />
          </TouchableOpacity>
        </View>

        {/* Profile Section - Centered (similar to profile page) */}
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

        {/* Stats (compact, like profile page) */}
        <View className="flex-row justify-around px-5 py-2">
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

        {/* Tabs */}
        <View className="flex-row px-5 py-2 mb-3 gap-2 bg-white">
          <TouchableOpacity
            className={`flex-1 py-2 items-center rounded-md ${activeTab === 'created' ? 'bg-primary' : 'bg-gray-100'}`}
            onPress={() => setActiveTab('created')}
          >
            <Text className={`text-[10px] font-semibold ${activeTab === 'created' ? 'text-white' : 'text-[#9CA3AF]'}`}>
              Created Events
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            className={`flex-1 py-2 items-center rounded-md ${activeTab === 'joined' ? 'bg-primary' : 'bg-gray-100'}`}
            onPress={() => setActiveTab('joined')}
          >
            <Text className={`text-[10px] font-semibold ${activeTab === 'joined' ? 'text-white' : 'text-[#9CA3AF]'}`}>
              Joined Events
            </Text>
          </TouchableOpacity>
          {showLikedTab ? (
            <TouchableOpacity
              className={`flex-1 py-2 items-center rounded-md ${activeTab === 'liked' ? 'bg-primary' : 'bg-gray-100'}`}
              onPress={() => setActiveTab('liked')}
            >
              <Text className={`text-[10px] font-semibold ${activeTab === 'liked' ? 'text-white' : 'text-[#9CA3AF]'}`}>
                Liked Events
              </Text>
            </TouchableOpacity>
          ) : (
            <View className="flex-1 py-2 items-center rounded-md bg-gray-100 opacity-60">
              <Text className="text-[#9CA3AF] text-[10px] font-semibold">Liked (Private)</Text>
            </View>
          )}
        </View>

        {/* Events List */}
        <View className="px-5 mb-8">
          {currentEvents.length === 0 ? (
            <View className="py-10 items-center">
              <MaterialIcons name="event-busy" size={48} color="#4B5563" />
              <Text className="text-[#9CA3AF] text-base mt-3">
                No {activeTab} events yet
              </Text>
            </View>
          ) : (
            <View className="flex-row flex-wrap justify-between">
              {currentEvents.map((event) => (
                <EventCard
                  key={event.id}
                  event={event}
                  onPress={() => router.push(`/event-details/${event.id}`)}
                />
              ))}
            </View>
          )}
        </View>
      </ScrollView>

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
