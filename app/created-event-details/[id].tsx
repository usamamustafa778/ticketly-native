import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Modal as RNModal,
  Pressable,
  Dimensions,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAppStore } from '@/store/useAppStore';
import { eventsAPI, type Event } from '@/lib/api/events';
import { ticketsAPI } from '@/lib/api/tickets';
import { CACHE_KEYS, getCached, setCached } from '@/lib/cache';
import { BackButton } from '@/components/BackButton';
import { EventDetailsSkeleton } from '@/components/EventDetailsSkeleton';
import { ButtonPrimary } from '@/components/ui/ButtonPrimary';
import { Label } from '@/components/ui/Label';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import AnimatedReanimated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  cancelAnimation,
} from 'react-native-reanimated';
import { getEventImageUrl, getProfileImageUrl } from '@/lib/utils/imageUtils';
import { QRScanner } from '@/components/QRScanner';
import { Modal } from '@/components/Modal';

type TicketStatus = 'all' | 'pending_payment' | 'payment_in_review' | 'confirmed' | 'used' | 'cancelled';

interface Ticket {
  id: string;
  user?: {
    _id: string;
    fullName: string;
    username?: string;
    email: string;
  };
  username: string;
  email: string;
  phone: string;
  status: string;
  accessKey?: string;
  qrCodeUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export default function CreatedEventDetailsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useAppStore((state) => state.user);

  const [event, setEvent] = useState<Event | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TicketStatus>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [updateModalOpen, setUpdateModalOpen] = useState(false);
  const [ticketNumber, setTicketNumber] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<'used' | 'cancelled' | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [qrScannerOpen, setQrScannerOpen] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successModalMessage, setSuccessModalMessage] = useState('');
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorModalMessage, setErrorModalMessage] = useState('');
  const [detailsExpanded, setDetailsExpanded] = useState(true);
  const [showImageViewer, setShowImageViewer] = useState(false);
  const [sBackgroundFetching, setIsBackgroundFetching] = useState(false);
  const loadingLineProgress = useSharedValue(0);

  // Get event ID helper
  const getEventId = () => {
    return Array.isArray(id) ? id[0] : id;
  };

  // Fetch event details - cache first (works for logged-in and logged-out)
  const fetchEvent = async (showRefreshing = false) => {
    const eventId = getEventId();

    if (!eventId) {
      setError('Event ID is required');
      setLoading(false);
      return;
    }

    let hadCache = false;
    if (!showRefreshing) {
      const cached = await getCached<{ event: Event }>(CACHE_KEYS.EVENT_BY_ID(eventId));
      if (cached?.event) {
        hadCache = true;
        setEvent(cached.event);
        setError(null);
        setLoading(false);
      }
    }

    try {
      if (showRefreshing) setRefreshing(true);
      else if (!hadCache) setLoading(true);
      if (hadCache) setIsBackgroundFetching(true);
      setError(null);
      const response = await eventsAPI.getEventById(String(eventId));

      if (response.success && response.event) {
        const eventData = response.event as any;
        const transformedEvent: Event = {
          ...eventData,
          _id: eventData.id || eventData._id,
        };
        await setCached(CACHE_KEYS.EVENT_BY_ID(eventId), {
          event: transformedEvent,
          isLiked: !!eventData.isLiked,
          likeCount: eventData.likeCount ?? 0,
        });
        setEvent(transformedEvent);
      } else if (!hadCache) {
        setError('Event not found');
      }
    } catch (err: any) {
      console.error('Error fetching event:', err);
      const errorMessage = err.response?.data?.message || err.response?.data?.error || err.message || 'Failed to load event';
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

  // Fetch tickets for this event
  const fetchTickets = async (showRefreshing = false) => {
    const eventId = getEventId();

    if (!eventId) return;

    try {
      if (!showRefreshing) {
        setLoadingTickets(true);
      }
      console.log('Fetching tickets for event ID:', eventId);
      const response = await eventsAPI.getTicketsByEventId(String(eventId));
      if (response.success && response.tickets) {
        console.log('Tickets fetched successfully:', response.tickets.length);
        setTickets(response.tickets);
      }
    } catch (err: any) {
      console.error('Error fetching tickets:', err);
      console.error('Ticket error details:', {
        message: err.message,
        response: err.response?.data,
        status: err.response?.status,
      });
      // Don't set error state for tickets - just log it
      // The event might still be viewable even if tickets fail to load
    } finally {
      setLoadingTickets(false);
    }
  };

  // Initial load
  useEffect(() => {
    fetchEvent();
  }, [id]);

  useEffect(() => {
    if (event) {
      fetchTickets();
    }
  }, [event, id]);

  // Refresh both event and tickets
  const onRefresh = async () => {
    await Promise.all([fetchEvent(true), fetchTickets(true)]);
  };

  // Handle ticket status update by ticket #
  const handleUpdateTicketStatus = async () => {
    if (!ticketNumber.trim()) {
      setUpdateError('Please enter a ticket number');
      return;
    }

    if (!selectedStatus) {
      setUpdateError('Please select a status');
      return;
    }

    try {
      setUpdatingStatus(true);
      setUpdateError(null); // Clear any previous errors
      
      const response = await ticketsAPI.updateTicketStatusByKey({
        accessKey: ticketNumber.trim(),
        status: selectedStatus,
      });

      if (response.success) {
        // Close modal immediately
        setUpdateModalOpen(false);
        setTicketNumber('');
        setSelectedStatus(null);
        setUpdateError(null);
        
        // Refresh tickets to show updated status
        fetchTickets();
        
        // Show success message after modal is closed
        setTimeout(() => {
          setSuccessModalMessage(response.message || 'Ticket status updated successfully');
          setShowSuccessModal(true);
        }, 300);
      }
    } catch (error: any) {
      console.error('Error updating ticket status:', error);
      console.error('Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        statusText: error.response?.statusText,
      });
      
      // Extract error message from response
      let errorMessage = 'Failed to update ticket status';
      
      if (error.response?.data) {
        // Try different possible error message fields
        errorMessage = 
          error.response.data.message ||
          error.response.data.error ||
          (Array.isArray(error.response.data.errors) 
            ? error.response.data.errors.join(', ') 
            : error.response.data.errors) ||
          errorMessage;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      // Set error state to display in modal
      setUpdateError(errorMessage);
      setErrorModalMessage(errorMessage);
      setShowErrorModal(true);
    } finally {
      setUpdatingStatus(false);
    }
  };

  // Filter tickets by status
  const getFilteredTickets = () => {
    if (activeTab === 'all') {
      return tickets;
    }
    return tickets.filter((ticket) => ticket.status === activeTab);
  };

  // Get status info for styling
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

  // Get count for each status
  const getStatusCount = (status: TicketStatus) => {
    if (status === 'all') return tickets.length;
    return tickets.filter((ticket) => ticket.status === status).length;
  };

  const tabs: { key: TicketStatus; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'pending_payment', label: 'Pending' },
    { key: 'payment_in_review', label: 'In Review' },
    { key: 'confirmed', label: 'Submitted' },
    { key: 'used', label: 'Used' },
    { key: 'cancelled', label: 'Cancelled' },
  ];

  if (loading && !event) {
    return <EventDetailsSkeleton />;
  }

  if (error || !event) {
    return (
      <View className="flex-1 bg-white">
        <View className="flex-1 items-center justify-center p-10">
          <Text className="text-[#EF4444] text-lg mb-6">{error || 'Event not found'}</Text>
          <ButtonPrimary onPress={() => router.back()}>
            Go Back
          </ButtonPrimary>
        </View>
      </View>
    );
  }

  const filteredTickets = getFilteredTickets();

  return (
    <View className="flex-1 bg-white">
      {/* Fixed back and edit buttons - stay on top when scrolling */}
      <View
        style={{
          position: 'absolute',
          top: insets.top + 0,
          left: 0,
          right: 0,
          flexDirection: 'row',
          justifyContent: 'space-between',
          zIndex: 10,
          paddingHorizontal: 16,
          paddingVertical: 8,

        }}
      >
        <BackButton variant="dark" onPress={() => router.back()} />
        <TouchableOpacity
          className="bg-primary w-7 h-7 rounded-full items-center justify-center"
          onPress={() => {
            const eventId = getEventId();
            if (eventId) {
              router.push(`/edit-event/${eventId}`);
            }
          }}
        >
          <MaterialIcons name="edit" size={16} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
      <ScrollView
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
        stickyHeaderIndices={[1]}
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

        {/* Sticky Container: Event Info Card + Tabs */}
        <View className="bg-white">
          {/* Event Info Card - Compact */}
          <View className="bg-white rounded-t-3xl px-3 py-2.5 -mt-5 border-t border-gray-200 overflow-hidden">
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
            <View className="flex-row justify-between items-start mb-3">
              <Text className="text-gray-900 text-lg font-bold flex-1 mr-2">{event.title}</Text>
              <View className="flex-row items-center gap-1.5">
                <Label
                  variant={
                    event.status === 'approved'
                      ? 'success'
                      : event.status === 'pending'
                        ? 'warning'
                        : 'neutral'
                  }
                >
                  {event.status === 'approved' ? 'Approved' : event.status === 'pending' ? 'Pending' : 'Draft'}
                </Label>
                {/* <TouchableOpacity
                  className="bg-primary py-1 px-2 rounded-lg flex-row items-center"
                  onPress={() => {
                    const eventId = getEventId();
                    if (eventId) {
                      router.push(`/edit-event/${eventId}`);
                    }
                  }}
                >
                  <MaterialIcons name="edit" size={12} color="#FFFFFF" style={{ marginRight: 3 }} />
                  <Text className="text-white text-[10px] font-semibold">Edit</Text>
                </TouchableOpacity> */}
              </View>
            </View>

            {/* Event Details - Collapsible */}
            <TouchableOpacity
              className="flex-row items-center justify-between py-2 mb-1"
              onPress={() => setDetailsExpanded((v) => !v)}
              activeOpacity={0.7}
            >
              <Text className="text-gray-900 text-sm font-semibold">Event details</Text>
              <MaterialIcons
                name={detailsExpanded ? 'expand-less' : 'expand-more'}
                size={20}
                color="#6B7280"
              />
            </TouchableOpacity>
            {detailsExpanded && (
              <>
                {/* Event Date & Time */}
                <View className="flex-row mb-2 items-start">
                  <MaterialIcons name="calendar-today" size={16} color="#6B7280" style={{ marginRight: 8, marginTop: 1 }} />
                  <View className="flex-1">
                    <Text className="text-gray-900 text-xs font-semibold mb-0.5">Event Date & Time</Text>
                    <Text className="text-gray-700 text-xs">
                      {new Date(event.date).toLocaleDateString('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                      })}, {event.time}
                    </Text>
                  </View>
                </View>

                {/* Location (optional) */}
                {event.location ? (
                  <View className="flex-row mb-2 items-start">
                    <MaterialIcons name="location-on" size={16} color="#6B7280" style={{ marginRight: 8, marginTop: 1 }} />
                    <View className="flex-1">
                      <Text className="text-gray-900 text-xs font-semibold mb-0.5">Location</Text>
                      <Text className="text-gray-700 text-xs">{event.location}</Text>
                    </View>
                  </View>
                ) : null}

                {/* Event Description */}
                {event.description ? (
                  <View className="mb-2">
                    <Text className="text-gray-900 text-xs font-semibold mb-0.5">Description</Text>
                    <Text className="text-gray-700 text-xs leading-5">{event.description}</Text>
                  </View>
                ) : null}

                {/* Gender (optional) */}
                {event.gender ? (
                  <View className="flex-row mb-2 items-start">
                    <MaterialIcons name="person-outline" size={16} color="#6B7280" style={{ marginRight: 8, marginTop: 1 }} />
                    <View className="flex-1">
                      <Text className="text-gray-900 text-xs font-semibold mb-0.5">Gender</Text>
                      <Text className="text-gray-700 text-xs capitalize">{event.gender}</Text>
                    </View>
                  </View>
                ) : null}

                {/* Price */}
                <View className="flex-row mb-2 items-start">
                  <MaterialIcons name="confirmation-number" size={16} color="#6B7280" style={{ marginRight: 8, marginTop: 1 }} />
                  <View className="flex-1">
                    <Text className="text-gray-900 text-xs font-semibold mb-0.5">Ticket Price</Text>
                    <Text className="text-gray-700 text-xs">
                      {event.price?.price === 'free' || event.price?.currency === null
                        ? 'Free'
                        : event.price?.currency
                          ? `${event.price.currency} ${Number(event.price.price).toLocaleString()}`
                          : event.ticketPrice
                            ? `PKR ${event.ticketPrice.toLocaleString()}`
                            : 'Free'}
                    </Text>
                  </View>
                </View>

                {/* Total Tickets Count */}
                <View className="flex-row mb-2 items-start">
                  <MaterialIcons name="confirmation-number" size={16} color="#6B7280" style={{ marginRight: 8, marginTop: 1 }} />
                  <View className="flex-1">
                    <Text className="text-gray-900 text-xs font-semibold mb-0.5">Total Tickets</Text>
                    <Text className="text-gray-700 text-xs">
                      {tickets.length} ticket{tickets.length !== 1 ? 's' : ''} sold
                    </Text>
                  </View>
                </View>
              </>
            )}

            {/* Event Ticket Theme - Compact */}
            <TouchableOpacity
              className="flex-row border items-center py-2 px-3 rounded-lg bg-gray-50 border border-gray-200 mb-3"
              activeOpacity={1}
              onPress={() => {
                const evId = getEventId();
                if (evId) router.push(`/event-ticket-theme/${evId}`);
              }}
            >
              <MaterialIcons name="palette" size={16} color="#DC2626" style={{ marginRight: 8 }} />
              <View className="flex-1">
                <Text className="text-gray-900 text-xs font-semibold">Event Ticket</Text>
                <Text className="text-gray-600 text-[10px]">
                  Customize colors & look
                </Text>
              </View>
              <MaterialIcons name="chevron-right" size={18} color="#9CA3AF" />
            </TouchableOpacity>

            {/* Organized by (host) - show current user / event creator */}
            {(user || (event as any)?.createdBy) && (
              <View className="flex-row items-center py-2 mb-2 border-t border-gray-100 pt-3">
                <View className="w-10 h-10 rounded-full bg-primary overflow-hidden mr-3 items-center justify-center">
                  {getProfileImageUrl((event as any)?.createdBy || user as any) ? (
                    <Image
                      source={{ uri: getProfileImageUrl((event as any)?.createdBy || user as any) || '' }}
                      className="w-full h-full"
                      resizeMode="cover"
                    />
                  ) : (
                    <Text className="text-white text-base font-bold">
                      {((event as any)?.createdBy?.fullName ?? user?.fullName ?? '?').charAt(0).toUpperCase()}
                    </Text>
                  )}
                </View>
                <View className="flex-1">
                  <Text className="text-gray-500 text-[10px] font-medium mb-0.5">Organized by</Text>
                  <Text className="text-gray-900 text-sm font-semibold">
                    {(event as any)?.createdBy?.fullName ?? user?.fullName ?? '—'}
                  </Text>
                </View>
              </View>
            )}
          </View>

          {/* Tabs Section - Compact */}
          <View className="px-2 pt-2 pb-2 bg-white">
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 6 }}
            >
              {tabs.map((tab) => {
                const count = getStatusCount(tab.key);
                const isActive = activeTab === tab.key;
                return (
                  <TouchableOpacity
                    activeOpacity={1}
                    key={tab.key}
                    className={`py-1.5 px-3 rounded-lg flex-row items-center gap-1.5 ${isActive ? 'bg-primary' : 'bg-gray-100'
                      }`}
                    onPress={() => setActiveTab(tab.key)}
                  >
                    <Text className={`text-[10px] font-semibold ${isActive ? 'text-white' : 'text-gray-600'}`}>
                      {tab.label}
                    </Text>
                    <View className={`px-1.5 py-0.5 rounded-full ${isActive ? 'bg-white/20' : 'bg-[#374151]'}`}>
                      <Text className={`text-[9px] font-bold ${isActive ? 'text-white' : 'text-white'}`}>
                        {count}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>

        {/* Update Ticket Status Section - Compact */}
        <View className="px-2 mt-2 mb-1">
          <TouchableOpacity
            className="bg-primary py-2.5 px-3 rounded-lg flex-row items-center justify-center"
            onPress={() => setUpdateModalOpen(true)}
          >
            <MaterialIcons name="edit" size={14} color="#FFFFFF" style={{ marginRight: 6 }} />
            <Text className="text-white text-xs font-semibold">Update Ticket Status by Ticket #</Text>
          </TouchableOpacity>
        </View>

        {/* Tickets List - Compact */}
        <View className="px-2 mt-1">
          {loadingTickets ? (
            <View className="py-6 items-center">
              <ActivityIndicator size="small" color="#DC2626" />
              <Text className="text-gray-700 text-xs mt-2">Loading tickets...</Text>
            </View>
          ) : filteredTickets.length === 0 ? (
            <View className="py-6 items-center">
              <MaterialIcons name="confirmation-number" size={36} color="#6B7280" />
              <Text className="text-[#6B7280] text-xs mt-2">
                {activeTab === 'all' ? 'No tickets found' : `No ${tabs.find(t => t.key === activeTab)?.label.toLowerCase()} tickets`}
              </Text>
            </View>
          ) : (
            <View>
              {filteredTickets.map((ticket) => {
                const statusInfo = getStatusInfo(ticket.status);
                const ticketId = ticket.id || ticket.user?._id || 'unknown';
                const displayName = ticket.user?.fullName || ticket.username || 'Unknown User';
                const displayEmail = ticket.user?.email || ticket.email || 'No email';
                const displayPhone = ticket.phone || 'No phone';

                return (
                  <View
                    key={ticketId}
                    className={`${statusInfo.bgColor} ${statusInfo.borderColor} rounded-lg p-2.5 mb-2 border`}
                  >
                    <View className="flex-row items-start justify-between mb-2">
                      <View className="flex-row items-center flex-1 min-w-0">
                        <MaterialIcons
                          name={statusInfo.icon as any}
                          size={16}
                          color={statusInfo.iconColor}
                          style={{ marginRight: 6 }}
                        />
                        <Text className="text-gray-900 text-xs font-bold flex-1" numberOfLines={1}>
                          {displayName}
                        </Text>
                      </View>
                      <Label
                        variant={
                          ticket.status === 'confirmed'
                            ? 'success'
                            : ticket.status === 'pending_payment'
                              ? 'warning'
                              : ticket.status === 'payment_in_review'
                                ? 'info'
                                : ticket.status === 'used'
                                  ? 'neutral'
                                  : ticket.status === 'cancelled'
                                    ? 'error'
                                    : 'neutral'
                        }
                        className="ml-1"
                      >
                        {statusInfo.label}
                      </Label>
                    </View>

                    {/* Ticket Details */}
                    <View>
                      {ticket.accessKey && (
                        <View className="flex-row items-center mb-1">
                          <MaterialIcons name="confirmation-number" size={12} color="#9CA3AF" style={{ marginRight: 6 }} />
                          <Text className="text-gray-700 text-[9px] font-mono flex-1" numberOfLines={1}>
                            {ticket.accessKey}
                          </Text>
                        </View>
                      )}
                      <View className="flex-row items-center mb-1">
                        <MaterialIcons name="email" size={12} color="#6B7280" style={{ marginRight: 6 }} />
                        <Text className="text-gray-700 text-[10px] flex-1" numberOfLines={1}>
                          {displayEmail}
                        </Text>
                      </View>
                      <View className="flex-row items-center mb-1">
                        <MaterialIcons name="phone" size={12} color="#6B7280" style={{ marginRight: 6 }} />
                        <Text className="text-gray-700 text-[10px]">
                          {displayPhone}
                        </Text>
                      </View>
                      {ticket.createdAt && (
                        <View className="flex-row items-center">
                          <MaterialIcons name="calendar-today" size={12} color="#9CA3AF" style={{ marginRight: 6 }} />
                          <Text className="text-gray-600 text-[9px]">
                            {new Date(ticket.createdAt).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </Text>
                        </View>
                      )}
                      {ticket.user?.username && (
                        <View className="flex-row items-center mt-1">
                          <MaterialIcons name="person" size={12} color="#9CA3AF" style={{ marginRight: 6 }} />
                          <Text className="text-gray-600 text-[9px]">
                            @{ticket.user.username}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>

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
        visible={showErrorModal}
        onClose={() => setShowErrorModal(false)}
        title="Error"
        message={errorModalMessage}
        primaryButtonText="OK"
        onPrimaryPress={() => setShowErrorModal(false)}
        variant="error"
      />

      {/* Update Ticket Status Modal */}
      <RNModal
        visible={updateModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setUpdateModalOpen(false);
          setTicketNumber('');
          setSelectedStatus(null);
          setUpdateError(null);
        }}
      >
        <Pressable
          className="flex-1 bg-black/70 justify-center items-center p-3"
          onPress={() => {
            setUpdateModalOpen(false);
            setTicketNumber('');
            setSelectedStatus(null);
            setUpdateError(null);
          }}
        >
          <Pressable
            className="bg-[#1F1F1F] rounded-xl p-4 w-full max-w-[400px]"
            onPress={(e) => e.stopPropagation()}
          >
            <Text className="text-white text-base font-bold mb-2 text-center">Update Ticket Status</Text>
            <Text className="text-[#D1D5DB] text-xs mb-3">
              Enter ticket # to update status. Only &quot;Submitted&quot; tickets can be updated.
            </Text>

            {/* Error Message */}
            {updateError && (
              <View className="bg-[#EF4444]/20 border border-[#EF4444]/50 rounded-lg p-2 mb-3">
                <View className="flex-row items-center">
                  <MaterialIcons name="error-outline" size={16} color="#EF4444" style={{ marginRight: 6 }} />
                  <Text className="text-[#EF4444] text-xs flex-1">{updateError}</Text>
                </View>
              </View>
            )}

            {/* Ticket Number Input */}
            <View className="mb-3">
              <View className="flex-row items-center justify-between mb-1">
                <Text className="text-white text-xs font-semibold">Ticket Number</Text>
                <TouchableOpacity
                  className="bg-primary py-1 px-2 rounded flex-row items-center"
                  onPress={() => {
                    setQrScannerOpen(true);
                  }}
                >
                  <MaterialIcons name="qr-code-scanner" size={12} color="#FFFFFF" style={{ marginRight: 3 }} />
                  <Text className="text-white text-[10px] font-semibold">Scan QR</Text>
                </TouchableOpacity>
              </View>
              <TextInput
                className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-900 text-xs"
                placeholder="Enter ticket # (e.g., TK-1234567890-ABC123-4567)"
                placeholderTextColor="#6B7280"
                value={ticketNumber}
                onChangeText={(text) => {
                  setTicketNumber(text);
                  // Clear error when user starts typing
                  if (updateError) {
                    setUpdateError(null);
                  }
                }}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            {/* Status Selection */}
            <View className="mb-3">
              <Text className="text-white text-xs font-semibold mb-1">New Status</Text>
              <View className="flex-row gap-2">
                <TouchableOpacity
                  className={`flex-1 py-2 px-3 rounded-lg border ${
                    selectedStatus === 'used'
                      ? 'bg-[#10B981]/20 border-[#10B981]'
                      : 'bg-[#0F0F0F] border-[#374151]'
                  }`}
                  onPress={() => setSelectedStatus('used')}
                >
                  <View className="flex-row items-center justify-center">
                    <MaterialIcons
                      name="check-circle"
                      size={14}
                      color={selectedStatus === 'used' ? '#10B981' : '#9CA3AF'}
                      style={{ marginRight: 4 }}
                    />
                    <Text
                      className={`text-xs font-semibold ${
                        selectedStatus === 'used' ? 'text-[#10B981]' : 'text-[#9CA3AF]'
                      }`}
                    >
                      Used
                    </Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  className={`flex-1 py-2 px-3 rounded-lg border ${
                    selectedStatus === 'cancelled'
                      ? 'bg-[#EF4444]/20 border-[#EF4444]'
                      : 'bg-[#0F0F0F] border-[#374151]'
                  }`}
                  onPress={() => setSelectedStatus('cancelled')}
                >
                  <View className="flex-row items-center justify-center">
                    <MaterialIcons
                      name="cancel"
                      size={14}
                      color={selectedStatus === 'cancelled' ? '#EF4444' : '#9CA3AF'}
                      style={{ marginRight: 4 }}
                    />
                    <Text
                      className={`text-xs font-semibold ${
                        selectedStatus === 'cancelled' ? 'text-[#EF4444]' : 'text-[#9CA3AF]'
                      }`}
                    >
                      Cancelled
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>
            </View>

            {/* Action Buttons */}
            <View className="flex-row gap-2">
              <TouchableOpacity
                className="flex-1 bg-[#374151] py-2 px-3 rounded-lg"
                onPress={() => {
                  setUpdateModalOpen(false);
                  setTicketNumber('');
                  setSelectedStatus(null);
                  setUpdateError(null);
                }}
                disabled={updatingStatus}
              >
                <Text className="text-white text-xs text-center font-semibold">Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                className="flex-1 bg-primary py-2 px-3 rounded-lg flex-row items-center justify-center"
                onPress={handleUpdateTicketStatus}
                disabled={updatingStatus || !ticketNumber.trim() || !selectedStatus}
              >
                {updatingStatus ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <MaterialIcons name="save" size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
                    <Text className="text-white text-xs text-center font-semibold">Update</Text>
                  </>
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
            <MaterialIcons name="close" size={16} color="#FFFFFF" />
          </TouchableOpacity>
        </Pressable>
      </RNModal>

      {/* QR Scanner Modal */}
      <QRScanner
        visible={qrScannerOpen}
        onClose={() => setQrScannerOpen(false)}
        onScan={(data) => {
          console.log('QR Code scanned:', data);
          setTicketNumber(data);
          setQrScannerOpen(false);
          // Clear error when QR is scanned
          if (updateError) {
            setUpdateError(null);
          }
        }}
      />
    </View>
  );
}

