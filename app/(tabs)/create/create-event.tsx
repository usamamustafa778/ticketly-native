import { BackButton } from '@/components/BackButton';
import { Modal } from '@/components/Modal';
import { ButtonPrimary, ButtonSecondary } from '@/components/ui';
import { DataInput } from '@/components/ui/DataInput';
import { DataSelection } from '@/components/ui/DataSelection';
import { authAPI } from '@/lib/api/auth';
import { eventsAPI } from '@/lib/api/events';
import { useAppStore } from '@/store/useAppStore';
import { formatApiError } from '@/lib/utils/errorUtils';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Modal as RNModal,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

interface EventFormData {
  // Step 1 - Event Details
  eventName: string;
  eventDate: Date | null;
  eventTime: string; // "HH:mm"
  address: string;
  genderSelection: string;
  description: string;
  imageUri: string | null;
  imageUrl: string | null; // for preview display
  imagePath: string | null; // relative path for API (e.g. /uploads/events/xxx.jpg)
  // Step 2 - Payment and Ticket
  eventType: 'paid' | 'free';
  ticketPrice: string;
  totalTickets: string;
  currency: string;
}

const GENDER_OPTIONS = ['All', 'Male', 'Female'] as const;

/** Currency options: code + label + flag emoji. For now only PKR. */
const CURRENCY_OPTIONS = [
  { code: 'PKR', label: 'Pakistani Rupee (PKR)', flag: '🇵🇰' },
] as const;
/** Map form value to API: all | male | female */
function genderToApi(v: string): 'all' | 'male' | 'female' {
  const lower = v.toLowerCase();
  if (lower === 'male' || lower === 'female' || lower === 'all') return lower;
  return 'all';
}

function formatTime(date: Date): string {
  return date.toTimeString().slice(0, 5); // "HH:mm"
}

function formatDateForDisplay(date: Date): string {
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function toImagePath(urlOrPath: string): string | null {
  if (!urlOrPath) return null;
  if (urlOrPath.startsWith('/')) return urlOrPath; // Already a path
  try {
    return new URL(urlOrPath).pathname || null;
  } catch {
    const i = urlOrPath.indexOf('/uploads');
    return i !== -1 ? urlOrPath.substring(i) : urlOrPath;
  }
}

export const CREATE_EVENT_DRAFT_KEY = 'ticketly_create_event_draft';

type DraftData = Omit<EventFormData, 'eventDate'> & { eventDate: string | null; step: 1 | 2 };

function serializeDraft(formData: EventFormData, step: 1 | 2): DraftData {
  return {
    ...formData,
    eventDate: formData.eventDate ? formData.eventDate.toISOString() : null,
    step,
  };
}

function deserializeDraft(raw: DraftData): { formData: EventFormData; step: 1 | 2 } | null {
  if (!raw || typeof raw !== 'object') return null;
  const eventDate = raw.eventDate ? (() => {
    const d = new Date(raw.eventDate);
    return isNaN(d.getTime()) ? null : d;
  })() : null;
  const step = raw.step === 1 || raw.step === 2 ? raw.step : 1;
  return {
    formData: {
      eventName: String(raw.eventName ?? ''),
      eventDate,
      eventTime: String(raw.eventTime ?? '18:00'),
      address: String(raw.address ?? ''),
      genderSelection: String(raw.genderSelection ?? 'All'),
      description: String(raw.description ?? ''),
      imageUri: raw.imageUri ?? null,
      imageUrl: raw.imageUrl ?? null,
      imagePath: raw.imagePath ?? null,
      eventType: raw.eventType === 'paid' ? 'paid' : 'free',
      ticketPrice: String(raw.ticketPrice ?? ''),
      totalTickets: String(raw.totalTickets ?? '100'),
      currency: String(raw.currency ?? 'PKR'),
    },
    step,
  };
}

export default function CreateEventScreen() {
  const router = useRouter();
  const user = useAppStore((state) => state.user);
  const setUser = useAppStore((state) => state.setUser);
  const [step, setStep] = useState<1 | 2>(1);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [createdEventId, setCreatedEventId] = useState<string | null>(null);
  /** Per-field validation errors (shown when user taps Next or Submit with invalid data) */
  const [errors, setErrors] = useState<Partial<Record<keyof EventFormData, string>>>({});
  const [keyboardHeight, setKeyboardHeight] = useState(0);

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

  const initialFormData: EventFormData = {
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
  };
  const [formData, setFormData] = useState<EventFormData>(initialFormData);

  const stepRef = useRef(step);
  stepRef.current = step;

  const draftLoadedRef = useRef(false);

  // Load draft from AsyncStorage on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(CREATE_EVENT_DRAFT_KEY);
        if (cancelled || !raw) {
          draftLoadedRef.current = true;
          return;
        }
        const parsed = JSON.parse(raw) as DraftData;
        const restored = deserializeDraft(parsed);
        if (!cancelled && restored) {
          setFormData(restored.formData);
          setStep(restored.step);
        }
      } catch (_) {}
      finally {
        if (!cancelled) draftLoadedRef.current = true;
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Debounced save draft when formData or step changes (only after initial load)
  const saveDraft = useCallback((data: EventFormData, s: 1 | 2) => {
    const payload = serializeDraft(data, s);
    AsyncStorage.setItem(CREATE_EVENT_DRAFT_KEY, JSON.stringify(payload)).catch(() => {});
  }, []);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!draftLoadedRef.current) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      saveTimeoutRef.current = null;
      saveDraft(formData, stepRef.current);
    }, 400);
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [formData, step, saveDraft]);

  const handleInputChange = (field: keyof EventFormData, value: string | Date | null) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const pickImage = async () => {
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
        // Extract path from imageUrl for API, use imageUrl for preview
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

  /** Required for step 1: event name, start date, start time, gender. Address and description are optional. */
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

  const handleNext = () => {
    if (!validateStep1()) return;
    setStep(2);
  };

  /** Step 2: when paid, price and currency (PKR) required. */
  const step2Valid =
    formData.eventType === 'free' ||
    (formData.eventType === 'paid' &&
      formData.ticketPrice.trim() !== '' &&
      !Number.isNaN(Number(formData.ticketPrice)) &&
      Number(formData.ticketPrice) >= 0);

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

    setLoading(true);
    try {
      // Use relative path for API (dynamic backend URL)
      let imageToSend: string | undefined = formData.imagePath || undefined;
      if (formData.imageUri && !formData.imagePath) {
        setUploadingImage(true);
        try {
          const uploadResponse = await eventsAPI.uploadEventImage(formData.imageUri);
          if (uploadResponse.success) {
            const path = uploadResponse.imageUrl ? toImagePath(uploadResponse.imageUrl) : null;
            imageToSend = path || undefined;
            setFormData((prev) => ({
              ...prev,
              imagePath: path,
              imageUrl: uploadResponse.imageUrl || null,
            }));
          } else {
            imageToSend = '';
          }
        } catch {
          imageToSend = '';
        } finally {
          setUploadingImage(false);
        }
        
      }

      const eventDate = formData.eventDate!;
      const dateStr = eventDate.toISOString().split('T')[0];
      const [hours, minutes] = formData.eventTime.split(':');
      const timeStr = `${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}`;

      const totalTickets = formData.eventType === 'free' ? undefined : parseInt(formData.totalTickets, 10) || 100;
      const ticketPrice = formData.eventType === 'free' ? 0 : Number(formData.ticketPrice);

      const response = await eventsAPI.createEvent({
        title: formData.eventName.trim(),
        date: dateStr,
        time: timeStr,
        location: formData.address.trim() || undefined,
        description: formData.description.trim() || undefined,
        image: imageToSend,
        email: user?.email || '',
        phone: user?.phone || undefined,
        gender: genderToApi(formData.genderSelection),
        ticketPrice,
        totalTickets,
      });

      if (response.success) {
        await AsyncStorage.removeItem(CREATE_EVENT_DRAFT_KEY);
        setFormData(initialFormData);
        setStep(1);
        setErrors({});
        const eventId = response.event?.id || (response.event as any)?._id;
        if (eventId) setCreatedEventId(String(eventId));
        try {
          const profileResponse = await authAPI.getProfile();
          if (profileResponse.success && profileResponse.user) setUser(profileResponse.user);
        } catch {}
        setShowSuccessModal(true);
      } else {
        setErrorMessage(formatApiError(response, response.message || 'Failed to create event'));
        setShowErrorModal(true);
      }
    } catch (error: any) {
      setErrorMessage(
        error?.isSessionExpired ? 'Your session has expired. Please login again.' : formatApiError(error, 'Failed to create event. Please try again.')
      );
      setShowErrorModal(true);
    } finally {
      setLoading(false);
    }
  };

  const handleSuccessClose = () => {
    setShowSuccessModal(false);
    if (createdEventId) router.push(`/created-event-details/${createdEventId}`);
    else router.back();
  };

  const timePickerValue = (() => {
    const [h, m] = formData.eventTime.split(':').map(Number);
    const d = formData.eventDate || new Date();
    const x = new Date(d);
    x.setHours(isNaN(h) ? 18 : h, isNaN(m) ? 0 : m, 0, 0);
    return x;
  })();

  const inputRow = 'bg-gray-50 rounded-xl py-2 px-3 flex-row items-center gap-2 border border-gray-200';
  const iconWrap = 'w-8 h-8 rounded-full bg-gray-200 items-center justify-center';
  const labelClass = 'text-gray-900 text-sm font-medium mb-1.5';

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-white"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Header: back, progress bar, step label */}
      <View className="py-2 px-6 shadow-xs">
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
          <Text className="text-gray-900 text-sm font-medium ml-2 w-10 text-right">
            {step} of 2
          </Text>
        </View>
        <Text className="text-gray-900 text-lg font-bold">
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
            {/* Image / Video upload */}
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
                        setFormData((prev) => ({ ...prev, imageUri: null, imageUrl: null }));
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
             size="lg"     
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
              size="lg"
              onPress={handleSubmit}
              disabled={loading || !step2Valid}
              loading={loading}
              className="mt-2"
            >
              Post
            </ButtonPrimary>
          </>
        )}
      </ScrollView>

      <Modal
        visible={showSuccessModal}
        onClose={handleSuccessClose}
        title="Success!"
        message="Your event has been created successfully."
        primaryButtonText="OK"
        onPrimaryPress={handleSuccessClose}
        variant="success"
      />
      <Modal
        visible={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        title="Login Required"
        message="Please login to create an event."
        primaryButtonText="Login"
        secondaryButtonText="Cancel"
        onPrimaryPress={() => {
          setShowLoginModal(false);
          router.push('/login');
        }}
        variant="info"
      />
      <Modal
        visible={showPermissionModal}
        onClose={() => setShowPermissionModal(false)}
        title="Permission Required"
        message="We need access to your photos to upload event images."
        primaryButtonText="OK"
        onPrimaryPress={() => setShowPermissionModal(false)}
        variant="info"
      />
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
