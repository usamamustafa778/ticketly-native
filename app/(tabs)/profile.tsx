import { EventCard } from '@/components/EventCard';
import { EventCardSkeleton } from '@/components/EventCardSkeleton';
import { Modal } from '@/components/Modal';
import { UserProfileSkeleton } from '@/components/UserProfileSkeleton';
import { ButtonPrimary } from '@/components/ui/ButtonPrimary';
import { TabsRow } from '@/components/ui/Tabs';
import { useBottomPadding } from '@/hooks/useBottomPadding';
import { authAPI, PROFILE_CACHE_KEY, type PublicUserSummary } from '@/lib/api/auth';
import { eventsAPI } from '@/lib/api/events';
import { getEventImageUrl, getProfileImageUrl } from '@/lib/utils/imageUtils';
import { useAppStore } from '@/store/useAppStore';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  RefreshControl,
  Modal as RNModal,
  ScrollView,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
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
      avatarUrl: getProfileImageUrl({ profileImageUrl: u.profileImageUrl }) || undefined,
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
  const [uploadingCover, setUploadingCover] = useState(false);
  const [hasCheckedCache, setHasCheckedCache] = useState(false);
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorModalMessage, setErrorModalMessage] = useState('');
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successModalMessage, setSuccessModalMessage] = useState('');
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showImageViewer, setShowImageViewer] = useState(false);
  const [showCoverViewer, setShowCoverViewer] = useState(false);
  const [isBioExpanded, setIsBioExpanded] = useState(false);
  const [listModal, setListModal] = useState<'followers' | 'following' | null>(null);
  const hasLoadedRef = useRef(false);
  const currentUserIdRef = useRef<string | null>(null);

  // Dynamic bottom padding: Gestures (insets.bottom > 0) = safe area + 20px; Buttons (insets.bottom === 0) = 10px
  const bottomPadding = useBottomPadding();

  const TAB_ORDER: ('created' | 'joined' | 'liked')[] = ['created', 'joined', 'liked'];
  const [pagerWidth, setPagerWidth] = useState(Dimensions.get('window').width);
  const pagerRef = useRef<ScrollView>(null);

  // Use shared getProfileImageUrl (supports both profileImage and profileImageUrl)
  const profileImageUrl = user ? getProfileImageUrl(user) : null;
  const coverImageUrl = (user as any)?.coverImageUrl ? getProfileImageUrl({ profileImageUrl: (user as any).coverImageUrl }) : null;

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

  const pickCoverImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        setShowPermissionModal(true);
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.8,
      });
      if (!result.canceled && result.assets[0]) {
        setUploadingCover(true);
        try {
          const response = await authAPI.uploadCoverImage(result.assets[0].uri);
          if (response.success) {
            const newCoverUrl = response.coverImageUrl ?? response.user?.coverImageUrl;
            if (newCoverUrl && user) {
              setUser({ ...user, coverImageUrl: newCoverUrl } as any);
            } else if (response.user) {
              setUser(response.user);
            }
            setSuccessModalMessage('Cover photo updated.');
            setShowSuccessModal(true);
          } else {
            setErrorModalMessage(response.message || 'Failed to upload cover photo');
            setShowErrorModal(true);
          }
        } catch (err: any) {
          setErrorModalMessage(err.response?.data?.message || err.message || 'Failed to upload cover photo.');
          setShowErrorModal(true);
        } finally {
          setUploadingCover(false);
        }
      }
    } catch (error: any) {
      setErrorModalMessage('Failed to pick image. Please try again.');
      setShowErrorModal(true);
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

  // Use myEvents directly as created events (they're already filtered by the API)
  const createdEvents = myEvents;

  // Separate data for each tab (for horizontal pager – each page has its own list)
  const createdListData = React.useMemo(() => {
    if (loading) return Array.from({ length: 6 }, (_, i) => ({ id: `skeleton-created-${i}`, _skeleton: true } as any));
    return createdEvents.map((e) => ({
      ...e,
      id: e.id || e._id || (e as any)?._id || (e as any)?.id,
      _tab: 'created' as const,
    }));
  }, [loading, createdEvents]);

  const joinedListData = React.useMemo(() => {
    if (loading) return Array.from({ length: 6 }, (_, i) => ({ id: `skeleton-joined-${i}`, _skeleton: true } as any));
    return joinedEventsData.map((jd, idx) => {
      const ev = convertEvent(jd.event);
      return { ...ev, id: ev.id || `event-${idx}`, _tab: 'joined' as const };
    });
  }, [loading, joinedEventsData]);

  const likedListData = React.useMemo(() => {
    if (loading) return Array.from({ length: 6 }, (_, i) => ({ id: `skeleton-liked-${i}`, _skeleton: true } as any));
    return likedEvents.map((e) => ({
      ...e,
      id: e.id || e._id || (e as any)?._id || (e as any)?.id,
      _tab: 'liked' as const,
    }));
  }, [loading, likedEvents]);

  const handleTabSelect = useCallback((key: 'created' | 'joined' | 'liked') => {
    setActiveTab(key);
    const index = TAB_ORDER.indexOf(key);
    pagerRef.current?.scrollTo({ x: index * pagerWidth, animated: true });
  }, [pagerWidth]);

  const handlePagerScrollEnd = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    const index = Math.round(x / pagerWidth);
    const tab = TAB_ORDER[Math.max(0, Math.min(index, TAB_ORDER.length - 1))];
    setActiveTab(tab);
  }, [pagerWidth]);

  const handlePagerLayout = useCallback((e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0) setPagerWidth(w);
  }, []);

  // Show loading only while we check cache (so we don't flash "Login" when user is actually logged in)
  if (!user && !hasCheckedCache) {
    return (
      <View className="flex-1 bg-white">
        <UserProfileSkeleton />
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
            <ButtonPrimary
              size="lg"
              onPress={() => router.push('/login')}
            >
              Login / Sign Up
            </ButtonPrimary>
          </View>
        </ScrollView>
      </View>
    );
  }

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

  const renderProfileEventCard = ({ item }: { item: any }) => {
    if (item._skeleton) {
      return (
        <View className="flex-1">
          <EventCardSkeleton />
        </View>
      );
    }
    const eventId = item.id || item._id;
    const onPress = () => {
      if (!eventId) return;
      if (item._tab === 'created') {
        router.push(`/created-event-details/${eventId}`);
      } else {
        router.push(`/event-details/${eventId}`);
      }
    };
    return (
      <View className="flex-1">
        <EventCard event={item} onPress={onPress} />
      </View>
    );
  };

  const profileFixedHeader = (
    <>
      {/* Banner / Cover (same as user page) */}
      <View className="w-full overflow-hidden" style={{ height: 160 }}>
              {/* Cover image background */}
              {coverImageUrl ? (
                <Image
                  source={{ uri: coverImageUrl }}
                  className="w-full h-full"
                  resizeMode="cover"
                />
              ) : (
                <View className="w-full h-full" style={{ backgroundColor: '#0f766e' }} />
              )}
              
              {/* Tap area for viewing cover in full screen (only if cover exists) */}
              {coverImageUrl && (
                <TouchableOpacity
                  activeOpacity={1}
                  onPress={() => setShowCoverViewer(true)}
                  style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1 }}
                />
              )}
              
              {/* Top menu overlay */}
              <View
                pointerEvents="box-none"
                className="absolute inset-0 flex-row justify-between items-start px-4"
                style={{ paddingTop: insets.top + 8, zIndex: 5 }}
              >
                <View />
                <View className="flex-row gap-2">
                  <TouchableOpacity
                    className="w-9 h-9 rounded-full bg-black/30 items-center justify-center"
                    onPress={() => router.push('/settings')}
                  >
                    <MaterialIcons name="menu" size={22} color="#fff" />
                  </TouchableOpacity>
                </View>
              </View>
              
              {/* Add/change cover photo button - highest zIndex */}
              <TouchableOpacity
                onPress={pickCoverImage}
                disabled={uploadingCover}
                style={{ position: 'absolute', bottom: 12, right: 16, zIndex: 20 }}
                className="flex-row items-center gap-2 px-3 py-2 rounded-full bg-black/50"
                activeOpacity={0.8}
              >
                {uploadingCover ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <MaterialIcons name="camera-alt" size={18} color="#fff" />
                )}
                <Text className="text-white text-sm font-medium">
                  {coverImageUrl ? 'Change cover' : 'Add cover'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Bottom page container: white card with rounded top (like user page) */}
            <View className="bg-white rounded-t-3xl -mt-5 border-t border-gray-200">
              {/* Profile pic overlapping banner + name row */}
              <View className="px-4" style={{ marginTop: -32 }}>
                <View className="flex-row items-end">
                  <View className="relative">
                    <TouchableOpacity
                      onPress={() => setShowImageViewer(true)}
                      activeOpacity={0.8}
                      disabled={uploadingImage}
                      className="rounded-full overflow-hidden border-4 border-white bg-primary"
                      style={{ width: 96, height: 96 }}
                    >
                      {profileImageUrl ? (
                        <Image source={{ uri: profileImageUrl }} className="w-full h-full" resizeMode="cover" />
                      ) : (
                        <View className="w-full h-full items-center justify-center">
                          <Text className="text-white text-3xl font-bold">
                            {user.fullName.charAt(0).toUpperCase()}
                          </Text>
                        </View>
                      )}
                      {uploadingImage && (
                        <View className="absolute inset-0 bg-black/50 items-center justify-center">
                          <ActivityIndicator size="small" color="#fff" />
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
                  <View className="flex-1 ml-4 pb-1">
                    <Text className="text-gray-900 text-xl font-bold" numberOfLines={1}>
                      {user.fullName}
                    </Text>
                    {user.username && (
                      <Text className="text-gray-500 text-sm mt-0.5">@{user.username}</Text>
                    )}
                   
                  </View>
                </View>

                {/* Stats: X followers • Y following • Z events (same as user page) */}
                <View className="flex-row flex-wrap items-center mt-3 gap-1">
                  <TouchableOpacity
                    onPress={() => ((user as any).followersVisibility === 'public' ? setListModal('followers') : null)}
                    activeOpacity={(user as any).followersVisibility === 'public' ? 0.7 : 1}
                  >
                    <Text className="text-gray-700 text-sm font-semibold">
                      {(user as any).followerCount ?? 0} followers
                    </Text>
                  </TouchableOpacity>
                  <Text className="text-gray-400 text-sm"> • </Text>
                  <TouchableOpacity
                    onPress={() => ((user as any).followingVisibility === 'public' ? setListModal('following') : null)}
                    activeOpacity={(user as any).followingVisibility === 'public' ? 0.7 : 1}
                  >
                    <Text className="text-gray-700 text-sm font-semibold">
                      {(user as any).followingCount ?? 0} following
                    </Text>
                  </TouchableOpacity>
                  <Text className="text-gray-400 text-sm"> • </Text>
                  <Text className="text-gray-700 text-sm font-semibold">
                    {createdEvents.length} events
                  </Text>
                </View>
                {(user as any).companyName && (
                  <Text className="text-primary text-sm font-semibold mt-0.5">
                    {(user as any).companyName}
                  </Text>
                )}
                {(user as any).bio && (
                  <TouchableOpacity
                    activeOpacity={1}
                    onPress={() => setIsBioExpanded((prev) => !prev)}
                  >
                    <Text
                      className="text-gray-700 text-xs mt-1"
                      numberOfLines={isBioExpanded ? undefined : 3}
                    >
                      {(user as any).bio}
                    </Text>
                  </TouchableOpacity>
                )}


                {/* Edit profile button (same style as user page) */}
                <View className="flex-row gap-3 mt-4">
                  <TouchableOpacity
                    className="flex-1 flex-row items-center justify-center gap-2 py-2.5 rounded-full bg-gray-200"
                    activeOpacity={0.8}
                    onPress={() => router.push('/settings?open=profile')}
                  >
                    <MaterialIcons name="edit" size={20} color="#374151" />
                    <Text className="font-semibold text-sm text-gray-700">Edit profile</Text>
                  </TouchableOpacity>
                </View>
              </View>

      {/* Tabs */}
      <View className="mx-4 mt-5 mb-2">
        <TabsRow
          items={[
            { key: 'created', label: 'Created Events' },
            { key: 'joined', label: 'Joined Events' },
            { key: 'liked', label: 'Liked Events' },
          ]}
          activeKey={activeTab}
          onSelect={handleTabSelect}
        />
      </View>
    </View>
    </>
  );

  const emptyCreated = !loading ? (
    <TouchableOpacity className="px-3 py-10 items-center" onPress={onRefresh} activeOpacity={0.7}>
      <Text className="text-[#6B7280] text-sm">No events created yet</Text>
    </TouchableOpacity>
  ) : null;
  const emptyJoined = !loading ? (
    <TouchableOpacity className="px-3 py-10 items-center" onPress={onRefresh} activeOpacity={0.7}>
      <Text className="text-[#6B7280] text-sm">No events joined yet</Text>
    </TouchableOpacity>
  ) : null;
  const emptyLiked = !loading ? (
    <TouchableOpacity className="px-3 py-10 items-center" onPress={onRefresh} activeOpacity={0.7}>
      <Text className="text-[#6B7280] text-sm">No events liked yet</Text>
    </TouchableOpacity>
  ) : null;

  const likedFooter = (
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
  );

  const listProps = {
    style: { flex: 1 },
    contentContainerStyle: { paddingTop: 0, paddingBottom: bottomPadding, paddingHorizontal: 2 },
    keyExtractor: (item: any) => item.id,
    numColumns: 2,
    columnWrapperStyle: { gap: 4, marginBottom: 4 } as const,
    renderItem: renderProfileEventCard,
    refreshControl: (
      <RefreshControl
        refreshing={refreshing}
        onRefresh={onRefresh}
        tintColor="#DC2626"
        colors={['#DC2626']}
      />
    ),
  };

  return (
    <View className="flex-1 bg-white">
      {profileFixedHeader}
      <View
        style={{ flex: 1 }}
        onLayout={handlePagerLayout}
      >
        <ScrollView
          ref={pagerRef}
          horizontal
          pagingEnabled
          decelerationRate="fast"
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={handlePagerScrollEnd}
          onScrollEndDrag={handlePagerScrollEnd}
          scrollEventThrottle={16}
          style={{ flex: 1 }}
          contentContainerStyle={{ flexGrow: 1 }}
        >
          <View style={{ width: pagerWidth, flex: 1 }}>
            <FlatList
              key="created"
              data={createdListData}
              ListEmptyComponent={emptyCreated}
              {...listProps}
            />
          </View>
          <View style={{ width: pagerWidth, flex: 1 }}>
            <FlatList
              key="joined"
              data={joinedListData}
              ListEmptyComponent={emptyJoined}
              {...listProps}
            />
          </View>
          <View style={{ width: pagerWidth, flex: 1 }}>
            <FlatList
              key="liked"
              data={likedListData}
              ListEmptyComponent={emptyLiked}
              ListFooterComponent={likedFooter}
              {...listProps}
            />
          </View>
        </ScrollView>
      </View>

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
          {coverImageUrl ? (
            <Image
              source={{ uri: coverImageUrl }}
              className="w-full h-full"
              resizeMode="contain"
            />
          ) : null}
          <TouchableOpacity
            className="absolute right-4 top-4 bg-white/20 w-10 h-10 rounded-full items-center justify-center"
            style={{ top: insets.top + 8 }}
            onPress={() => setShowCoverViewer(false)}
          >
            <MaterialIcons name="close" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </Pressable>
      </RNModal>

      {/* Followers / Following list modal */}
      <RNModal
        visible={listModal !== null}
        animationType="slide"
        transparent
        onRequestClose={() => setListModal(null)}
      >
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
              data={listModal === 'followers' ? ((user as any)?.followers ?? []) : ((user as any)?.following ?? [])}
              keyExtractor={(item: PublicUserSummary) => item._id}
              initialNumToRender={12}
              windowSize={5}
              maxToRenderPerBatch={10}
              updateCellsBatchingPeriod={50}
              removeClippedSubviews
              renderItem={({ item }: { item: PublicUserSummary }) => (
                <TouchableOpacity
                  className="flex-row items-center py-3 px-4 border-b border-gray-100"
                  onPress={() => {
                    setListModal(null);
                    if (item._id !== user?._id) {
                      // Coming from profile tab
                      router.push(`/user/${item._id}?comeFrom=profile`);
                    }
                  }}
                  activeOpacity={0.7}
                >
                  <View className="w-10 h-10 rounded-full bg-primary items-center justify-center overflow-hidden mr-3">
                    {item.profileImageUrl ? (
                      <Image
                        source={{ uri: getProfileImageUrl({ profileImageUrl: item.profileImageUrl }) || '' }}
                        className="w-full h-full"
                        resizeMode="cover"
                      />
                    ) : (
                      <Text className="text-white font-bold text-lg">
                        {(item.fullName || '?').charAt(0).toUpperCase()}
                      </Text>
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
                  <Text className="text-gray-500 mt-2">
                    No {listModal === 'followers' ? 'followers' : 'following'} yet
                  </Text>
                </View>
              }
            />
          </View>
        </View>
      </RNModal>
    </View>
  );
}


