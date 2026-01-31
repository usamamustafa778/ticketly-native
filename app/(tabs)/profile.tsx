import { EventCard } from '@/components/EventCard';
import { EventCardSkeleton } from '@/components/EventCardSkeleton';
import { authAPI, PROFILE_CACHE_KEY } from '@/lib/api/auth';
import { eventsAPI } from '@/lib/api/events';
import { API_BASE_URL } from '@/lib/config';
import { useAppStore } from '@/store/useAppStore';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { getEventImageUrl, getProfileImageUrl } from '@/lib/utils/imageUtils';
import {
  ActivityIndicator,
  Image,
  Modal as RNModal,
  PanResponder,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Modal } from '@/components/Modal';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Token storage keys (must match client.ts)
const ACCESS_TOKEN_KEY = 'accessToken';
const REFRESH_TOKEN_KEY = 'refreshToken';

// Helper function to convert API event to app event format
// currentUserProfileImageUrl: fallback for own created events when API omits host profile image
const convertEvent = (apiEvent: any, currentUserProfileImageUrl?: string | null) => {
  // Handle both _id and id fields (backend may return either)
  const eventId = apiEvent._id || apiEvent.id || (apiEvent as any)?._id || (apiEvent as any)?.id;

  if (!eventId) {
    console.warn('⚠️ Event missing ID:', apiEvent);
  }

  const dateStr = apiEvent.date ? (String(apiEvent.date).includes('T') ? String(apiEvent.date).split('T')[0] : apiEvent.date) : '';
  const hostAvatarFromApi = apiEvent.createdBy ? getProfileImageUrl(apiEvent.createdBy as any) : null;
  const hostAvatarUrl = hostAvatarFromApi || currentUserProfileImageUrl || null;
  return {
    id: eventId || '',
    title: apiEvent.title || '',
    description: apiEvent.description || '',
    date: dateStr,
    time: apiEvent.time || '',
    venue: apiEvent.location || '',
    city: (apiEvent.location || '').split(',')[0] || apiEvent.location || '',
    category: 'Event',
    image: getEventImageUrl(apiEvent) || 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=800',
    organizerId: apiEvent.createdBy?._id || apiEvent.createdBy?.id || '',
    organizerName: apiEvent.createdBy?.fullName || 'Organizer',
    price: apiEvent.ticketPrice || 0,
    accessType: (apiEvent.ticketPrice || 0) > 0 ? 'paid' as const : 'open' as const,
    registeredUsers: [],
    likedUsers: [],
    hostAvatarUrl,
    joinedUsers: (apiEvent.joinedUsers || []).map((u: any) => ({
      id: u._id || u.id,
      name: u.name || u.fullName,
      avatarUrl: u.profileImageUrl || u.avatarUrl,
    })),
    joinedCount: apiEvent.joinedCount ?? (apiEvent.joinedUsers?.length ?? 0),
  };
};

export default function ProfileScreen() {
  const router = useRouter();
  const user = useAppStore((state) => state.user);
  const logout = useAppStore((state) => state.logout);
  const setUser = useAppStore((state) => state.setUser);
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<'created' | 'joined' | 'liked'>('created');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [myEvents, setMyEvents] = useState<any[]>([]);
  const [joinedEvents, setJoinedEvents] = useState<any[]>([]);
  const [joinedEventsData, setJoinedEventsData] = useState<any[]>([]); // Store full data with tickets
  const [likedEvents, setLikedEvents] = useState<any[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [hasCheckedCache, setHasCheckedCache] = useState(false);
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorModalMessage, setErrorModalMessage] = useState('');
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successModalMessage, setSuccessModalMessage] = useState('');
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showImageViewer, setShowImageViewer] = useState(false);
  const hasLoadedRef = useRef(false);
  const currentUserIdRef = useRef<string | null>(null);

  // Calculate bottom padding: tab bar height + safe area bottom + extra padding
  // Tab bar layout: compact bar with insets.bottom for devices with home indicator / gesture bar
  const tabBarTotalHeight = Platform.OS === 'ios'
    ? 56 + Math.max(insets.bottom, 6)
    : 52 + Math.max(insets.bottom, 6) + 2;
  const bottomPadding = tabBarTotalHeight + 20; // Extra 20px for comfortable spacing

  const TAB_ORDER: ('created' | 'joined' | 'liked')[] = ['created', 'joined', 'liked'];
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

  // Use shared getProfileImageUrl (supports both profileImage and profileImageUrl)
  const profileImageUrl = user ? getProfileImageUrl(user) : null;

  // Handle image picker
  const pickImage = async () => {
    try {
      // Request permission
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        setShowPermissionModal(true);
        return;
      }

      // Launch image picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1], // Square for profile images
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        const imageUri = asset.uri;

        // Log asset info for debugging
        console.log('📸 Image selected:', {
          uri: imageUri.substring(0, 50) + '...',
          type: asset.type,
          width: asset.width,
          height: asset.height,
          fileSize: asset.fileSize,
        });

        await uploadProfileImage(imageUri);
      }
    } catch (error: any) {
      console.error('Error picking image:', error);
      setErrorModalMessage('Failed to pick image. Please try again.');
      setShowErrorModal(true);
    }
  };

  // Upload profile image
  const uploadProfileImage = async (imageUri: string) => {
    setUploadingImage(true);
    try {
      console.log('🔄 Starting profile image upload...');
      const response = await authAPI.uploadProfileImage(imageUri);

      if (response.success) {
        console.log('✅ Profile image upload successful:', response.profileImageUrl);

        // Update user state with new profile image
        if (response.user) {
          setUser(response.user);
        } else if (user && response.profileImageUrl) {
          setUser({
            ...user,
            profileImageUrl: response.profileImageUrl,
          });
        }

        setSuccessModalMessage('Profile image uploaded successfully!');
        setShowSuccessModal(true);
      } else {
        console.error('❌ Upload failed - response not successful:', response);
        setErrorModalMessage(response.message || 'Failed to upload profile image');
        setShowErrorModal(true);
      }
    } catch (error: any) {
      console.error('❌ Upload error caught:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
      });
      setErrorModalMessage(error.response?.data?.message || error.message || 'Failed to upload profile image. Please try again.');
      setShowErrorModal(true);
    } finally {
      setUploadingImage(false);
    }
  };

  useEffect(() => {
    // Load immediately when user is available
    if (user?._id) {
      // If user ID changed, reset the loaded flag
      if (currentUserIdRef.current !== user._id) {
        currentUserIdRef.current = user._id;
        hasLoadedRef.current = false;
      }

      // Check if user has full event data (objects) or just IDs (strings) or empty arrays
      const createdEventsIsStrings = user.createdEvents && Array.isArray(user.createdEvents) && user.createdEvents.length > 0 && typeof user.createdEvents[0] === 'string';
      const joinedEventsIsStrings = user.joinedEvents && Array.isArray(user.joinedEvents) && user.joinedEvents.length > 0 && typeof user.joinedEvents[0] === 'string';
      const hasFullEventData = user.createdEvents && Array.isArray(user.createdEvents) && user.createdEvents.length > 0 && typeof user.createdEvents[0] === 'object';
      const hasFullJoinedData = user.joinedEvents && Array.isArray(user.joinedEvents) && user.joinedEvents.length > 0 && typeof user.joinedEvents[0] === 'object' && (user.joinedEvents[0] as any).event;

      // Always load profile if:
      // 1. We haven't loaded yet for this user (always load on first mount), OR
      // 2. User has only IDs (strings) instead of full objects, OR
      // 3. User doesn't have full event data (empty arrays or undefined)
      const needsFullData = !hasFullEventData || !hasFullJoinedData || createdEventsIsStrings || joinedEventsIsStrings;

      // Load cached profile first for instant display, then fetch fresh data
      (async () => {
        if (!hasLoadedRef.current) {
          hasLoadedRef.current = true;
          const hadCache = await loadProfileFromCache();
          await loadProfile(false, hadCache);
        } else if (needsFullData) {
          await loadProfile();
        }
      })();
    }
  }, [user?._id]); // Only depend on user ID, but check data inside effect

  // When profile tab gains focus: always load from cache first (so content shows immediately), then refresh in background
  useFocusEffect(
    useCallback(() => {
      (async () => {
        await loadProfileFromCache();
        setHasCheckedCache(true);
        const currentUser = useAppStore.getState().user;
        if (currentUser?._id) {
          loadProfile(true, true);
        }
      })();
    }, [])
  );

  const loadProfile = async (showRefreshing = false, skipLoadingIndicator = false) => {
    try {
      if (!skipLoadingIndicator) {
        if (showRefreshing) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }
      }

      const response = await authAPI.getProfile();
      if (response.success && response.user) {
        setUser(response.user);

        // Extract created events from the response (use backend data as-is; joinedUsers must come from backend)
        if (response.user.createdEvents && Array.isArray(response.user.createdEvents) && response.user.createdEvents.length > 0) {
          const firstItem = response.user.createdEvents[0];
          if (typeof firstItem === 'object' && firstItem !== null) {
            const profileImg = (response.user as any)?.profileImageUrl ?? (response.user ? getProfileImageUrl(response.user as any) : null);
            const created = response.user.createdEvents.map((apiEvent: any) => convertEvent(apiEvent, profileImg));
            setMyEvents(created);
          } else {
            await loadMyEvents(false);
          }
        } else {
          await loadMyEvents(false);
        }

        // Extract joined events from the response (use backend data as-is; joinedUsers must come from backend)
        if (response.user.joinedEvents && Array.isArray(response.user.joinedEvents) && response.user.joinedEvents.length > 0) {
          const firstItem = response.user.joinedEvents[0];
          if (typeof firstItem === 'object' && firstItem !== null && firstItem.event) {
            const rawJoined = response.user.joinedEvents as { event: any; tickets?: any[] }[];
            setJoinedEventsData(rawJoined);
            const joined = rawJoined.map((item: any) => (item.event ? convertEvent(item.event) : null)).filter(Boolean);
            setJoinedEvents(joined);
          } else {
            setJoinedEventsData([]);
            setJoinedEvents([]);
          }
        } else {
          setJoinedEventsData([]);
          setJoinedEvents([]);
        }

        if (response.user.likedEvents && Array.isArray(response.user.likedEvents) && response.user.likedEvents.length > 0) {
          // Check if it's an array of objects or strings
          const firstItem = response.user.likedEvents[0];
          if (typeof firstItem === 'object' && firstItem !== null) {
            // Full event objects
            const liked = response.user.likedEvents.map((event: any) => convertEvent(event));
            setLikedEvents(liked);
          } else {
            // Just IDs - clear for now
            setLikedEvents([]);
          }
        } else {
          setLikedEvents([]);
        }
      }
    } catch (error: any) {
      console.error('Failed to load profile:', error);
      const status = error.response?.status;
      const msg = error.response?.data?.message || '';
      if (status === 401 || msg.includes('No token provided')) {
        await logout();
        router.replace('/login');
        return;
      }
      setErrorModalMessage(msg || 'Failed to load profile');
      setShowErrorModal(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    hasLoadedRef.current = false;
    loadProfile(true);
  };

  // Load cached profile from local storage and apply to state (show immediately, no wait for API)
  const loadProfileFromCache = async (): Promise<boolean> => {
    try {
      const raw = await AsyncStorage.getItem(PROFILE_CACHE_KEY);
      if (!raw) return false;
      const cached = JSON.parse(raw) as { success?: boolean; user?: any };
      if (!cached?.user) return false;
      const u = cached.user;
      // Normalize user: API may return "id", store/UI expect "_id"
      if (!u._id && u.id) u._id = u.id;
      setUser(u);
      // Apply created events from cache
      if (u.createdEvents && Array.isArray(u.createdEvents) && u.createdEvents.length > 0 && typeof u.createdEvents[0] === 'object') {
        const profileImg = (u as any)?.profileImageUrl ?? getProfileImageUrl(u as any);
        setMyEvents(u.createdEvents.map((e: any) => convertEvent(e, profileImg)));
      } else {
        setMyEvents([]);
      }
      // Apply joined events from cache ({ event, tickets }[])
      if (u.joinedEvents && Array.isArray(u.joinedEvents) && u.joinedEvents.length > 0 && typeof u.joinedEvents[0] === 'object' && (u.joinedEvents[0] as any).event) {
        const joinedData = u.joinedEvents as { event: any; tickets?: any[] }[];
        setJoinedEventsData(joinedData);
        setJoinedEvents(joinedData.map((item: any) => item.event ? convertEvent(item.event) : null).filter(Boolean));
      } else {
        setJoinedEventsData([]);
        setJoinedEvents([]);
      }
      // Apply liked events from cache
      if (u.likedEvents && Array.isArray(u.likedEvents) && u.likedEvents.length > 0 && typeof u.likedEvents[0] === 'object') {
        setLikedEvents(u.likedEvents.map((e: any) => convertEvent(e)));
      } else {
        setLikedEvents([]);
      }
      return true;
    } catch (_) {
      return false;
    }
  };

  const loadMyEvents = async (showLoading = true) => {
    try {
      if (showLoading) {
        setLoading(true);
      }
      const response = await eventsAPI.getMyEvents();
      if (response.success && response.events) {
        const profileImg = user ? getProfileImageUrl(user as any) : null;
        const converted = response.events.map((apiEvent: any) => convertEvent(apiEvent, profileImg));
        setMyEvents(converted);
      }
    } catch (error: any) {
      console.error('Failed to load events:', error);
      const status = error.response?.status;
      const msg = error.response?.data?.message || '';
      if (status === 401 || msg.includes('No token provided')) {
        await logout();
        router.replace('/login');
        return;
      }
      // Don't show alert if called from loadProfile to avoid double alerts
      if (showLoading) {
        setErrorModalMessage(msg || 'Failed to load events');
        setShowErrorModal(true);
      }
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  };

  // Show loading only while we check cache (so we don't flash "Login" when user is actually logged in)
  if (!user && !hasCheckedCache) {
    return (
      <View className="flex-1 bg-white pt-[60px] items-center justify-center">
        <ActivityIndicator size="large" color="#DC2626" />
        <Text className="text-gray-600 mt-4">Loading profile...</Text>
      </View>
    );
  }

  // Show login option if user is not authenticated (after we've checked cache)
  if (!user) {
    return (
      <View className="flex-1 bg-white pt-[60px]">
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingBottom: bottomPadding }}
          showsVerticalScrollIndicator={false}
        >
          <View className="flex-1 items-center justify-center px-10 pt-[100px]">
            <Text className="text-gray-900 text-2xl font-bold mb-4 text-center">Welcome on Ticketly</Text>
            <Text className="text-gray-600 text-base mb-8 text-center leading-6">
              Login to create events, register for events, and manage your profile
            </Text>
            <TouchableOpacity
              className="bg-primary py-4 px-8 rounded-xl"
              onPress={() => router.push('/login')}
            >
              <Text className="text-white text-base font-semibold">Login / Sign Up</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    );
  }

  // Use myEvents directly as created events (they're already filtered by the API)
  const createdEvents = myEvents;

  const handleLogout = () => {
    console.log('🔴 Logout button clicked!');
    setShowLogoutModal(true);
  };

  const confirmLogout = async () => {
    setShowLogoutModal(false);
    await performLogout();
  };

  const performLogout = async () => {
    console.log('✅ Logout confirmed, starting logout process...');
    try {
      console.log('Step 1: Checking tokens before removal...');
      const accessTokenBefore = await AsyncStorage.getItem(ACCESS_TOKEN_KEY);
      const refreshTokenBefore = await AsyncStorage.getItem(REFRESH_TOKEN_KEY);
      console.log('Access token exists:', !!accessTokenBefore, accessTokenBefore ? 'Length: ' + accessTokenBefore.length : 'null');
      console.log('Refresh token exists:', !!refreshTokenBefore, refreshTokenBefore ? 'Length: ' + refreshTokenBefore.length : 'null');

      // For web, also clear localStorage directly
      if (typeof window !== 'undefined' && window.localStorage) {
        console.log('Step 1.5: Clearing localStorage directly (web fallback)...');
        window.localStorage.removeItem(ACCESS_TOKEN_KEY);
        window.localStorage.removeItem(REFRESH_TOKEN_KEY);
        console.log('✅ localStorage cleared directly');
      }

      console.log('Step 2: Removing tokens individually from AsyncStorage...');
      // Step 1: Clear tokens directly using the exact keys
      await Promise.all([
        AsyncStorage.removeItem(ACCESS_TOKEN_KEY),
        AsyncStorage.removeItem(REFRESH_TOKEN_KEY),
      ]);
      console.log('✅ Tokens removed individually from AsyncStorage');

      console.log('Step 3: Clearing all AsyncStorage...');
      // Step 2: Clear all AsyncStorage to ensure nothing remains
      await AsyncStorage.clear();
      console.log('✅ All AsyncStorage cleared');

      // Clear localStorage again after AsyncStorage.clear()
      if (typeof window !== 'undefined' && window.localStorage) {
        console.log('Step 3.5: Clearing localStorage again...');
        window.localStorage.clear();
        console.log('✅ localStorage cleared completely');
      }

      console.log('Step 4: Clearing user state in store...');
      // Step 3: Clear user state in store
      await logout();
      console.log('✅ User state cleared');

      console.log('Step 5: Waiting for storage operations to complete...');
      // Step 4: Small delay to ensure storage operations complete
      await new Promise(resolve => setTimeout(resolve, 200));

      console.log('Step 6: Verifying tokens are actually cleared...');
      // Step 5: Verify tokens are actually cleared
      const remainingAccessToken = await AsyncStorage.getItem(ACCESS_TOKEN_KEY);
      const remainingRefreshToken = await AsyncStorage.getItem(REFRESH_TOKEN_KEY);

      // Also check localStorage
      let localStorageAccessToken = null;
      let localStorageRefreshToken = null;
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorageAccessToken = window.localStorage.getItem(ACCESS_TOKEN_KEY);
        localStorageRefreshToken = window.localStorage.getItem(REFRESH_TOKEN_KEY);
      }

      console.log('AsyncStorage - Access token still exists:', !!remainingAccessToken);
      console.log('AsyncStorage - Refresh token still exists:', !!remainingRefreshToken);
      console.log('localStorage - Access token still exists:', !!localStorageAccessToken);
      console.log('localStorage - Refresh token still exists:', !!localStorageRefreshToken);

      if (remainingAccessToken || remainingRefreshToken || localStorageAccessToken || localStorageRefreshToken) {
        // If tokens still exist, clear again
        console.warn('⚠️ Tokens still exist, clearing again...');
        await AsyncStorage.clear();
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.clear();
        }
        console.log('✅ Storage cleared again');
      }

      console.log('Step 7: Redirecting to home page...');
      // Step 6: Redirect to home page
      router.replace('/(tabs)');
      console.log('✅ Logout complete!');
    } catch (error) {
      console.error('❌ Logout error:', error);
      // Force clear everything even if there's an error
      try {
        console.log('Attempting to clear storage after error...');
        await AsyncStorage.clear();
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.clear();
        }
        console.log('✅ Storage cleared after error');
      } catch (clearError) {
        console.error('❌ Error clearing storage:', clearError);
      }
      // Clear state even if storage clear fails
      console.log('Clearing user state after error...');
      await logout();
      console.log('Redirecting to home page after error...');
      router.replace('/(tabs)');
    }
  };

  const renderEvents = () => {
    if (loading) {
      return (
        <View className="grid grid-cols-2 flex-row flex-wrap px-[2px]" style={{ gap: 2 }}>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <View key={i} className="flex-[0_0_49%]">
              <EventCardSkeleton />
            </View>
          ))}
        </View>
      );
    }

    if (activeTab === 'joined') {
      if (joinedEventsData.length === 0) {
        return (
          <TouchableOpacity
            className="px-3 py-10 items-center"
            onPress={onRefresh}
            activeOpacity={0.7}
          >
            <Text className="text-[#6B7280] text-sm">No events joined yet</Text>
          </TouchableOpacity>
        );
      }

      return (
        <View className="grid grid-cols-2 flex-row flex-wrap px-[2px]" style={{ gap: 2 }}>
          {joinedEventsData.map((joinedEventData, index) => {
            const event = convertEvent(joinedEventData.event);
            const eventId = event.id || `event-${index}`;
            return (
              <View key={eventId} className="flex-[0_0_49%]">
                <EventCard
                  event={event}
                  onPress={() => eventId && router.push(`/event-details/${eventId}`)}
                />
              </View>
            );
          })}
        </View>
      );
    }

    let eventsToShow: any[] = [];
    if (activeTab === 'created') eventsToShow = createdEvents;
    else eventsToShow = likedEvents;

    if (eventsToShow.length === 0) {
      return (
        <TouchableOpacity
          className="px-3 py-10 items-center"
          onPress={onRefresh}
          activeOpacity={0.7}
        >
          <Text className="text-[#6B7280] text-sm">
            {activeTab === 'created' ? 'No events created yet' : 'No events liked yet'}
          </Text>
        </TouchableOpacity>
      );
    }

    return (
      <View className="grid grid-cols-2 flex-row flex-wrap px-[2px]" style={{ gap: 2 }}>
        {eventsToShow.map((event) => {
          // Ensure event ID is valid before rendering
          const eventId = event.id || event._id || (event as any)?._id || (event as any)?.id;

          if (!eventId) {
            console.warn('⚠️ Event missing ID, skipping navigation:', event);
            return null;
          }

          return (
            <View key={eventId} className="flex-[0_0_49%]">
              <EventCard
                event={event}
                onPress={() => {
                  if (activeTab === 'created') {
                    router.push(`/created-event-details/${eventId}`);
                  } else {
                    router.push(`/event-details/${eventId}`);
                  }
                }}
              />
            </View>
          );
        })}
      </View>
    );
  };

  return (
    <View className="flex-1 bg-white pt-[60px]" {...panResponder.panHandlers}>
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
            colors={["#DC2626"]}
          />
        }
      >
        {/* Profile Header */}
        <View className="flex-row justify-end items-center px-3 pt-5 pb-2">
          <TouchableOpacity
            className="bg-gray-100 w-10 h-10 rounded-lg items-center justify-center"
            onPress={() => router.push('/settings')}
          >
            <MaterialIcons name="menu" size={24} color="#111827" />
          </TouchableOpacity>
        </View>

        {/* Profile Section - Centered */}
        <View className="items-center py-6 pb-4">
          <View className="relative">
            <TouchableOpacity
              onPress={() => setShowImageViewer(true)}
              activeOpacity={0.8}
              disabled={uploadingImage}
              className="w-[100px] h-[100px] rounded-full overflow-hidden"
            >
              <View className="w-full h-full rounded-full bg-primary items-center justify-center overflow-hidden">
                {profileImageUrl ? (
                  <Image
                    source={{ uri: profileImageUrl }}
                    className="w-full h-full"
                    resizeMode="cover"
                  />
                ) : (
                  <Text className="text-white text-4xl font-bold">
                    {user.fullName.charAt(0).toUpperCase()}
                  </Text>
                )}
              </View>
              {uploadingImage && (
                <View className="absolute inset-0 bg-black/50 rounded-full items-center justify-center">
                  <ActivityIndicator size="small" color="#DC2626" />
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={pickImage}
              disabled={uploadingImage}
              activeOpacity={0.8}
              className="absolute bottom-0 right-0 bg-primary w-8 h-8 rounded-full items-center justify-center border-2 border-white"
            >
              <MaterialIcons name="camera-alt" size={16} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            className="flex-row items-center gap-2 mb-1"
            onPress={() => router.push('/settings?open=profile')}
            activeOpacity={0.7}
          >
            <Text className="text-gray-900 text-2xl font-bold">{user.fullName}</Text>
            <MaterialIcons name="edit" size={20} color="#DC2626" />
          </TouchableOpacity>
          {user.companyName && (
            <Text className="text-primary text-base font-semibold mt-1">{user.companyName}</Text>
          )}
        </View>

        {/* Stats */}
        <View className="flex-row justify-around px-16 py-2">

          <View className="items-center">
            <Text className="text-gray-900 text-base font-bold mb-0.5">{createdEvents.length}</Text>
            <Text className="text-[#9CA3AF] text-[10px]">Created</Text>
          </View>
          <View className="items-center">
            <Text className="text-gray-900 text-base font-bold mb-0.5">{joinedEventsData.length}</Text>
            <Text className="text-[#9CA3AF] text-[10px]">Joined</Text>
          </View>
          <View className="items-center">
            <Text className="text-gray-900 text-base font-bold mb-0.5">{likedEvents.length}</Text>
            <Text className="text-[#9CA3AF] text-[10px]">Liked</Text>
          </View>
        </View>

        {/* Tabs - sticky when scrolling */}
        <View className="flex-row px-16 py-2 mb-3 translate-y-[-2px] gap-2 bg-white">
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
          <TouchableOpacity
            className={`flex-1 py-2 items-center rounded-md ${activeTab === 'liked' ? 'bg-primary' : 'bg-gray-100'}`}
            onPress={() => setActiveTab('liked')}
          >
            <Text className={`text-[10px] font-semibold ${activeTab === 'liked' ? 'text-white' : 'text-[#9CA3AF]'}`}>
              Liked Events
            </Text>
          </TouchableOpacity>
        </View>


        {/* Events List - swipe area for tab change */}
        <View className="mb-8">
          {renderEvents()}
          {activeTab === 'liked' && (
            <View className="flex-row items-center justify-center gap-2 px-4 py-6">
              <Text className="text-[#6B7280] text-sm text-center flex-1">
                Choose who can see your liked events on your public profile
              </Text>
              <TouchableOpacity
                onPress={() => router.push('/settings?open=liked')}
                activeOpacity={0.7}
                className="w-8 h-8 rounded-full bg-gray-100 items-center justify-center"
              >
                <MaterialIcons name="edit" size={18} color="#DC2626" />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>

      <Modal
        visible={showPermissionModal}
        onClose={() => setShowPermissionModal(false)}
        title="Permission Required"
        message="We need access to your photos to upload profile images."
        primaryButtonText="OK"
        onPrimaryPress={() => setShowPermissionModal(false)}
        variant="info"
      />
      <Modal
        visible={showErrorModal}
        onClose={() => setShowErrorModal(false)}
        title="Error"
        message={errorModalMessage}
        primaryButtonText="OK"
        onPrimaryPress={() => setShowErrorModal(false)}
        variant="error"
      />
      <Modal
        visible={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        title="Success"
        message={successModalMessage}
        primaryButtonText="OK"
        onPrimaryPress={() => setShowSuccessModal(false)}
        variant="success"
      />
      <Modal
        visible={showLogoutModal}
        onClose={() => setShowLogoutModal(false)}
        title="Logout"
        message="Are you sure you want to logout?"
        primaryButtonText="Logout"
        secondaryButtonText="Cancel"
        onPrimaryPress={confirmLogout}
        variant="info"
      />

      {/* Profile Image Viewer */}
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
                {user?.fullName?.charAt(0)?.toUpperCase() || '?'}
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


