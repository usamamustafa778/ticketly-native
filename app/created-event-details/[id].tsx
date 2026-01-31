import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAppStore } from '@/store/useAppStore';
import { eventsAPI, type Event } from '@/lib/api/events';
import { ticketsAPI } from '@/lib/api/tickets';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { getEventImageUrl } from '@/lib/utils/imageUtils';
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

  // Get event ID helper
  const getEventId = () => {
    return Array.isArray(id) ? id[0] : id;
  };

  // Fetch event details
  const fetchEvent = async (showRefreshing = false) => {
    const eventId = getEventId();

    if (!eventId) {
      setError('Event ID is required');
      setLoading(false);
      return;
    }

    try {
      if (showRefreshing) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);
      console.log('Fetching event with ID:', eventId, 'Type:', typeof eventId);
      const response = await eventsAPI.getEventById(String(eventId));

      if (response.success && response.event) {
        const eventData = response.event as any;
        const transformedEvent: Event = {
          ...eventData,
          _id: eventData.id || eventData._id,
        };
        setEvent(transformedEvent);
      } else {
        setError('Event not found');
      }
    } catch (err: any) {
      console.error('Error fetching event:', err);
      console.error('Error details:', {
        message: err.message,
        response: err.response?.data,
        status: err.response?.status,
        statusText: err.response?.statusText,
      });
      const errorMessage = err.response?.data?.message || err.response?.data?.error || err.message || 'Failed to load event';
      setError(errorMessage);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

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
    return (
      <View className="flex-1 bg-white">
        <View className="flex-1 items-center justify-center p-10">
          <ActivityIndicator size="large" color="#DC2626" />
          <Text className="text-gray-700 text-base mt-4">Loading event...</Text>
        </View>
      </View>
    );
  }

  if (error || !event) {
    return (
      <View className="flex-1 bg-white">
        <View className="flex-1 items-center justify-center p-10">
          <Text className="text-[#EF4444] text-lg mb-6">{error || 'Event not found'}</Text>
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

  const filteredTickets = getFilteredTickets();

  return (
    <View className="flex-1 bg-white">
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
        {/* Header Image */}
        <View className="w-full h-[300px] relative">
          <Image
            source={{ uri: getEventImageUrl(event) || 'https://via.placeholder.com/400' }}
            className="w-full h-full"
            resizeMode="cover"
          />
          <TouchableOpacity
            className="absolute top-[50px] left-5 bg-black/50 w-10 h-10 rounded-full items-center justify-center"
            onPress={() => router.back()}
          >
            <MaterialIcons name="arrow-back" size={20} color="#FFFFFF" />
          </TouchableOpacity>
          <TouchableOpacity
            className="absolute top-[50px] right-5 bg-primary w-10 h-10 rounded-full items-center justify-center"
            onPress={() => {
              const eventId = getEventId();
              if (eventId) {
                router.push(`/edit-event/${eventId}`);
              }
            }}
          >
            <MaterialIcons name="edit" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* Sticky Container: Event Info Card + Tabs */}
        <View className="bg-white">
          {/* Event Info Card */}
          <View className="bg-white rounded-t-3xl p-5 -mt-5 border-t border-gray-200">
            <View className="flex-row justify-between items-start mb-6">
              <Text className="text-gray-900 text-2xl font-bold flex-1 mr-3">{event.title}</Text>
              <View className="flex-row items-center gap-2">
                <View className="bg-gray-100 py-1.5 px-3 rounded-xl">
                  <Text className="text-gray-700 text-xs font-semibold">
                    {event.status === 'approved' ? 'Approved' : event.status === 'pending' ? 'Pending' : 'Draft'}
                  </Text>
                </View>
                <TouchableOpacity
                  className="bg-primary py-2 px-3 rounded-xl flex-row items-center"
                  onPress={() => {
                    const eventId = getEventId();
                    if (eventId) {
                      router.push(`/edit-event/${eventId}`);
                    }
                  }}
                >
                  <MaterialIcons name="edit" size={16} color="#FFFFFF" style={{ marginRight: 4 }} />
                  <Text className="text-white text-xs font-semibold">Edit</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Event Date & Time */}
            <View className="flex-row mb-5 items-start">
              <MaterialIcons name="calendar-today" size={20} color="#6B7280" style={{ marginRight: 12, marginTop: 2 }} />
              <View className="flex-1">
                <Text className="text-gray-900 text-sm font-semibold mb-1">Event Date & Time</Text>
                <Text className="text-gray-700 text-sm mb-0.5">
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
              <View className="flex-row mb-5 items-start">
                <MaterialIcons name="location-on" size={20} color="#6B7280" style={{ marginRight: 12, marginTop: 2 }} />
                <View className="flex-1">
                  <Text className="text-gray-900 text-sm font-semibold mb-1">Location</Text>
                  <Text className="text-gray-700 text-sm mb-0.5">{event.location}</Text>
                </View>
              </View>
            ) : null}

            {/* Event Description */}
            {event.description ? (
              <View className="mb-5">
                <Text className="text-gray-900 text-sm font-semibold mb-1">Description</Text>
                <Text className="text-gray-700 text-sm leading-6">{event.description}</Text>
              </View>
            ) : null}

            {/* Gender (optional) */}
            {event.gender ? (
              <View className="flex-row mb-5 items-start">
                <MaterialIcons name="person-outline" size={20} color="#6B7280" style={{ marginRight: 12, marginTop: 2 }} />
                <View className="flex-1">
                  <Text className="text-gray-900 text-sm font-semibold mb-1">Gender</Text>
                  <Text className="text-gray-700 text-sm mb-0.5 capitalize">{event.gender}</Text>
                </View>
              </View>
            ) : null}

            {/* Price */}
            <View className="flex-row mb-5 items-start">
              <MaterialIcons name="confirmation-number" size={20} color="#6B7280" style={{ marginRight: 12, marginTop: 2 }} />
              <View className="flex-1">
                <Text className="text-gray-900 text-sm font-semibold mb-1">Ticket Price</Text>
                <Text className="text-gray-700 text-sm mb-0.5">
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
            <View className="flex-row mb-5 items-start">
              <MaterialIcons name="confirmation-number" size={20} color="#6B7280" style={{ marginRight: 12, marginTop: 2 }} />
              <View className="flex-1">
                <Text className="text-gray-900 text-sm font-semibold mb-1">Total Tickets</Text>
                <Text className="text-gray-700 text-sm mb-0.5">
                  {tickets.length} ticket{tickets.length !== 1 ? 's' : ''} sold
                </Text>
              </View>
            </View>
          </View>

          {/* Tabs Section */}
          <View className="px-5 pt-5 pb-4 bg-white">
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8 }}
            >
              {tabs.map((tab) => {
                const count = getStatusCount(tab.key);
                const isActive = activeTab === tab.key;
                return (
                  <TouchableOpacity
                    key={tab.key}
                    className={`py-2.5 px-4 rounded-xl flex-row items-center gap-2 ${isActive ? 'bg-primary' : 'bg-gray-100'
                      }`}
                    onPress={() => setActiveTab(tab.key)}
                  >
                    <Text className={`text-xs font-semibold ${isActive ? 'text-white' : 'text-gray-600'}`}>
                      {tab.label}
                    </Text>
                    <View className={`px-2 py-0.5 rounded-full ${isActive ? 'bg-white/20' : 'bg-[#374151]'}`}>
                      <Text className={`text-[10px] font-bold ${isActive ? 'text-white' : 'text-gray-600'}`}>
                        {count}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>

        {/* Update Ticket Status Section */}
        <View className="px-5 mt-4 mb-2">
          <TouchableOpacity
            className="bg-primary py-4 px-5 rounded-xl flex-row items-center justify-center"
            onPress={() => setUpdateModalOpen(true)}
          >
            <MaterialIcons name="edit" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
            <Text className="text-white text-base font-semibold">Update Ticket Status by Ticket #</Text>
          </TouchableOpacity>
        </View>

        {/* Tickets List */}
        <View className="px-5 mt-2">
          {loadingTickets ? (
            <View className="py-10 items-center">
              <ActivityIndicator size="large" color="#DC2626" />
              <Text className="text-gray-700 text-sm mt-4">Loading tickets...</Text>
            </View>
          ) : filteredTickets.length === 0 ? (
            <View className="py-10 items-center">
              <MaterialIcons name="confirmation-number" size={48} color="#6B7280" />
              <Text className="text-[#6B7280] text-sm mt-4">
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
                    className={`${statusInfo.bgColor} ${statusInfo.borderColor} rounded-xl p-4 mb-3 border-2`}
                  >
                    <View className="flex-row items-start justify-between mb-3">
                      <View className="flex-row items-center flex-1">
                        <MaterialIcons
                          name={statusInfo.icon as any}
                          size={20}
                          color={statusInfo.iconColor}
                          style={{ marginRight: 8 }}
                        />
                        <Text className="text-gray-900 text-sm font-bold flex-1">
                          {displayName}
                        </Text>
                      </View>
                      <View className={`${statusInfo.badgeColor} px-3 py-1 rounded-full`}>
                        <Text className="text-white text-[10px] font-bold uppercase">
                          {statusInfo.label}
                        </Text>
                      </View>
                    </View>

                    {/* Ticket Details */}
                    <View>
                      {ticket.accessKey && (
                        <View className="flex-row items-center mb-2">
                          <MaterialIcons name="confirmation-number" size={14} color="#9CA3AF" style={{ marginRight: 8 }} />
                          <Text className="text-gray-700 text-[10px] font-mono flex-1" numberOfLines={1}>
                            {ticket.accessKey}
                          </Text>
                        </View>
                      )}
                      <View className="flex-row items-center mb-2">
                        <MaterialIcons name="email" size={14} color="#6B7280" style={{ marginRight: 8 }} />
                        <Text className="text-gray-700 text-xs flex-1" numberOfLines={1}>
                          {displayEmail}
                        </Text>
                      </View>
                      <View className="flex-row items-center mb-2">
                        <MaterialIcons name="phone" size={14} color="#6B7280" style={{ marginRight: 8 }} />
                        <Text className="text-gray-700 text-xs">
                          {displayPhone}
                        </Text>
                      </View>
                      {ticket.createdAt && (
                        <View className="flex-row items-center">
                          <MaterialIcons name="calendar-today" size={14} color="#9CA3AF" style={{ marginRight: 8 }} />
                          <Text className="text-gray-600 text-[10px]">
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
                        <View className="flex-row items-center mt-2">
                          <MaterialIcons name="person" size={14} color="#9CA3AF" style={{ marginRight: 8 }} />
                          <Text className="text-gray-600 text-[10px]">
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
          className="flex-1 bg-black/70 justify-center items-center p-5"
          onPress={() => {
            setUpdateModalOpen(false);
            setTicketNumber('');
            setSelectedStatus(null);
            setUpdateError(null);
          }}
        >
          <Pressable
            className="bg-[#1F1F1F] rounded-2xl p-6 w-full max-w-[400px]"
            onPress={(e) => e.stopPropagation()}
          >
            <Text className="text-white text-xl font-bold mb-3 text-center">Update Ticket Status</Text>
            <Text className="text-[#D1D5DB] text-sm mb-4">
              Enter the ticket number (Ticket #) to update its status. Only tickets with &quot;Submitted&quot; status can be updated.
            </Text>

            {/* Error Message */}
            {updateError && (
              <View className="bg-[#EF4444]/20 border border-[#EF4444]/50 rounded-xl p-3 mb-4">
                <View className="flex-row items-center">
                  <MaterialIcons name="error-outline" size={20} color="#EF4444" style={{ marginRight: 8 }} />
                  <Text className="text-[#EF4444] text-sm flex-1">{updateError}</Text>
                </View>
              </View>
            )}

            {/* Ticket Number Input */}
            <View className="mb-4">
              <View className="flex-row items-center justify-between mb-2">
                <Text className="text-white text-sm font-semibold">Ticket Number</Text>
                <TouchableOpacity
                  className="bg-primary py-1.5 px-3 rounded-lg flex-row items-center"
                  onPress={() => {
                    setQrScannerOpen(true);
                  }}
                >
                  <MaterialIcons name="qr-code-scanner" size={16} color="#FFFFFF" style={{ marginRight: 4 }} />
                  <Text className="text-white text-xs font-semibold">Scan QR</Text>
                </TouchableOpacity>
              </View>
              <TextInput
                className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900"
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
            <View className="mb-6">
              <Text className="text-white text-sm font-semibold mb-2">New Status</Text>
              <View className="flex-row gap-3">
                <TouchableOpacity
                  className={`flex-1 py-3 px-4 rounded-xl border-2 ${
                    selectedStatus === 'used'
                      ? 'bg-[#10B981]/20 border-[#10B981]'
                      : 'bg-[#0F0F0F] border-[#374151]'
                  }`}
                  onPress={() => setSelectedStatus('used')}
                >
                  <View className="flex-row items-center justify-center">
                    <MaterialIcons
                      name="check-circle"
                      size={20}
                      color={selectedStatus === 'used' ? '#10B981' : '#9CA3AF'}
                      style={{ marginRight: 6 }}
                    />
                    <Text
                      className={`text-sm font-semibold ${
                        selectedStatus === 'used' ? 'text-[#10B981]' : 'text-[#9CA3AF]'
                      }`}
                    >
                      Used
                    </Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  className={`flex-1 py-3 px-4 rounded-xl border-2 ${
                    selectedStatus === 'cancelled'
                      ? 'bg-[#EF4444]/20 border-[#EF4444]'
                      : 'bg-[#0F0F0F] border-[#374151]'
                  }`}
                  onPress={() => setSelectedStatus('cancelled')}
                >
                  <View className="flex-row items-center justify-center">
                    <MaterialIcons
                      name="cancel"
                      size={20}
                      color={selectedStatus === 'cancelled' ? '#EF4444' : '#9CA3AF'}
                      style={{ marginRight: 6 }}
                    />
                    <Text
                      className={`text-sm font-semibold ${
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
            <View className="flex-row gap-3">
              <TouchableOpacity
                className="flex-1 bg-[#374151] py-3 px-4 rounded-xl"
                onPress={() => {
                  setUpdateModalOpen(false);
                  setTicketNumber('');
                  setSelectedStatus(null);
                  setUpdateError(null);
                }}
                disabled={updatingStatus}
              >
                <Text className="text-white text-center font-semibold">Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                className="flex-1 bg-primary py-3 px-4 rounded-xl flex-row items-center justify-center"
                onPress={handleUpdateTicketStatus}
                disabled={updatingStatus || !ticketNumber.trim() || !selectedStatus}
              >
                {updatingStatus ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <MaterialIcons name="save" size={20} color="#FFFFFF" style={{ marginRight: 6 }} />
                    <Text className="text-white text-center font-semibold">Update</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </Pressable>
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

