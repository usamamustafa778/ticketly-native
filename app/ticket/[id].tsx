import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppStore } from '@/store/useAppStore';
import { ticketsAPI, type Ticket } from '@/lib/api/tickets';
import { paymentsAPI } from '@/lib/api/payments';
import * as ImagePicker from 'expo-image-picker';
import { captureRef } from 'react-native-view-shot';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import { BackButton } from '@/components/BackButton';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { API_BASE_URL } from '@/lib/config';
import { CACHE_KEYS, getCached, setCached } from '@/lib/cache';
import * as Linking from 'expo-linking';
import { getEventImageUrl } from '@/lib/utils/imageUtils';
import { TicketPreview } from '@/components/TicketPreview';

export default function TicketScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useAppStore((state) => state.user);

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Payment upload states
  const [screenshotUri, setScreenshotUri] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<string>('bank_transfer');
  const [uploadingPayment, setUploadingPayment] = useState(false);

  // QR code loading states
  const [qrImageLoaded, setQrImageLoaded] = useState(false);
  const [qrImageError, setQrImageError] = useState(false);

  // Ticket card ref for capture (download / share)
  const ticketCardRef = useRef<View>(null);
  const [downloadingTicket, setDownloadingTicket] = useState(false);
  const [sharingTicket, setSharingTicket] = useState(false);

  // Helper function to get full payment screenshot URL (same logic as profile image)
  const getPaymentScreenshotUrl = () => {
    // If user has selected a new screenshot (local URI), use it
    if (screenshotUri && (screenshotUri.startsWith('file://') || screenshotUri.startsWith('content://'))) {
      return screenshotUri;
    }

    // Otherwise, use the payment screenshot URL from ticket
    if (!ticket?.paymentScreenshotUrl) return null;

    const paymentScreenshotUrl = ticket.paymentScreenshotUrl;

    // If backend returned a localhost URL (old data), rewrite it to use the current API base URL
    if (
      paymentScreenshotUrl.includes('localhost') ||
      paymentScreenshotUrl.includes('127.0.0.1')
    ) {
      // Strip `/api` from API_BASE_URL and keep only the path part from the original URL
      const baseUrl = API_BASE_URL.replace('/api', '');
      try {
        const url = new URL(paymentScreenshotUrl);
        const path = url.pathname || '';
        return `${baseUrl}${path}`;
      } catch {
        // Fallback: if URL parsing fails, try to find `/uploads` in the string
        const uploadsIndex = paymentScreenshotUrl.indexOf('/uploads');
        if (uploadsIndex !== -1) {
          const path = paymentScreenshotUrl.substring(uploadsIndex);
          return `${baseUrl}${path}`;
        }
      }
    }

    // If it's already a full URL, return it as is
    if (paymentScreenshotUrl.startsWith('http')) {
      return paymentScreenshotUrl;
    }

    // Otherwise, construct from relative path and API_BASE_URL
    const baseUrl = API_BASE_URL.replace('/api', '');
    return `${baseUrl}${paymentScreenshotUrl}`;
  };

  // Helper for full QR code URL (for confirmed tickets)
  const getQrCodeUrl = () => {
    if (!ticket?.qrCodeUrl) return null;
    const qr = ticket.qrCodeUrl;
    if (qr.startsWith('http')) return qr;
    const baseUrl = API_BASE_URL.replace('/api', '');
    return `${baseUrl}${qr.startsWith('/') ? qr : `/${qr}`}`;
  };

  useEffect(() => {
    const fetchTicket = async () => {
      if (!id) {
        setError('Ticket ID is required');
        setLoading(false);
        return;
      }

      // Show cached ticket immediately so UI is visible in background while fetching
      const cached = await getCached<Ticket>(CACHE_KEYS.TICKET_BY_ID(id));
      if (cached) {
        setTicket(cached);
        setError(null);
      }

      try {
        setLoading(true);
        if (!cached) setError(null);
        const response = await ticketsAPI.getTicketById(id);

        if (response.success && response.ticket) {
          console.log('📋 Ticket data received:', {
            hasEvent: !!response.ticket.event,
            hasCreatedBy: !!response.ticket.event?.createdBy,
            createdByPhone: response.ticket.event?.createdBy?.phone,
            eventPhone: response.ticket.event?.phone,
            organizerPhone: response.ticket.organizer?.phone,
            paymentScreenshotUrl: response.ticket.paymentScreenshotUrl,
          });
          setTicket(response.ticket);
          await setCached(CACHE_KEYS.TICKET_BY_ID(id), response.ticket);
        } else {
          if (!cached) setError('Ticket not found');
        }
      } catch (err: any) {
        console.error('Error fetching ticket:', err);
        const errorMessage = err.response?.data?.message || err.message || 'Failed to load ticket';
        if (!cached) setError(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    fetchTicket();
  }, [id]);

  // Refresh ticket after payment submission or pull-to-refresh
  const refreshTicket = async () => {
    if (!id) return;
    try {
      const response = await ticketsAPI.getTicketById(id);
      if (response.success && response.ticket) {
        setTicket(response.ticket);
        await setCached(CACHE_KEYS.TICKET_BY_ID(id), response.ticket);
      }
    } catch (err) {
      console.error('Error refreshing ticket:', err);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshTicket();
    setRefreshing(false);
  };

  // Pick payment screenshot from gallery
  const pickScreenshot = async () => {
    try {
      // Request permission
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'We need access to your photos to upload payment screenshots.'
        );
        return;
      }

      // Launch image picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        // Use 3:4 aspect ratio for payment screenshots (taller images)
        aspect: [3, 4],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        setScreenshotUri(asset.uri);
        console.log('💳 Screenshot selected:', {
          uri: asset.uri.substring(0, 50) + '...',
          type: asset.type,
          width: asset.width,
          height: asset.height,
        });
      }
    } catch (error: any) {
      console.error('Error picking screenshot:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };

  // Submit payment with screenshot
  const handleSubmitPayment = async () => {
    // Minimal log for debugging
    console.log('🔵 Submit payment:', {
      ticketId: ticket?.id,
      hasScreenshot: !!screenshotUri,
    });

    if (!ticket) {
      console.error('❌ No ticket available');
      Alert.alert('Error', 'Ticket information not available.');
      return;
    }

    if (!screenshotUri) {
      console.error('❌ No screenshot selected');
      Alert.alert('Screenshot Required', 'Please select a payment screenshot to upload.');
      return;
    }

    try {
      setUploadingPayment(true);

      // Amount is derived from ticket.event.ticketPrice on backend (source of truth)
      const response = await paymentsAPI.submitPayment(
        ticket.id,
        paymentMethod,
        screenshotUri
      );

      if (response.success) {
        console.log('✅ Payment submitted successfully:', response);

        // Clear screenshot selection
        setScreenshotUri(null);

        // Refresh ticket to get updated status
        await refreshTicket();

        Alert.alert(
          'Screenshot Updated',
          'Your payment screenshot has been updated successfully. Your ticket is in review and our team will verify it within 24-48 hours.',
          [
            {
              text: 'OK',
              onPress: () => {
                // Optionally navigate back or stay on screen
              },
            },
          ]
        );
      } else {
        throw new Error(response.message || 'Payment submission failed');
      }
    } catch (error: any) {
      console.error('❌ Payment submission error:', error);
      const errorMessage =
        error.message ||
        error.response?.data?.message ||
        'Failed to submit payment. Please try again.';
      Alert.alert('Payment Submission Failed', errorMessage);
    } finally {
      setUploadingPayment(false);
    }
  };

  // Small helper: wait one frame so layout/gradients/QR are fully committed before snapshotting
  const waitForNextFrame = () =>
    new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

  // Capture ticket card as image and save to device gallery
  const handleDownloadTicket = async () => {
    if (Platform.OS === 'web') {
      Alert.alert('Not available', 'Saving to gallery is not available on web. Use the app on your phone to download the ticket.');
      return;
    }
    const view = ticketCardRef.current;
    if (!view) return;
    setDownloadingTicket(true);
    let capturedUri: string | null = null;
    try {
      // In Android release, waiting one frame avoids "Failed to snapshot view tag" errors
      await waitForNextFrame();

      capturedUri = await captureRef(view, {
        format: 'jpg',
        quality: 0.95,
        result: 'tmpfile',
        width: 800,
      });

      const { status } =
        Platform.OS === 'android'
          ? await MediaLibrary.requestPermissionsAsync(false, ['photo'])
          : await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission needed',
          'Allow access to save the ticket image to your photo library.',
          [{ text: 'OK' }]
        );
        return;
      }
      await MediaLibrary.saveToLibraryAsync(capturedUri);
      Alert.alert('Saved', 'Ticket saved to your photo library.');
    } catch (err: any) {
      const msg = err?.message ?? '';
      const isExpoGoOrRestricted =
        msg.includes('Expo Go') ||
        msg.includes('expo-media-library') ||
        msg.includes('media library') ||
        msg.includes('development build');

      // When saveToLibraryAsync fails (e.g. Expo Go), open share sheet so user can save via "Save image" / "Save to Photos"
      if (capturedUri && (isExpoGoOrRestricted || msg.includes('requestPermissionsAsync'))) {
        try {
          const isAvailable = await Sharing.isAvailableAsync();
          if (isAvailable) {
            const eventTitle = ticket?.event?.title || 'My ticket';
            await Sharing.shareAsync(capturedUri, {
              mimeType: 'image/jpeg',
              dialogTitle: `${eventTitle} – Save ticket `,
            });
            return;
          }
        } catch (e) {
          console.error('Download fallback share error:', e);
        }
      }
      console.error('Download ticket error:', err);
      Alert.alert('Error', err?.message || 'Could not save ticket to gallery.');
    } finally {
      setDownloadingTicket(false);
    }
  };

  // Capture ticket as image and share via system share sheet (shares image file, not text)
  const handleShareTicket = async () => {
    if (Platform.OS === 'web') {
      Alert.alert('Not available', 'Sharing is not available on web. Use the app on your phone to share the ticket.');
      return;
    }
    const view = ticketCardRef.current;
    if (!view) return;
    try {
      setSharingTicket(true);
      // Ensure layout is stable before capturing
      await waitForNextFrame();
      const uri = await captureRef(view, {
        format: 'jpg',
        quality: 0.95,
        result: 'tmpfile',
        width: 800,
      });
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        Alert.alert('Not available', 'Sharing is not available on this device.');
        return;
      }
      const eventTitle = ticket?.event?.title || 'My ticket';
      await Sharing.shareAsync(uri, {
        mimeType: 'image/jpeg',
        dialogTitle: `${eventTitle} – Share ticket`,
      });
    } catch (err: any) {
      if (err?.message && !err.message.includes('User did not share') && !err.message.includes('cancel')) {
        console.error('Share ticket error:', err);
        Alert.alert('Error', err?.message || 'Could not share ticket.');
      }
    } finally {
      setSharingTicket(false);
    }
  };

  // Show full-screen loader only when loading and no cached ticket to display in background
  if (loading && !ticket) {
    return (
      <View className="flex-1 bg-white">
        <View className="flex-1 items-center justify-center p-10">
          <ActivityIndicator size="large" color="#DC2626" />
          <Text className="text-gray-700 text-base mt-4">Loading ticket...</Text>
        </View>
      </View>
    );
  }

  if (error || !ticket) {
    return (
      <View className="flex-1 bg-white">
        <View className="flex-1 items-center justify-center p-10">
          <Text className="text-[#EF4444] text-lg mb-6">{error || 'Ticket not found'}</Text>
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

  if (!user) {
    return (
      <View className="flex-1 bg-white">
        <View className="flex-1 items-center justify-center p-10">
          <Text className="text-[#EF4444] text-lg mb-6">Please login to view your ticket</Text>
          <TouchableOpacity
            className="bg-primary py-3 px-6 rounded-xl"
            onPress={() => router.push('/login')}
          >
            <Text className="text-white text-base font-semibold">Login</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Determine if this ticket is for a free event
  const isFreeEvent =
    (ticket as any)?.event?.price?.price === 'free' ||
    (ticket as any)?.event?.price?.currency === null ||
    !ticket.event?.ticketPrice ||
    ticket.event.ticketPrice <= 0;

  // For free events, treat pending states as confirmed on the client so QR + access key are visible
  const effectiveStatus =
    isFreeEvent &&
    (ticket.status === 'pending_payment' || ticket.status === 'payment_in_review')
      ? 'confirmed'
      : ticket.status;

  return (
    <View className="flex-1 bg-white">
      {/* Fixed header - back button stays on top when scrolling */}
      <View
        style={{
          paddingTop: insets.top + 8,
          paddingBottom: 16,
          paddingHorizontal: 12,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: '#FFFFFF',
        }}
      >
        <BackButton onPress={() => router.back()} />
        <Text className="text-gray-900 text-xl font-bold">Your Ticket</Text>
        <View className="w-[40px]" />
      </View>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 40 }}
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
      {/* Ticket Card - uses event ticket theme (ref for capture) */}
      <View ref={ticketCardRef} className="mx-[20px] mb-3" collapsable={false}>
        <TicketPreview
          theme={ticket.event?.ticketTheme}
          event={ticket.event}
          preview={false}
          username={ticket.username}
          email={ticket.email}
          status={effectiveStatus}
          accessKey={ticket.accessKey}
          createdAt={ticket.createdAt}
        />
      </View>

      {/* Payment section - separate card below ticket */}
      {!isFreeEvent && (ticket.status === 'payment_in_review' || ticket.status === 'pending_payment') && (
        <View className="mx-3 mt-4 mb-6 bg-white rounded-2xl p-5 border border-gray-200">
        {ticket.status === 'payment_in_review' && (
          <View>
            <View className="items-center mb-4">
              <Text className="text-gray-900 text-base font-semibold mb-2">
                In Review
              </Text>
              <Text className="text-gray-900 text-sm text-start mb-1">
                Your payment screenshot has been submitted successfully.
              </Text>
              <Text className="text-gray-900 text-sm text-start mb-1">
                Our team will verify your payment within 24-48 hours.
              </Text>
              <Text className="text-gray-900 text-sm text-start">
                You can update the screenshot until verification is complete.
              </Text>
            </View>

            {/* Payment Method Selection */}
            <View className="mb-4">
              <Text className="text-gray-900 text-xs mb-2">Payment Method</Text>
              <View className="flex-row gap-2">
                {['bank_transfer', 'easypaisa', 'jazzcash', 'other'].map((method) => (
                  <TouchableOpacity
                    key={method}
                    onPress={() => setPaymentMethod(method)}
                    className={`px-3 py-2 rounded-lg border ${paymentMethod === method
                      ? 'bg-primary border-primary'
                      : 'bg-gray-100 border-gray-200'
                      }`}
                  >
                    <Text
                      className={`text-xs font-semibold ${paymentMethod === method ? 'text-white' : 'text-[#9CA3AF]'
                        }`}
                    >
                      {method === 'bank_transfer'
                        ? 'Bank'
                        : method === 'easypaisa'
                          ? 'EasyPaisa'
                          : method === 'jazzcash'
                            ? 'JazzCash'
                            : 'Other'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              {/* Event Creator Phone Number */}
              {(() => {
                const phoneNumber = ticket.event?.createdBy?.phone || ticket.event?.phone || ticket.organizer?.phone;
                return phoneNumber ? (
                  <View className="mt-3">
                    <Text className="text-gray-900 text-xs mb-1">
                      Send payment to: {phoneNumber}
                    </Text>
                  </View>
                ) : null;
              })()}
            </View>

            {/* Screenshot Display/Update */}
            <View className="mb-4">
              <Text className="text-gray-900 text-xs mb-2">Payment Screenshot</Text>
              {getPaymentScreenshotUrl() ? (
                <View className="relative">
                  <Image
                    source={{ uri: getPaymentScreenshotUrl()! }}
                    className="w-full h-[200px] rounded-xl"
                    resizeMode="cover"
                  />
                  <TouchableOpacity
                    onPress={() => setScreenshotUri(null)}
                    className="absolute top-2 right-2 bg-[#EF4444] p-2 rounded-full"
                  >
                    <MaterialIcons name="close" size={20} color="#FFFFFF" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={pickScreenshot}
                    className="absolute bottom-2 right-2 bg-primary px-3 py-1.5 rounded-lg flex-row items-center"
                  >
                    <MaterialIcons name="edit" size={16} color="#FFFFFF" />
                    <Text className="text-white text-xs font-semibold ml-1">Update</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  onPress={pickScreenshot}
                  className="border-2 border-dashed border-[#374151] rounded-xl p-8 items-center justify-center bg-[#0F0F0F]"
                >
                  <MaterialIcons name="add-photo-alternate" size={48} color="#9CA3AF" />
                  <Text className="text-[#9CA3AF] text-sm mt-2 text-center">
                    Tap to select payment screenshot
                  </Text>
                  <Text className="text-[#6B7280] text-xs mt-1 text-center">
                    JPEG, PNG, GIF, or WebP (Max 5MB)
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Update Button */}
            <TouchableOpacity
              onPress={() => {
                if (!screenshotUri) {
                  Alert.alert('Screenshot Required', 'Please select a payment screenshot first.');
                  return;
                }
                if (uploadingPayment) {
                  return;
                }
                handleSubmitPayment();
              }}
              disabled={uploadingPayment || !screenshotUri}
              activeOpacity={0.7}
              style={{
                opacity: !screenshotUri || uploadingPayment ? 0.5 : 1,
              }}
              className={`py-4 rounded-xl items-center ${!screenshotUri || uploadingPayment
                ? 'bg-[#374151]'
                : 'bg-primary'
                }`}
            >
              {uploadingPayment ? (
                <View className="flex-row items-center">
                  <ActivityIndicator size="small" color="#FFFFFF" />
                  <Text className="text-white text-base font-semibold ml-2">
                    Updating...
                  </Text>
                </View>
              ) : (
                <Text className="text-white text-base font-semibold">
                  Update Screenshot
                </Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {ticket.status === 'pending_payment' && (
          <View>
            <Text className="text-[#F59E0B] text-base font-semibold mb-2 text-center">
              Payment Pending
            </Text>
            <Text className="text-gay-900 text-sm text-center mb-4">
              Please upload a screenshot of your payment to confirm your ticket.
            </Text>

            {/* Payment Method Selection */}
            <View className="mb-4">
              <Text className="text-gray-900 text-xs mb-2">Payment Method</Text>
              <View className="flex-row gap-2">
                {['bank_transfer', 'easypaisa', 'jazzcash', 'other'].map((method) => (
                  <TouchableOpacity
                    activeOpacity={1}
                    key={method}
                    onPress={() => setPaymentMethod(method)}
                    className={`px-3 py-2 rounded-lg border ${paymentMethod === method
                      ? 'bg-primary border-primary'
                      : 'bg-gray-100 border-gray-200'
                      }`}
                  >
                    <Text
                      className={`text-xs font-semibold ${paymentMethod === method ? 'text-white' : 'text-[#9CA3AF]'
                        }`}
                    >
                      {method === 'bank_transfer'
                        ? 'Bank'
                        : method === 'easypaisa'
                          ? 'EasyPaisa'
                          : method === 'jazzcash'
                            ? 'JazzCash'
                            : 'Other'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              {/* Event Creator Phone Number */}
              {(() => {
                const phoneNumber = ticket.event?.createdBy?.phone || ticket.event?.phone || ticket.organizer?.phone;
                return phoneNumber ? (
                  <View className="mt-3">
                    <Text className="text-gray-900 text-xs mb-1">
                      Send payment to: {phoneNumber}
                    </Text>
                  </View>
                ) : null;
              })()}
            </View>

            {/* Screenshot Selection */}
            <View className="mb-4">
              <Text className="text-gray-900 text-xs mb-2">Payment Screenshot</Text>
              {screenshotUri ? (
                <View className="relative">
                  <Image
                    source={{ uri: screenshotUri }}
                    className="w-full h-[200px] rounded-xl"
                    resizeMode="cover"
                  />
                  <TouchableOpacity
                    onPress={() => setScreenshotUri(null)}
                    className="absolute top-2 right-2 bg-[#EF4444] p-2 rounded-full"
                  >
                    <MaterialIcons name="close" size={20} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  onPress={pickScreenshot}
                  className="border-2 border-dashed border-[#374151] rounded-xl p-8 items-center justify-center bg-[#0F0F0F]"
                >
                  <MaterialIcons name="add-photo-alternate" size={48} color="#E5E7EB" />
                  <Text className="text-gray-200 text-sm mt-2 text-center">
                    Tap to select payment screenshot
                  </Text>
                  <View className="mt-2 w-full items-start px-4">
                    <Text className="text-gray-300 text-xs">• JPEG, PNG, GIF, or WebP</Text>
                    <Text className="text-gray-300 text-xs">• Max 5MB</Text>
                  </View>
                </TouchableOpacity>
              )}
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              onPress={() => {
                console.log('🔵 TouchableOpacity onPress triggered');
                console.log('🔵 Button state check:', {
                  hasScreenshot: !!screenshotUri,
                  isUploading: uploadingPayment,
                  disabled: !screenshotUri || uploadingPayment,
                });
                if (!screenshotUri) {
                  Alert.alert('Screenshot Required', 'Please select a payment screenshot first.');
                  return;
                }
                if (uploadingPayment) {
                  console.log('⚠️ Already uploading, ignoring click');
                  return;
                }
                handleSubmitPayment();
              }}
              disabled={uploadingPayment}
              activeOpacity={0.7}
              style={{
                opacity: !screenshotUri || uploadingPayment ? 0.5 : 1,
              }}
              className={`py-4 rounded-xl items-center ${!screenshotUri || uploadingPayment
                ? 'bg-[#374151]'
                : 'bg-primary'
                }`}
            >
              {uploadingPayment ? (
                <View className="flex-row items-center">
                  <ActivityIndicator size="small" color="#FFFFFF" />
                  <Text className="text-white text-base font-semibold ml-2">
                    Submitting...
                  </Text>
                </View>
              ) : (
                <Text className="text-white text-base font-semibold">
                  Submit Payment
                </Text>
              )}
            </TouchableOpacity>
          </View>
        )}
        </View>
      )}

      {/* Ticket Footer */}
      <View className="mx-3 mb-6 p-5 rounded-2xl bg-gray-100 border border-gray-200">
        <Text className="text-gray-700 text-xs text-center mb-1">
          This ticket is valid for one person only
        </Text>
        <Text className="text-gray-700 text-xs text-center mb-1">
          For support, contact: support@ticketly.com
        </Text>
      </View>

      {/* Actions */}
      {effectiveStatus === 'confirmed' && (
        <View className="flex-row gap-3 px-3">
          <TouchableOpacity
            className="flex-1 bg-primary py-4 rounded-xl items-center"
            onPress={handleDownloadTicket}
            disabled={downloadingTicket}
          >
            {downloadingTicket ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text className="text-white text-base font-semibold">Download Ticket</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            className="flex-1 bg-gray-100 border border-gray-200 py-4 rounded-xl items-center"
            onPress={handleShareTicket}
            disabled={sharingTicket}
          >
            {sharingTicket ? (
              <ActivityIndicator size="small" color="#6B7280" />
            ) : (
              <Text className="text-gray-900 text-base font-semibold">Share</Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
    </View>
  );
}

