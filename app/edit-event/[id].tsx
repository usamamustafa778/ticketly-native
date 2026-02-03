import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  Image,
  ActivityIndicator,
  Pressable,
  Modal as RNModal,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAppStore } from '@/store/useAppStore';
import { formatApiError } from '@/lib/utils/errorUtils';
import { authAPI } from '@/lib/api/auth';
import { eventsAPI, type Event } from '@/lib/api/events';
import { Modal } from '@/components/Modal';
import { BackButton } from '@/components/BackButton';
import { EventDetailsSkeleton } from '@/components/EventDetailsSkeleton';
import { ButtonPrimary } from '@/components/ui/ButtonPrimary';
import { DataInput } from '@/components/ui/DataInput';
import { DataSelection } from '@/components/ui/DataSelection';
import DateTimePicker from '@react-native-community/datetimepicker';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as ImagePicker from 'expo-image-picker';
import { getEventImageUrl } from '@/lib/utils/imageUtils';

interface EventFormData {
  eventName: string;
  eventDate: Date | null;
  eventTime: string;
  address: string;
  genderSelection: string;
  description: string;
  imageUri: string | null;
  imageUrl: string | null;
  imagePath: string | null;
  eventType: 'paid' | 'free';
  ticketPrice: string;
  totalTickets: string;
  currency: string;
}

const GENDER_OPTIONS = ['All', 'Male', 'Female'] as const;
const CURRENCY_OPTIONS = [{ code: 'PKR', label: 'Pakistani Rupee (PKR)', flag: '🇵🇰' }] as const;

function genderToApi(v: string): 'all' | 'male' | 'female' {
  const lower = v.toLowerCase();
  if (lower === 'male' || lower === 'female' || lower === 'all') return lower;
  return 'all';
}

function formatTime(date: Date): string {
  return date.toTimeString().slice(0, 5);
}

function formatDateForDisplay(date: Date): string {
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function toImagePath(urlOrPath: string): string | null {
  if (!urlOrPath) return null;
  if (urlOrPath.startsWith('/')) return urlOrPath;
  try {
    return new URL(urlOrPath).pathname || null;
  } catch {
    const i = urlOrPath.indexOf('/uploads');
    return i !== -1 ? urlOrPath.substring(i) : urlOrPath;
  }
}

export default function EditEventScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useAppStore((state) => state.user);
  const setUser = useAppStore((state) => state.setUser);
  const [step, setStep] = useState<1 | 2>(1);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [event, setEvent] = useState<Event | null>(null);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [errors, setErrors] = useState<Partial<Record<keyof EventFormData, string>>>({});

  const [formData, setFormData] = useState<EventFormData>({
    eventName: '',
    eventDate: null,
    eventTime: '18:00',
    address: '',
    genderSelection: 'All',
    description: '',
    imageUri: null,
    imageUrl: null,
    imagePath: null,
    eventType: 'free',
    ticketPrice: '',
    totalTickets: '100',
    currency: 'PKR',
  });

  const eventId = Array.isArray(id) ? id[0] : id;

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => setKeyboardHeight(e.endCoordinates.height)
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardHeight(0)
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    const loadEvent = async () => {
      if (!eventId) {
        setErrorMessage('Event ID is required');
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const response = await eventsAPI.getEventById(String(eventId));
        if (response.success && response.event) {
          const e = response.event;
          setEvent(e);
          const price = e.price?.price;
          const isFree = price === 'free' || price === null || price === undefined;
          const ticketPriceNum = typeof price === 'number' ? price : e.ticketPrice ?? 0;
          const genderCap = e.gender ? e.gender.charAt(0).toUpperCase() + e.gender.slice(1) : 'All';
          const dateStr = e.date;
          const eventDate = dateStr ? new Date(dateStr) : null;
          const displayImageUrl = getEventImageUrl(e);
          const imagePath = e.imageUrl
            ? (e.imageUrl.startsWith('/') ? e.imageUrl : (() => {
                try { return new URL(e.imageUrl!).pathname; } catch {
                  const i = e.imageUrl!.indexOf('/uploads');
                  return i !== -1 ? e.imageUrl!.substring(i) : e.imageUrl!;
                }
              })())
            : e.image || null;
          setFormData({
            eventName: e.title || '',
            eventDate,
            eventTime: e.time || '18:00',
            address: e.location || '',
            genderSelection: genderCap,
            description: e.description || '',
            imageUri: displayImageUrl || null,
            imageUrl: displayImageUrl || null,
            imagePath,
            eventType: isFree ? 'free' : 'paid',
            ticketPrice: ticketPriceNum > 0 ? String(ticketPriceNum) : '',
            totalTickets: String(e.totalTickets ?? 100),
            currency: 'PKR',
          });
        } else {
          setErrorMessage('Event not found');
        }
      } catch (err: any) {
        setErrorMessage(formatApiError(err, 'Failed to load event'));
      } finally {
        setLoading(false);
      }
    };
    loadEvent();
  }, [eventId]);

  const handleInputChange = (field: keyof EventFormData, value: string | Date | null) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      setErrorMessage('We need access to your photos to upload event images.');
      setShowErrorModal(true);
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      const imageUri = result.assets[0].uri;
      setFormData((prev) => ({ ...prev, imageUri }));
      await uploadImage(imageUri);
    }
  };

  const uploadImage = async (imageUri: string) => {
    setUploadingImage(true);
    try {
      const response = await eventsAPI.uploadEventImage(imageUri);
      if (response.success) {
        const path = response.imageUrl ? toImagePath(response.imageUrl) : null;
        setFormData((prev) => ({
          ...prev,
          imagePath: path,
          imageUrl: response.imageUrl || null,
        }));
      } else {
        setFormData((prev) => ({ ...prev, imageUri: null, imageUrl: null, imagePath: null }));
      }
    } catch {
      setFormData((prev) => ({ ...prev, imageUri: null, imageUrl: null, imagePath: null }));
    } finally {
      setUploadingImage(false);
    }
  };

  const step1Valid =
    Boolean(formData.eventName.trim()) &&
    Boolean(formData.eventDate) &&
    Boolean(formData.eventTime?.trim()) &&
    Boolean(formData.genderSelection?.trim());

  const validateStep1 = (): boolean => {
    const nextErrors: Partial<Record<keyof EventFormData, string>> = {};
    if (!formData.eventName.trim()) nextErrors.eventName = 'Event name is required';
    if (!formData.eventDate) nextErrors.eventDate = 'Start date is required';
    if (!formData.eventTime?.trim()) nextErrors.eventTime = 'Start time is required';
    if (!formData.genderSelection?.trim()) nextErrors.genderSelection = 'Gender is required';
    setErrors((prev) => ({ ...prev, ...nextErrors }));
    return Object.keys(nextErrors).length === 0;
  };

  const step2Valid =
    formData.eventType === 'free' ||
    (formData.eventType === 'paid' &&
      formData.ticketPrice.trim() !== '' &&
      !Number.isNaN(Number(formData.ticketPrice)) &&
      Number(formData.ticketPrice) >= 0);

  const handleNext = () => {
    if (!validateStep1()) return;
    setStep(2);
  };

  const handleSubmit = async () => {
    if (formData.eventType === 'paid') {
      const parsed = Number(formData.ticketPrice);
      if (formData.ticketPrice.trim() === '' || Number.isNaN(parsed) || parsed < 0) {
        setErrors((prev) => ({ ...prev, ticketPrice: 'Cost per ticket is required' }));
        return;
      }
      const tickets = parseInt(formData.totalTickets, 10);
      if (Number.isNaN(tickets) || tickets < 1) {
        setErrors((prev) => ({ ...prev, totalTickets: 'Enter a valid number of tickets' }));
        return;
      }
    }
    setErrors({});

    if (!eventId) {
      setErrorMessage('Event ID is missing');
      setShowErrorModal(true);
      return;
    }

    setSaving(true);
    try {
      let imageToSend: string | undefined = formData.imagePath || undefined;
      if (formData.imageUri && !formData.imageUri.startsWith('http')) {
        if (!formData.imagePath) {
          setUploadingImage(true);
          try {
            const uploadResponse = await eventsAPI.uploadEventImage(formData.imageUri);
            if (uploadResponse.success) {
              const path = uploadResponse.imageUrl ? toImagePath(uploadResponse.imageUrl) : null;
              imageToSend = path || undefined;
            }
          } catch {
            imageToSend = undefined;
          } finally {
            setUploadingImage(false);
          }
        }
      } else if (!formData.imageUri && (event?.image || event?.imageUrl)) {
        imageToSend = '';
      }

      const eventDate = formData.eventDate!;
      const dateStr = eventDate.toISOString().split('T')[0];
      const [hours, minutes] = formData.eventTime.split(':');
      const timeStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;

      const totalTickets =
        formData.eventType === 'free' ? undefined : parseInt(formData.totalTickets, 10) || 100;

      const updateData: Parameters<typeof eventsAPI.updateEvent>[1] = {
        title: formData.eventName.trim(),
        date: dateStr,
        time: timeStr,
        location: formData.address.trim() || undefined,
        description: formData.description.trim() || undefined,
        totalTickets,
        ticketPrice: formData.eventType === 'free' ? 0 : Number(formData.ticketPrice),
        email: user?.email || '',
        phone: user?.phone || undefined,
      };
      if (imageToSend !== undefined) updateData.image = imageToSend;

      const response = await eventsAPI.updateEvent(String(eventId), updateData);

      if (response.success) {
        try {
          const profileResponse = await authAPI.getProfile();
          if (profileResponse.success && profileResponse.user) setUser(profileResponse.user);
        } catch {}
        router.back();
      } else {
        setErrorMessage(formatApiError(response, (response as any).message || 'Failed to update event'));
        setShowErrorModal(true);
      }
    } catch (err: any) {
      setErrorMessage(formatApiError(err, 'Failed to update event. Please try again.'));
      setShowErrorModal(true);
    } finally {
      setSaving(false);
    }
  };

  const timePickerValue = (() => {
    const [h, m] = formData.eventTime.split(':').map(Number);
    const d = formData.eventDate || new Date();
    const x = new Date(d);
    x.setHours(isNaN(h) ? 18 : h, isNaN(m) ? 0 : m, 0, 0);
    return x;
  })();

  const inputRow = 'bg-gray-50 rounded-md py-2 px-3 flex-row items-center gap-2 border border-gray-200';
  const iconWrap = 'w-8 h-8 rounded-full bg-gray-200 items-center justify-center';
  const labelClass = 'text-gray-900 text-sm font-medium mb-1.5';

  if (loading) {
    return <EventDetailsSkeleton />;
  }

  if (errorMessage && !event) {
    return (
      <View className="flex-1 bg-white items-center justify-center p-10">
        <Text className="text-[#EF4444] text-lg mb-6">{errorMessage}</Text>
        <ButtonPrimary onPress={() => router.back()}>
          Go Back
        </ButtonPrimary>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-white"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Header: back, progress bar, step label - same as create */}
      <View className="pt-[52px] px-4 pb-4 border-b border-gray-200">
        <View className="flex-row items-center justify-between mb-4">
          <BackButton onPress={() => (step === 1 ? router.back() : setStep(1))} className="-ml-2" />
          <View className="flex-1 flex-row items-center justify-center gap-2">
            <View className="flex-1 h-1.5 rounded-full bg-gray-200 overflow-hidden">
              <View
                className="h-full rounded-full bg-primary"
                style={{ width: step === 1 ? '50%' : '100%' }}
              />
            </View>
          </View>
          <Text className="text-gray-900 text-sm font-medium ml-2 w-10 text-right">{step} of 2</Text>
        </View>
        <Text className="text-gray-900 text-2xl font-bold">
          {step === 1 ? 'Event Details' : 'Payment and Ticket Details'}
        </Text>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingBottom: 40 + keyboardHeight,
          paddingHorizontal: 16,
          paddingTop: 24,
        }}
        showsVerticalScrollIndicator={false}
      >
        {step === 1 && (
          <>
            <TouchableOpacity
              onPress={pickImage}
              disabled={uploadingImage}
              className="w-full aspect-[16/9] rounded-2xl border-2 border-primary overflow-hidden bg-gray-50 mb-6"
            >
              {formData.imageUri ? (
                <View className="w-full h-full relative">
                  <Image
                    source={{ uri: formData.imageUri }}
                    className="w-full h-full"
                    resizeMode="cover"
                  />
                  <View className="absolute top-3 left-0 right-0 flex-row justify-between px-3">
                    <TouchableOpacity
                      onPress={(e) => { e.stopPropagation(); pickImage(); }}
                      className="w-10 h-10 rounded-full bg-black/50 items-center justify-center"
                    >
                      <MaterialIcons name="crop" size={20} color="#FFF" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={(e) => {
                        e.stopPropagation();
                        setFormData((prev) => ({ ...prev, imageUri: null, imageUrl: null, imagePath: null }));
                      }}
                      className="w-10 h-10 rounded-full bg-black/50 items-center justify-center"
                    >
                      <MaterialIcons name="close" size={20} color="#FFF" />
                    </TouchableOpacity>
                  </View>
                  {uploadingImage && (
                    <View className="absolute inset-0 bg-black/50 items-center justify-center">
                      <ActivityIndicator color="#DC2626" size="large" />
                    </View>
                  )}
                </View>
              ) : (
                <View className="flex-1 items-center justify-center">
                  <MaterialIcons name="add-photo-alternate" size={48} color="#DC2626" />
                  <Text className="text-[#9CA3AF] mt-2">Tap to add Thumbnail</Text>
                </View>
              )}
            </TouchableOpacity>

            <DataInput
              label="Event Name"
              placeholder="name"
              value={formData.eventName}
              onChangeText={(v) => handleInputChange('eventName', v)}
              error={errors.eventName}
              className="mb-3"
            />

            <View className="flex-row gap-2 mb-3">
              <View className="flex-1">
                <Text className={labelClass}>Start Date</Text>
                <TouchableOpacity
                  className={`${inputRow} ${errors.eventDate ? 'border-[#EF4444]' : ''}`}
                  onPress={() => setShowDatePicker(true)}
                >
                  <View className={iconWrap}>
                    <MaterialIcons name="event" size={18} color="#9CA3AF" />
                  </View>
                  <Text className={`text-sm ${formData.eventDate ? 'text-gray-900' : 'text-[#6B7280]'}`}>
                    {formData.eventDate ? formatDateForDisplay(formData.eventDate) : 'Select date'}
                  </Text>
                </TouchableOpacity>
                {errors.eventDate ? <Text className="text-[#EF4444] text-xs mt-1">{errors.eventDate}</Text> : null}
              </View>
              <View className="flex-1">
                <Text className={labelClass}>Time</Text>
                <TouchableOpacity
                  className={`${inputRow} ${errors.eventTime ? 'border-[#EF4444]' : ''}`}
                  onPress={() => setShowTimePicker(true)}
                >
                  <View className={iconWrap}>
                    <MaterialIcons name="schedule" size={18} color="#9CA3AF" />
                  </View>
                  <Text className="text-gray-900 text-sm">{formData.eventTime}</Text>
                </TouchableOpacity>
                {errors.eventTime ? <Text className="text-[#EF4444] text-xs mt-1">{errors.eventTime}</Text> : null}
              </View>
            </View>

            {showDatePicker && (
              <View className="mb-4">
                {Platform.OS === 'ios' && (
                  <View className="flex-row justify-end gap-2 mb-2">
                    <TouchableOpacity className="bg-gray-100 px-4 py-2 rounded-lg" onPress={() => setShowDatePicker(false)}>
                      <Text className="text-gray-900 text-sm">Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity className="bg-primary px-4 py-2 rounded-lg" onPress={() => setShowDatePicker(false)}>
                      <Text className="text-white text-sm font-semibold">Done</Text>
                    </TouchableOpacity>
                  </View>
                )}
                <DateTimePicker
                  value={formData.eventDate || new Date()}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  minimumDate={new Date()}
                  onChange={(event, selectedDate) => {
                    if (Platform.OS === 'android') {
                      setShowDatePicker(false);
                      if (event.type === 'set' && selectedDate) handleInputChange('eventDate', selectedDate);
                    } else if (selectedDate) handleInputChange('eventDate', selectedDate);
                  }}
                />
              </View>
            )}

            {showTimePicker && (
              <View className="mb-4">
                {Platform.OS === 'ios' && (
                  <View className="flex-row justify-end gap-2 mb-2">
                    <TouchableOpacity className="bg-gray-100 px-4 py-2 rounded-lg" onPress={() => setShowTimePicker(false)}>
                      <Text className="text-gray-900 text-sm">Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity className="bg-primary px-4 py-2 rounded-lg" onPress={() => setShowTimePicker(false)}>
                      <Text className="text-white text-sm font-semibold">Done</Text>
                    </TouchableOpacity>
                  </View>
                )}
                <DateTimePicker
                  value={timePickerValue}
                  mode="time"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={(event, selectedDate) => {
                    if (Platform.OS === 'android') setShowTimePicker(false);
                    if (selectedDate) handleInputChange('eventTime', formatTime(selectedDate));
                  }}
                />
              </View>
            )}

            <Text className={labelClass}>Address <Text className="text-[#6B7280]">(optional)</Text></Text>
            <View className={`${inputRow} mb-3`}>
              <View className={iconWrap}>
                <MaterialIcons name="location-on" size={18} color="#9CA3AF" />
              </View>
              <TextInput
                className="flex-1 text-gray-900 text-sm"
                placeholder="e.g. Islamabad, Pakistan"
                placeholderTextColor="#6B7280"
                value={formData.address}
                onChangeText={(v) => handleInputChange('address', v)}
              />
            </View>

            <DataSelection
              label="Gender"
              value={formData.genderSelection}
              onSelect={(v) => handleInputChange('genderSelection', v)}
              options={GENDER_OPTIONS.map((opt) => ({ value: opt, label: opt }))}
              error={errors.genderSelection}
              className="mb-3"
            />

            <DataInput
              label="Description (optional)"
              placeholder="description"
              value={formData.description}
              onChangeText={(v) => handleInputChange('description', v)}
              multiline
              textAlignVertical="top"
              className="mb-6"
            />

            <ButtonPrimary
              fullWidth
              onPress={handleNext}
              disabled={!step1Valid}
            >
              Next
            </ButtonPrimary>
          </>
        )}

        {step === 2 && (
          <>
            <DataSelection<'paid' | 'free'>
              label="Event Type"
              value={formData.eventType}
              onSelect={(v) => handleInputChange('eventType', v)}
              options={[
                { value: 'paid', label: 'Paid Event' },
                { value: 'free', label: 'Free Event' },
              ]}
              className="mb-4"
            />

            {formData.eventType === 'paid' && (
              <>
                <DataInput
                  label="Cost Per Ticket"
                  placeholder="e.g. 600"
                  value={formData.ticketPrice}
                  onChangeText={(v) => handleInputChange('ticketPrice', v)}
                  error={errors.ticketPrice}
                  keyboardType="numeric"
                  className="mb-3"
                />
                <DataSelection
                  label="Select Currency"
                  value={formData.currency}
                  onSelect={(v) => handleInputChange('currency', v)}
                  options={CURRENCY_OPTIONS.map((c) => ({
                    value: c.code,
                    label: `${c.code} - ${c.label}`,
                    subtitle: c.flag,
                  }))}
                  getLabel={(v) => CURRENCY_OPTIONS.find((c) => c.code === v)?.label ?? v}
                  className="mb-4"
                />
                <DataInput
                  label="Total Tickets"
                  placeholder="e.g. 100"
                  value={formData.totalTickets}
                  onChangeText={(v) => handleInputChange('totalTickets', v)}
                  error={errors.totalTickets}
                  keyboardType="numeric"
                  className="mb-4"
                />
              </>
            )}

            <ButtonPrimary
              fullWidth
              onPress={handleSubmit}
              disabled={saving || !step2Valid}
              loading={saving}
              className="mt-2"
            >
              Update Event
            </ButtonPrimary>
          </>
        )}
      </ScrollView>

      <Modal
        visible={showErrorModal}
        onClose={() => setShowErrorModal(false)}
        title="Error"
        message={errorMessage}
        primaryButtonText="OK"
        onPrimaryPress={() => setShowErrorModal(false)}
        variant="error"
      />
    </KeyboardAvoidingView>
  );
}
