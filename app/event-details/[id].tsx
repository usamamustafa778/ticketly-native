import { BackButton } from '@/components/BackButton';
import { EventDetailsSkeleton } from '@/components/EventDetailsSkeleton';
import { Modal } from '@/components/Modal';
import { authAPI } from '@/lib/api/auth';
import { eventsAPI, type Event } from '@/lib/api/events';
import { ticketsAPI, type GetMyTicketsResponse } from '@/lib/api/tickets';
import { CACHE_KEYS, getCached, setCached } from '@/lib/cache';
import { getEventImageUrl, getProfileImageUrl } from '@/lib/utils/imageUtils';
import { useAppStore } from '@/store/useAppStore';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Animated,
    Dimensions,
    Image,
    Platform,
    Pressable,
    RefreshControl,
    Modal as RNModal,
    ScrollView,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import AnimatedReanimated, {
    cancelAnimation,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withSequence,
    withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function EventDetailsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id, returnTo } = useLocalSearchParams<{ id: string; returnTo?: string }>();
  const handleBack = () => {
    if (returnTo === 'notifications') {
      router.replace('/(tabs)/notifications');
    } else {
      router.back();
    }
  };
  const user = useAppStore((state) => state.user);
  const setUser = useAppStore((state) => state.setUser);
  const registerForEvent = useAppStore((state) => state.registerForEvent);

  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const likeScale = useRef(new Animated.Value(1)).current;
  const likeApiInProgress = useRef(false);
  const pendingLikeAction = useRef<'like' | 'unlike' | null>(null);
  const [isRegistered, setIsRegistered] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [modalMessage, setModalMessage] = useState('');
  const [creatingTicket, setCreatingTicket] = useState(false);
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const [phoneInput, setPhoneInput] = useState('');
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginModalMessage, setLoginModalMessage] = useState('');
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorModalMessage, setErrorModalMessage] = useState('');
  const [showInvalidPhoneModal, setShowInvalidPhoneModal] = useState(false);
  const [userTicketId, setUserTicketId] = useState<string | null>(null);
  const [userTickets, setUserTickets] = useState<any[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const [ticketsSectionY, setTicketsSectionY] = useState<number>(0);
  const [showImageViewer, setShowImageViewer] = useState(false);
  const [sBackgroundFetching, setIsBackgroundFetching] = useState(false);
  const loadingLineProgress = useSharedValue(0);

  // Fetch event from API - public data: cache first (works for logged-in and logged-out users)
  const fetchEvent = async (showRefreshing = false) => {
    if (!id) {
      setError('Event ID is required');
      setLoading(false);
      return;
    }

    let hadCache = false;
    if (!showRefreshing) {
      const cached = await getCached<{ event: Event; isLiked: boolean; likeCount: number }>(CACHE_KEYS.EVENT_BY_ID(id));
      if (cached?.event) {
        hadCache = true;
        setEvent(cached.event);
        setIsLiked(cached.isLiked);
        setLikeCount(cached.likeCount);
        setError(null);
        setLoading(false);
      }
    }

    try {
      if (showRefreshing) setRefreshing(true);
      else if (!hadCache) setLoading(true);
      if (hadCache) setIsBackgroundFetching(true);
      setError(null);
      const response = await eventsAPI.getEventById(id);

      if (response.success && response.event) {
        const eventData = response.event as any;
        const transformedEvent: Event = {
          ...eventData,
          _id: eventData.id || eventData._id,
        };
        await setCached(CACHE_KEYS.EVENT_BY_ID(id), {
          event: transformedEvent,
          isLiked: !!eventData.isLiked,
          likeCount: eventData.likeCount ?? 0,
        });
        setEvent(transformedEvent);
        setIsLiked(!!eventData.isLiked);
        setLikeCount(eventData.likeCount ?? 0);
      } else if (!hadCache) {
        setError('Event not found');
      }
    } catch (err: any) {
      console.error('Error fetching event:', err);
      const errorMessage = err.response?.data?.message || err.message || 'Failed to load event';
      if (!hadCache) setError(errorMessage);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setIsBackgroundFetching(false);
    }
  };

  // Animated loading line - uses Reanimated for smooth 60fps on mobile (runs on UI thread)
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

  useEffect(() => {
    fetchEvent();
  }, [id]);

  const onRefresh = async () => {
    await fetchEvent(true);
    // Also refresh user tickets and save to cache
    if (event && user && id) {
      try {
        const response = await ticketsAPI.getMyTickets();
        if (response.success && response.tickets) {
          await setCached<GetMyTicketsResponse>(CACHE_KEYS.TICKETS_MY, response);
          const eventTickets = response.tickets.filter(
            (ticket: any) => ticket.event?._id === id || ticket.event?.id === id || ticket.eventId === id
          );
          setUserTickets(eventTickets);
          setIsRegistered(eventTickets.length > 0);
        }
      } catch (error) {
        console.error('Error refreshing user tickets:', error);
      }
    }
  };

  // Fetch user's tickets for this event – show cached list in background while fetching (like events)
  useEffect(() => {
    const fetchUserTickets = async () => {
      if (!event || !user || !id) return;

      const cached = await getCached<GetMyTicketsResponse>(CACHE_KEYS.TICKETS_MY);
      if (cached?.tickets && Array.isArray(cached.tickets)) {
        const eventTickets = cached.tickets.filter(
          (ticket: any) => ticket.event?._id === id || ticket.event?.id === id || ticket.eventId === id
        );
        setUserTickets(eventTickets);
        setIsRegistered(eventTickets.length > 0);
      }

      try {
        setLoadingTickets(true);
        const response = await ticketsAPI.getMyTickets();
        if (response.success && response.tickets) {
          await setCached<GetMyTicketsResponse>(CACHE_KEYS.TICKETS_MY, response);
          const eventTickets = response.tickets.filter(
            (ticket: any) => ticket.event?._id === id || ticket.event?.id === id || ticket.eventId === id
          );
          setUserTickets(eventTickets);
          setIsRegistered(eventTickets.length > 0);
        }
      } catch (error) {
        console.error('Error fetching user tickets:', error);
      } finally {
        setLoadingTickets(false);
      }
    };

    fetchUserTickets();
  }, [event, user, id]);

  // Animate heart: scale up for like, scale down for unlike, then restore
  const animateLike = useCallback((liked: boolean) => {
    const toValue = liked ? 1.25 : 0.85;
    Animated.sequence([
      Animated.spring(likeScale, { toValue, useNativeDriver: true, speed: 50, bounciness: 12 }),
      Animated.spring(likeScale, { toValue: 1, useNativeDriver: true, speed: 50, bounciness: 8 }),
    ]).start();
  }, [likeScale]);

  // Execute the actual like/unlike API call
  const executeLikeApi = useCallback(async (action: 'like' | 'unlike', eventId: string) => {
    likeApiInProgress.current = true;
    try {
      if (action === 'unlike') {
        await eventsAPI.unlikeEvent(eventId);
      } else {
        await eventsAPI.likeEvent(eventId);
      }
      // Refresh profile to update liked events list
      try {
        const profileRes = await authAPI.getProfile();
        if (profileRes.success && profileRes.user) setUser(profileRes.user);
      } catch (_) {}
    } catch (err) {
      console.error('Like API error:', err);
    } finally {
      likeApiInProgress.current = false;
      // If there's a pending action queued, execute it
      if (pendingLikeAction.current) {
        const nextAction = pendingLikeAction.current;
        pendingLikeAction.current = null;
        executeLikeApi(nextAction, eventId);
      }
    }
  }, [setUser]);

  const handleLike = useCallback(() => {
    const isAuthenticated = useAppStore.getState().isAuthenticated;
    if (!isAuthenticated) {
      setLoginModalMessage('Please login to like events.');
      setShowLoginModal(true);
      return;
    }
    if (!event) return;
    const eventId = event._id || (event as any).id;

    // Optimistic UI update immediately
    const newLiked = !isLiked;
    setIsLiked(newLiked);
    setLikeCount((prev) => (newLiked ? prev + 1 : Math.max(0, prev - 1)));
    animateLike(newLiked);

    const action: 'like' | 'unlike' = newLiked ? 'like' : 'unlike';

    // If API call in progress, queue the latest action (overwrite previous pending)
    if (likeApiInProgress.current) {
      pendingLikeAction.current = action;
      return;
    }

    // Execute API call
    executeLikeApi(action, eventId);
  }, [event, isLiked, animateLike, executeLikeApi]);

  if (loading) {
    return <EventDetailsSkeleton />;
  }

  if (error || !event) {
    return (
      <View className="flex-1 bg-white">
        <View className="flex-1 items-center justify-center p-6">
          <Text className="text-[#EF4444] text-sm mb-4">{error || 'Event not found'}</Text>
          <TouchableOpacity
            className="bg-primary py-2 px-4 rounded-lg"
            onPress={handleBack}
          >
            <Text className="text-white text-xs font-semibold">Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const handleRegister = async () => {
    const isAuthenticated = useAppStore.getState().isAuthenticated;
    if (!isAuthenticated) {
      setLoginModalMessage('Please login to register for events.');
      setShowLoginModal(true);
      return;
    }
    if (!user || !event) return;

    const eventId = event._id || (event as any).id;

    // Check if user has phone number
    if (!user.phone || user.phone.trim() === '') {
      setShowPhoneModal(true);
      return;
    }

    await createTicket(eventId, user.phone);
  };

  const createTicket = async (eventId: string, phone: string) => {
    if (!user || !event) return;

    try {
      setCreatingTicket(true);

      const ticketData = {
        eventId,
        username: user.username || user.fullName,
        email: user.email,
        phone: phone.trim(),
      };

      const response = await ticketsAPI.createTicket(ticketData);

      if (response.success && response.ticket) {
        // Refresh user profile to update joinedEvents
        try {
          const profileResponse = await authAPI.getProfile();
          if (profileResponse.success && profileResponse.user) {
            setUser(profileResponse.user);
          }
        } catch (profileError) {
          console.error('Failed to refresh profile:', profileError);
          // Don't block success if profile refresh fails
        }

        // Refresh tickets list and save to cache
        try {
          const ticketsResponse = await ticketsAPI.getMyTickets();
          if (ticketsResponse.success && ticketsResponse.tickets) {
            await setCached<GetMyTicketsResponse>(CACHE_KEYS.TICKETS_MY, ticketsResponse);
            const eventTickets = ticketsResponse.tickets.filter(
              (ticket: any) => ticket.event?._id === id || ticket.event?.id === id || ticket.eventId === id
            );
            setUserTickets(eventTickets);
          }
        } catch (ticketsError) {
          console.error('Failed to refresh tickets:', ticketsError);
        }

        setUserTicketId(response.ticket.id);
        setIsRegistered(true);

        const isFreeEvent =
          (event as any)?.price?.price === 'free' ||
          (event as any)?.price?.currency === null ||
          !event?.ticketPrice ||
          event.ticketPrice <= 0 ||
          response.ticket.status === 'confirmed';

        setModalMessage(
          isFreeEvent
            ? 'Your free ticket is confirmed! You can view your QR code in the ticket screen.'
            : 'Ticket created successfully! Please submit payment to confirm your ticket.'
        );
        setShowModal(true);
      }
    } catch (error: any) {
      console.error('Error creating ticket:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Failed to create ticket';
      setErrorModalMessage(errorMessage);
      setShowErrorModal(true);
    } finally {
      setCreatingTicket(false);
      setShowPhoneModal(false);
      setPhoneInput('');
    }
  };

  const handlePhoneSubmit = () => {
    if (!phoneInput.trim() || phoneInput.trim().length < 10) {
      setShowInvalidPhoneModal(true);
      return;
    }
    if (!event) return;
    const eventId = event._id || (event as any).id;
    createTicket(eventId, phoneInput);
  };

  const handleViewTicket = () => {
    // Always scroll to tickets section
    if (ticketsSectionY > 0) {
      scrollViewRef.current?.scrollTo({ y: ticketsSectionY - 20, animated: true });
    } else {
      // Fallback: scroll to end if position not measured yet
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatTime = (timeString: string) => {
    return timeString;
  };

  

  return (
    <View className="flex-1 bg-white">
      {/* Fixed back button - stays on top when scrolling */}
      <View
        style={{
          position: 'absolute',
          top: insets.top + 8,
          left: 16,
          zIndex: 10,
        }}
      >
        <BackButton variant="dark" onPress={handleBack} />
      </View>
      <ScrollView
        ref={scrollViewRef}
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 100 }}
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
        {/* Header Image - tap to view full screen */}
        <TouchableOpacity
          className="w-full h-[300px] relative"
          activeOpacity={1}
          onPress={() => setShowImageViewer(true)}
        >
          <Image
            source={{ uri: getEventImageUrl(event) || 'https://via.placeholder.com/400' }}
            className="w-full h-full"
            resizeMode="cover"
          />
        </TouchableOpacity>

        {/* Event Info Card */}
        <View className="bg-white rounded-t-3xl px-4 pt-4 pb-5 -mt-5 border-t border-gray-200 overflow-hidden">
          {/* Loading line animation when fetching in background */}
          {sBackgroundFetching && (
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, backgroundColor: '#E5E7EB', zIndex: 1, overflow: 'hidden' }}>
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
          <View className="flex-row justify-between items-start mb-4">
            <Text className="text-gray-900 text-xl font-bold flex-1 mr-3 leading-tight" numberOfLines={3}>
              {event.title}
            </Text>
            <TouchableOpacity
              className="flex-row items-center gap-1.5 bg-gray-100 py-2 px-2.5 rounded-lg flex-shrink-0"
              onPress={handleLike}
              activeOpacity={0.7}
            >
              <Animated.View style={{ transform: [{ scale: likeScale }] }}>
                <MaterialIcons
                  name={isLiked ? "favorite" : "favorite-border"}
                  size={18}
                  color={isLiked ? "#EF4444" : "#9CA3AF"}
                />
              </Animated.View>
              <Text className="text-gray-700 text-sm font-semibold">{likeCount}</Text>
            </TouchableOpacity>
          </View>

          {/* Event Date & Time */}
          <View className="flex-row mb-3 items-start">
            <MaterialIcons name="calendar-today" size={18} color="#6B7280" style={{ marginRight: 10, marginTop: 2 }} />
            <View className="flex-1 min-w-0">
              <Text className="text-gray-500 text-xs font-medium mb-0.5">Date & time</Text>
              <Text className="text-gray-900 text-sm">
                {formatDate(event.date)}, {formatTime(event.time)}
              </Text>
            </View>
          </View>

          {/* Location (optional) */}
          {event.location ? (
            <View className="flex-row mb-3 items-start">
              <MaterialIcons name="location-on" size={18} color="#6B7280" style={{ marginRight: 10, marginTop: 2 }} />
              <View className="flex-1 min-w-0">
                <Text className="text-gray-500 text-xs font-medium mb-0.5">Location</Text>
                <Text className="text-gray-900 text-sm">{event.location}</Text>
              </View>
            </View>
          ) : null}

          {/* Gender (optional) */}
          {event.gender ? (
            <View className="flex-row mb-3 items-start">
              <MaterialIcons name="person-outline" size={18} color="#6B7280" style={{ marginRight: 10, marginTop: 2 }} />
              <View className="flex-1 min-w-0">
                <Text className="text-gray-500 text-xs font-medium mb-0.5">Gender</Text>
                <Text className="text-gray-900 text-sm capitalize">{event.gender}</Text>
              </View>
            </View>
          ) : null}

          {/* Ticket Price */}
          <View className="flex-row mb-3 items-start">
            <MaterialIcons name="confirmation-number" size={18} color="#6B7280" style={{ marginRight: 10, marginTop: 2 }} />
            <View className="flex-1 min-w-0">
              <Text className="text-gray-500 text-xs font-medium mb-0.5">Ticket price</Text>
              <Text className="text-gray-900 text-sm">
                {event.price?.price === 'free' || event.price?.currency === null
                  ? 'Free'
                  : event.price?.currency
                    ? `${event.price.currency} ${Number(event.price.price).toLocaleString()}`
                    : event.ticketPrice
                      ? `PKR ${event.ticketPrice.toLocaleString()}`
                      : 'Free'}
              </Text>
              {event.totalTickets != null && event.totalTickets > 0 && (
                <Text className="text-gray-500 text-xs mt-1">
                  {event.totalTickets} tickets available
                </Text>
              )}
            </View>
          </View>

          {/* Register / Get More Tickets Button */}
          {!isRegistered && (
            <TouchableOpacity
              className="py-3 rounded-xl items-center mt-1 bg-primary"
              onPress={handleRegister}
              disabled={creatingTicket}
            >
              {creatingTicket ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text className="text-white text-sm font-semibold">
                  Register now
                </Text>
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* Event Description */}
        {event.description ? (
          <View className="px-4 py-4 border-t border-gray-100 bg-white">
            <Text className="text-gray-900 text-base font-bold mb-2">About this event</Text>
            <Text className="text-gray-700 text-sm leading-6">
              {event.description}
            </Text>
          </View>
        ) : null}

        {/* Contact Information */}
        {(event.email || event.phone) && (
          <View className="px-4 py-4 border-t border-gray-100 bg-white">
            <Text className="text-gray-900 text-base font-bold mb-3">Contact</Text>
            {event.email && (
              <View className="flex-row items-center mb-2">
                <MaterialIcons name="email" size={18} color="#6B7280" style={{ marginRight: 10 }} />
                <Text className="text-gray-900 text-sm flex-1">{event.email}</Text>
              </View>
            )}
            {event.phone && (
              <View className="flex-row items-center">
                <MaterialIcons name="phone" size={18} color="#6B7280" style={{ marginRight: 10 }} />
                <Text className="text-gray-900 text-sm flex-1">{event.phone}</Text>
              </View>
            )}
          </View>
        )}

        {/* Organized By */}
        {(event.createdBy || event.organizerName) && (
          <View className="px-4 py-4 border-t border-gray-100 bg-white">
            <Text className="text-gray-900 text-base font-bold mb-3">Organized by</Text>
            <TouchableOpacity
              className="flex-row items-center"
              onPress={() => {
                const organizerId = (event.createdBy as any)?._id || (event as any).organizerId;
                if (organizerId) {
                  const origin = (returnTo || '').toString();
                  if (origin) {
                    router.push(`/user/${organizerId}?comeFrom=${encodeURIComponent(origin)}`);
                  } else {
                    router.push(`/user/${organizerId}`);
                  }
                }
              }}
              activeOpacity={0.7}
              disabled={!((event.createdBy as any)?._id || (event as any).organizerId)}
            >
              <View className="w-12 h-12 rounded-full bg-primary overflow-hidden mr-3 items-center justify-center">
                {getProfileImageUrl(event.createdBy as any) ? (
                  <Image
                    source={{ uri: getProfileImageUrl(event.createdBy as any) || '' }}
                    className="w-full h-full"
                    resizeMode="cover"
                  />
                ) : (
                  <Text className="text-white text-lg font-bold">
                    {(event.createdBy?.fullName ?? event.organizerName ?? '?').charAt(0).toUpperCase()}
                  </Text>
                )}
              </View>
              <View className="flex-1 min-w-0">
                <Text className="text-primary text-sm font-semibold">
                  {event.createdBy?.fullName ?? event.organizerName ?? '—'}
                </Text>
                {(event.createdBy?.email || (event.email && !event.createdBy?.email)) && (
                  <Text className="text-gray-500 text-xs mt-0.5">
                    {event.createdBy?.email ?? event.email}
                  </Text>
                )}
              </View>
              <MaterialIcons name="chevron-right" size={20} color="#9CA3AF" />
            </TouchableOpacity>
          </View>
        )}

        {/* User's Tickets Section */}
        {user && userTickets.length > 0 && (
          <View
            className="px-4 py-4 border-t border-gray-100 bg-white"
            onLayout={(e) => {
              const { y } = e.nativeEvent.layout;
              setTicketsSectionY(y);
            }}
          >
            <Text className="text-gray-900 text-base font-bold mb-3">Your tickets ({userTickets.length})</Text>
            {userTickets.map((ticket: any, ticketIndex: number) => {
              // Determine if this ticket is for a free event
              const isFreeEventForTicket =
                (ticket as any)?.event?.price?.price === 'free' ||
                (ticket as any)?.event?.price?.currency === null ||
                !ticket.event?.ticketPrice ||
                ticket.event.ticketPrice <= 0;

              // Get status colors and info (treat free tickets as confirmed even if backend marks them pending)
              const getStatusInfo = (status: string) => {
                switch (status) {
                  case 'confirmed':
                    return {
                      bgColor: 'bg-[#10B981]/20',
                      borderColor: 'border-[#10B981]/50',
                      badgeColor: 'bg-[#10B981]',
                      textColor: 'text-[#10B981]',
                      iconColor: '#10B981',
                      icon: 'check-circle',
                      label: 'Submitted'
                    };
                  case 'pending_payment':
                    return {
                      bgColor: 'bg-[#F59E0B]/20',
                      borderColor: 'border-[#F59E0B]/50',
                      badgeColor: 'bg-[#F59E0B]',
                      textColor: 'text-[#F59E0B]',
                      iconColor: '#F59E0B',
                      icon: 'schedule',
                      label: 'Pending'
                    };
                  case 'payment_in_review':
                    return {
                      bgColor: 'bg-[#3B82F6]/20',
                      borderColor: 'border-[#3B82F6]/50',
                      badgeColor: 'bg-[#3B82F6]',
                      textColor: 'text-[#3B82F6]',
                      iconColor: '#3B82F6',
                      icon: 'hourglass-empty',
                      label: 'In Review'
                    };
                  case 'used':
                    return {
                      bgColor: 'bg-[#6B7280]/20',
                      borderColor: 'border-[#6B7280]/50',
                      badgeColor: 'bg-[#6B7280]',
                      textColor: 'text-[#6B7280]',
                      iconColor: '#6B7280',
                      icon: 'check',
                      label: 'Used'
                    };
                  case 'cancelled':
                    return {
                      bgColor: 'bg-[#EF4444]/20',
                      borderColor: 'border-[#EF4444]/50',
                      badgeColor: 'bg-[#EF4444]',
                      textColor: 'text-[#EF4444]',
                      iconColor: '#EF4444',
                      icon: 'cancel',
                      label: 'Cancelled'
                    };
                  default:
                    return {
                      bgColor: 'bg-[#9CA3AF]/20',
                      borderColor: 'border-[#9CA3AF]/50',
                      badgeColor: 'bg-[#9CA3AF]',
                      textColor: 'text-[#9CA3AF]',
                      iconColor: '#9CA3AF',
                      icon: 'help-outline',
                      label: status
                    };
                }
              };

              const rawStatus = ticket.status;
              const effectiveStatus =
                isFreeEventForTicket &&
                (rawStatus === 'pending_payment' || rawStatus === 'payment_in_review')
                  ? 'confirmed'
                  : rawStatus;

              const statusInfo = getStatusInfo(effectiveStatus);
              const ticketId = ticket.id || ticket._id || `ticket-${ticketIndex}`;

              return (
                <TouchableOpacity
                  key={ticketId}
                  className={`${statusInfo.bgColor} ${statusInfo.borderColor} rounded-xl p-3 mb-3 border`}
                  onPress={() => router.push(`/ticket/${ticketId}`)}
                  activeOpacity={0.7}
                >
                  <View className="flex-row items-start justify-between">
                    <View className="flex-1 mr-2 min-w-0">
                      <View className="flex-row items-center justify-between mb-2">
                        <View className="flex-row items-center flex-1 min-w-0">
                          <MaterialIcons
                            name={statusInfo.icon as any}
                            size={18}
                            color={statusInfo.iconColor}
                            style={{ marginRight: 8 }}
                          />
                          <Text className="text-gray-900 text-sm font-bold" numberOfLines={1}>
                            Ticket #{ticketId.slice(-8).toUpperCase()}
                          </Text>
                        </View>
                        <View className={`${statusInfo.badgeColor} px-2 py-1 rounded-full ml-2`}>
                          <Text className="text-white text-[10px] font-bold uppercase">
                            {statusInfo.label}
                          </Text>
                        </View>
                      </View>
                      <View>
                        <View className="flex-row items-center mb-1.5">
                          <MaterialIcons name="email" size={14} color="#6B7280" style={{ marginRight: 8 }} />
                          <Text className="text-gray-700 text-xs flex-1" numberOfLines={1}>
                            {ticket.email}
                          </Text>
                        </View>
                        <View className="flex-row items-center mb-1.5">
                          <MaterialIcons name="phone" size={14} color="#6B7280" style={{ marginRight: 8 }} />
                          <Text className="text-gray-700 text-xs">{ticket.phone}</Text>
                        </View>
                        {ticket.createdAt && (
                          <View className="flex-row items-center">
                            <MaterialIcons name="calendar-today" size={14} color="#6B7280" style={{ marginRight: 8 }} />
                            <Text className="text-gray-500 text-xs">
                              {new Date(ticket.createdAt).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })}
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
                    <View className="justify-center pt-1">
                      <MaterialIcons name="chevron-right" size={20} color="#6B7280" />
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>

      <Modal
        visible={showModal}
        onClose={() => {
          setShowModal(false);
          if (userTicketId) {
            router.push(`/ticket/${userTicketId}`);
          } else if (event) {
            const eventId = event._id || (event as any).id;
            router.push(`/ticket/${eventId}`);
          }
        }}
        title="Success"
        message={modalMessage}
        primaryButtonText="View Ticket"
        onPrimaryPress={() => {
          setShowModal(false);
          if (userTicketId) {
            router.push(`/ticket/${userTicketId}`);
          } else if (event) {
            const eventId = event._id || (event as any).id;
            router.push(`/ticket/${eventId}`);
          }
        }}
        variant="success"
      />

      <Modal
        visible={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        title="Login Required"
        message={loginModalMessage}
        primaryButtonText="Login"
        secondaryButtonText="Cancel"
        onPrimaryPress={() => {
          setShowLoginModal(false);
          router.push('/login');
        }}
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
        visible={showInvalidPhoneModal}
        onClose={() => setShowInvalidPhoneModal(false)}
        title="Invalid Phone"
        message="Please enter a valid phone number (at least 10 digits)."
        primaryButtonText="OK"
        onPrimaryPress={() => setShowInvalidPhoneModal(false)}
        variant="error"
      />

      {/* Phone Number Modal - custom content, same theme */}
      <RNModal
        visible={showPhoneModal}
        transparent
        animationType="fade"
        onRequestClose={() => { setShowPhoneModal(false); setPhoneInput(''); }}
      >
        <Pressable className="flex-1 bg-black/70 justify-center items-center p-3" onPress={() => { setShowPhoneModal(false); setPhoneInput(''); }}>
          <Pressable className="bg-white rounded-xl border border-gray-200 p-4 w-full max-w-[400px]" onPress={(e) => e.stopPropagation()}>
            <View className="items-center pt-1 pb-2">
              <View className="w-8 h-0.5 rounded-full bg-gray-300" />
            </View>
            <Text className="text-gray-900 text-base font-bold mb-1.5 text-center">Phone Number Required</Text>
            <Text className="text-gray-600 text-xs leading-5 mb-3 text-center">
              Enter your phone number to create a ticket
            </Text>
            <TextInput
              className="bg-gray-50 text-gray-900 text-xs px-3 py-2 rounded-lg mb-3 border border-gray-200"
              placeholder="Enter your phone number"
              placeholderTextColor="#9CA3AF"
              value={phoneInput}
              onChangeText={setPhoneInput}
              keyboardType="phone-pad"
              autoFocus
            />
            <View className="flex-row gap-2">
              <TouchableOpacity
                className="flex-1 py-2 rounded-lg items-center bg-gray-100 border border-gray-200"
                onPress={() => { setShowPhoneModal(false); setPhoneInput(''); }}
              >
                <Text className="text-gray-900 text-xs font-semibold">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="flex-1 py-2 rounded-lg items-center bg-primary"
                onPress={handlePhoneSubmit}
                disabled={creatingTicket}
              >
                {creatingTicket ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text className="text-white text-xs font-semibold">Submit</Text>
                )}
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </RNModal>

      {/* Event Image Full View */}
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
          <Image
            source={{ uri: getEventImageUrl(event) || 'https://via.placeholder.com/400' }}
            style={{
              width: Dimensions.get('window').width,
              height: Dimensions.get('window').height,
            }}
            resizeMode="contain"
          />
          <TouchableOpacity
            className="absolute right-4 bg-white/20 w-7 h-7 rounded-full items-center justify-center"
            style={{ top: insets.top + 8 }}
            onPress={() => setShowImageViewer(false)}
          >
            <MaterialIcons name="close" size={18} color="#FFFFFF" />
          </TouchableOpacity>
        </Pressable>
      </RNModal>
    </View>
  );
}

