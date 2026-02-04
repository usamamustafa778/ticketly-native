import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
  Modal as RNModal,
  Pressable,
  Dimensions,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBottomPadding } from '@/hooks/useBottomPadding';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { authAPI, type PublicUserProfile, type PublicUserSummary } from '@/lib/api/auth';
import { CACHE_KEYS, getCached, setCached } from '@/lib/cache';
import { getProfileImageUrl, getEventImageUrl } from '@/lib/utils/imageUtils';
import { BackButton } from '@/components/BackButton';
import { EventCard } from '@/components/EventCard';
import { ButtonPrimary } from '@/components/ui/ButtonPrimary';
import { TabsRow } from '@/components/ui/Tabs';
import { useAppStore } from '@/store/useAppStore';

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
  const currentUser = useAppStore((s) => s.user);
  const currentUserId = currentUser?._id || (currentUser as any)?.id;
  const isOwnProfile = !!id && !!currentUserId && id === currentUserId;

  const [profile, setProfile] = useState<PublicUserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('created');
  const [showImageViewer, setShowImageViewer] = useState(false);
  const [showCoverViewer, setShowCoverViewer] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [listModal, setListModal] = useState<'followers' | 'following' | null>(null);

  // Dynamic bottom padding: Gestures (insets.bottom > 0) = safe area + 20px; Buttons (insets.bottom === 0) = 10px
  const bottomPadding = useBottomPadding();

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

  const handleFollowToggle = useCallback(async () => {
    if (!id || followLoading || isOwnProfile) return;
    setFollowLoading(true);
    try {
      const isCurrentlyFollowing = profile?.isFollowing ?? false;
      if (isCurrentlyFollowing) {
        await authAPI.unfollowUser(id);
        const newCount = Math.max(0, (profile?.followerCount ?? 0) - 1);
        setProfile((p) => (p ? { ...p, isFollowing: false, followerCount: newCount } : p));
        await setCached(CACHE_KEYS.USER_PROFILE_BY_ID(id), profile ? { ...profile, isFollowing: false, followerCount: newCount } : null);
      } else {
        await authAPI.followUser(id);
        const newCount = (profile?.followerCount ?? 0) + 1;
        setProfile((p) => (p ? { ...p, isFollowing: true, followerCount: newCount } : p));
        await setCached(CACHE_KEYS.USER_PROFILE_BY_ID(id), profile ? { ...profile, isFollowing: true, followerCount: newCount } : null);
      }
    } catch (_) {
      fetchProfile(true);
    } finally {
      setFollowLoading(false);
    }
  }, [id, followLoading, isOwnProfile, profile]);

  const createdEvents = (profile?.createdEvents || []).map(convertEvent);
  const joinedEvents = (profile?.joinedEvents || [])
    .map((item: any) => (item?.event ? convertEvent(item.event) : null))
    .filter((e): e is NonNullable<typeof e> => e != null);
  const likedEvents = (profile?.likedEvents || []).map(convertEvent);
  const showLikedTab = (profile?.likedEventsVisibility ?? 'public') === 'public';
  const createdCount = createdEvents.length;
  const formatCount = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n));

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
    <View className="flex-1 bg-white">
      <FlatList
        key={activeTab}
        data={currentEvents}
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: 0,
          paddingBottom: bottomPadding,
          paddingHorizontal: 6,
        }}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={{ gap: 6, marginBottom: 6 }}
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
            tintColor="#2563EB"
            colors={['#2563EB']}
          />
        }
        ListHeaderComponent={
          <>
            {/* Banner / Cover (no rounded corners, like event-detail) */}
            <View className="w-full overflow-hidden" style={{ height: 160 }}>
              {/* Cover image background */}
              {profile.coverImageUrl ? (
                <Image
                  source={{ uri: getProfileImageUrl({ profileImageUrl: profile.coverImageUrl }) || '' }}
                  className="w-full h-full"
                  resizeMode="cover"
                />
              ) : (
                <View className="w-full h-full" style={{ backgroundColor: '#0f766e' }} />
              )}
              
              {/* Tap area for viewing cover in full screen (only if cover exists) */}
              {profile.coverImageUrl && (
                <TouchableOpacity
                  activeOpacity={1}
                  onPress={() => setShowCoverViewer(true)}
                  style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1 }}
                />
              )}
              
              {/* Nav overlays on banner */}
              <View
                pointerEvents="box-none"
                className="absolute inset-0 flex-row justify-between items-start px-4"
                style={{ paddingTop: insets.top + 8, zIndex: 5 }}
              >
                <BackButton variant="dark" onPress={() => router.back()} />
                <View className="flex-row gap-2">
                  <TouchableOpacity className="w-9 h-9 rounded-full bg-black/30 items-center justify-center" onPress={() => {}}>
                    <MaterialIcons name="more-horiz" size={22} color="#fff" />
                  </TouchableOpacity>
                  <TouchableOpacity className="w-9 h-9 rounded-full bg-black/30 items-center justify-center" onPress={() => {}}>
                    <MaterialIcons name="search" size={22} color="#fff" />
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* Bottom page container: white card with rounded top (like event-detail) */}
            <View className="bg-white rounded-t-3xl -mt-5 border-t border-gray-200">
            {/* Profile pic overlapping + name + stats + actions */}
            <View className="px-4" style={{ marginTop: -32 }}>
              <View className="flex-row items-end">
                <TouchableOpacity
                  onPress={() => setShowImageViewer(true)}
                  activeOpacity={0.8}
                  className="rounded-full overflow-hidden border-4 border-white bg-primary"
                  style={{ width: 96, height: 96 }}
                >
                  {profileImageUrl ? (
                    <Image source={{ uri: profileImageUrl }} className="w-full h-full" resizeMode="cover" />
                  ) : (
                    <View className="w-full h-full items-center justify-center">
                      <Text className="text-white text-3xl font-bold">
                        {(profile.fullName || profile.username || '?').charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
                <View className="flex-1 ml-4 pb-1">
                  <Text className="text-gray-900 text-xl font-bold" numberOfLines={1}>
                    {profile.fullName || profile.username || 'User'}
                  </Text>
                  {profile.username && (
                    <Text className="text-gray-500 text-sm mt-0.5">@{profile.username}</Text>
                  )}
                </View>
              </View>

              <View className="flex-row flex-wrap items-center mt-3 gap-1">
                <TouchableOpacity
                  onPress={() => (profile?.followersVisibility === 'public' ? setListModal('followers') : null)}
                  activeOpacity={profile?.followersVisibility === 'public' ? 0.7 : 1}
                >
                  <Text className="text-gray-700 text-sm font-semibold">
                    {formatCount(profile?.followerCount ?? 0)} followers
                  </Text>
                </TouchableOpacity>
                <Text className="text-gray-400 text-sm"> • </Text>
                <TouchableOpacity
                  onPress={() => (profile?.followingVisibility === 'public' ? setListModal('following') : null)}
                  activeOpacity={profile?.followingVisibility === 'public' ? 0.7 : 1}
                >
                  <Text className="text-gray-700 text-sm font-semibold">
                    {formatCount(profile?.followingCount ?? 0)} following
                  </Text>
                </TouchableOpacity>
                <Text className="text-gray-400 text-sm"> • </Text>
                <Text className="text-gray-700 text-sm font-semibold">
                  {formatCount(createdCount)} events
                </Text>
              </View>

              {profile.companyName && (
                <Text className="text-gray-600 text-sm mt-1">{profile.companyName}</Text>
              )}

              {/* Action button: Follow (no DM/message) */}
              <View className="flex-row gap-3 mt-4">
                {!isOwnProfile && currentUserId && (
                  <TouchableOpacity
                    onPress={handleFollowToggle}
                    disabled={followLoading}
                    activeOpacity={0.8}
                    className="flex-1 flex-row items-center justify-center gap-2 py-2.5 border border-black rounded-full bg-white"
                  >
                    {followLoading ? (
                      <ActivityIndicator size="small" color="#DC2626" />
                    ) : (
                      <>
                        <MaterialIcons
                          name={profile?.isFollowing ? 'person' : 'person-add'}
                          size={20}
                          color="#DC2626"
                        />
                        <Text className="font-semibold text-sm text-primary">
                          {profile?.isFollowing ? 'Following' : 'Follow'}
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}
                {isOwnProfile && (
                  <TouchableOpacity
                    className="flex-1 flex-row items-center justify-center gap-2 py-2.5 rounded-full bg-gray-200"
                    activeOpacity={0.8}
                    onPress={() => router.push('/settings')}
                  >
                    <MaterialIcons name="edit" size={20} color="#374151" />
                    <Text className="font-semibold text-sm text-gray-700">Edit profile</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Tabs: use shared TabsRow component (original design) */}
            <View className="mx-4 mt-5 mb-2">
              <TabsRow
                items={[
                  { key: 'created', label: 'Created Events' },
                  { key: 'joined', label: 'Joined Events' },
                  ...(showLikedTab ? [{ key: 'liked' as TabKey, label: 'Liked Events' }] : []),
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
            <MaterialIcons name="event-busy" size={48} color="#94a3b8" />
            <Text className="text-gray-500 text-base mt-3">No {activeTab} events yet</Text>
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

      {/* Cover Image Viewer */}
      <RNModal
        visible={showCoverViewer}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCoverViewer(false)}
      >
        <Pressable
          className="flex-1 bg-black justify-center items-center"
          onPress={() => setShowCoverViewer(false)}
        >
          {profile?.coverImageUrl ? (
            <Image
              source={{ uri: getProfileImageUrl({ profileImageUrl: profile.coverImageUrl }) || '' }}
              className="w-full h-full"
              resizeMode="contain"
            />
          ) : null}
          <TouchableOpacity
            className="absolute right-4 bg-white/20 w-10 h-10 rounded-full items-center justify-center"
            style={{ top: insets.top + 8 }}
            onPress={() => setShowCoverViewer(false)}
          >
            <MaterialIcons name="close" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </Pressable>
      </RNModal>

      <RNModal visible={listModal !== null} animationType="slide" transparent onRequestClose={() => setListModal(null)}>
        <View className="flex-1 bg-black/50 justify-end">
          <Pressable className="flex-1" onPress={() => setListModal(null)} />
          <View
            className="bg-white rounded-t-2xl"
            style={{
              paddingBottom: insets.bottom + 16,
              minHeight: Dimensions.get('window').height * 0.7,
              maxHeight: Dimensions.get('window').height * 0.7,
            }}
          >
            <View className="flex-row items-center justify-between py-3 px-4 border-b border-gray-200">
              <Text className="text-lg font-semibold text-gray-900">
                {listModal === 'followers' ? 'Followers' : 'Following'}
              </Text>
              <TouchableOpacity onPress={() => setListModal(null)} className="p-2">
                <MaterialIcons name="close" size={24} color="#374151" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={listModal === 'followers' ? (profile?.followers ?? []) : (profile?.following ?? [])}
              keyExtractor={(item) => item._id}
              renderItem={({ item }: { item: PublicUserSummary }) => (
                <TouchableOpacity
                  className="flex-row items-center py-3 px-4 border-b border-gray-100"
                  onPress={() => {
                    setListModal(null);
                    if (item._id !== id) router.push(`/user/${item._id}`);
                  }}
                  activeOpacity={0.7}
                >
                  <View className="w-10 h-10 rounded-full bg-primary items-center justify-center overflow-hidden mr-3">
                    {item.profileImageUrl ? (
                      <Image source={{ uri: getProfileImageUrl({ profileImageUrl: item.profileImageUrl }) || '' }} className="w-full h-full" resizeMode="cover" />
                    ) : (
                      <Text className="text-white font-bold text-lg">{(item.fullName || '?').charAt(0).toUpperCase()}</Text>
                    )}
                  </View>
                  <View className="flex-1">
                    <Text className="text-gray-900 font-medium">{item.fullName || 'User'}</Text>
                    {item.username && <Text className="text-gray-500 text-sm">@{item.username}</Text>}
                  </View>
                  <MaterialIcons name="chevron-right" size={24} color="#9CA3AF" />
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View className="py-8 items-center">
                  <MaterialIcons name="people-outline" size={48} color="#9CA3AF" />
                  <Text className="text-gray-500 mt-2">No {listModal === 'followers' ? 'followers' : 'following'} yet</Text>
                </View>
              }
            />
          </View>
        </View>
      </RNModal>
    </View>
  );
}
