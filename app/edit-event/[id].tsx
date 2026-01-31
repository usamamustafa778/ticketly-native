import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Image,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAppStore } from '@/store/useAppStore';
import { eventsAPI, type Event } from '@/lib/api/events';
import { Modal } from '@/components/Modal';
import DateTimePicker from '@react-native-community/datetimepicker';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as ImagePicker from 'expo-image-picker';
import { getEventImageUrl } from '@/lib/utils/imageUtils';

interface EventFormData {
  name: string;
  email: string;
  phone: string;
  companyName: string;
  eventName: string;
  eventLocation: string;
  eventDate: Date | null;
  eventTime: string;
  eventCity: string;
  ticketPrice: string;
  totalTickets: string;
  eventCategory: string;
  description: string;
  imageUri: string | null;
  imageUrl: string | null;
}

export default function EditEventScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useAppStore((state) => state.user);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [event, setEvent] = useState<Event | null>(null);
  const [formData, setFormData] = useState<EventFormData>({
    name: user?.fullName || '',
    email: user?.email || '',
    phone: user?.phone || '',
    companyName: user?.companyName || '',
    eventName: '',
    eventLocation: '',
    eventDate: null,
    eventTime: '18:00',
    eventCity: '',
    ticketPrice: '',
    totalTickets: '',
    eventCategory: '',
    description: '',
    imageUri: null,
    imageUrl: null,
  });

  const categories = ['Music', 'Technology', 'Festival', 'Sports', 'Arts', 'Business', 'Other'];

  // Get event ID helper
  const getEventId = () => {
    return Array.isArray(id) ? id[0] : id;
  };

  // Load event data
  useEffect(() => {
    const loadEvent = async () => {
      const eventId = getEventId();
      if (!eventId) {
        Alert.alert('Error', 'Event ID is required', [
          { text: 'OK', onPress: () => router.back() },
        ]);
        return;
      }

      try {
        setLoading(true);
        const response = await eventsAPI.getEventById(String(eventId));
        
        if (response.success && response.event) {
          const eventData = response.event;
          setEvent(eventData);

          // Parse location to extract location and city
          const locationParts = eventData.location?.split(',') || [];
          const eventLocation = locationParts[0]?.trim() || '';
          const eventCity = locationParts.slice(1).join(',').trim() || '';

          // Parse date
          const eventDate = eventData.date ? new Date(eventData.date) : null;

          // Get image URL
          const imageUrl = getEventImageUrl(eventData);

          // Pre-fill form with event data
          setFormData({
            name: user?.fullName || '',
            email: eventData.email || user?.email || '',
            phone: eventData.phone || user?.phone || '',
            companyName: user?.companyName || '',
            eventName: eventData.title || '',
            eventLocation,
            eventDate,
            eventTime: eventData.time || '18:00',
            eventCity,
            ticketPrice: eventData.ticketPrice?.toString() || '0',
            totalTickets: eventData.totalTickets?.toString() || '100',
            eventCategory: '', // Category is not stored in backend
            description: eventData.description || '',
            imageUri: imageUrl ? imageUrl : null,
            imageUrl: imageUrl || null,
          });
        } else {
          Alert.alert('Error', 'Event not found', [
            { text: 'OK', onPress: () => router.back() },
          ]);
        }
      } catch (error: any) {
        console.error('Error loading event:', error);
        Alert.alert('Error', error.response?.data?.message || 'Failed to load event', [
          { text: 'OK', onPress: () => router.back() },
        ]);
      } finally {
        setLoading(false);
      }
    };

    loadEvent();
  }, [id]);

  const handleInputChange = (field: keyof EventFormData, value: string | Date | null) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const pickImage = async () => {
    // Request permission
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'We need access to your photos to upload event images.');
      return;
    }

    // Launch image picker
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const imageUri = asset.uri;

      setFormData((prev) => ({ ...prev, imageUri }));

      // Upload image immediately
      await uploadImage(imageUri);
    }
  };

  const uploadImage = async (imageUri: string) => {
    setUploadingImage(true);
    try {
      const response = await eventsAPI.uploadEventImage(imageUri);
      if (response.success) {
        setFormData((prev) => ({ ...prev, imageUrl: response.imageUrl }));
      } else {
        console.warn('Image upload failed, but continuing without image (optional)');
        setFormData((prev) => ({ ...prev, imageUri: null, imageUrl: null }));
      }
    } catch (error: any) {
      console.warn('Image upload error, continuing without image:', error.message);
      setFormData((prev) => ({ ...prev, imageUri: null, imageUrl: null }));
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSubmit = async () => {
    // Validate all required fields
    if (!formData.eventName) {
      Alert.alert('Validation Error', 'Event Name is required');
      return;
    }

    if (!formData.eventLocation) {
      Alert.alert('Validation Error', 'Event Location is required');
      return;
    }

    if (!formData.eventDate) {
      Alert.alert('Validation Error', 'Event Date is required');
      return;
    }

    if (!formData.eventCity) {
      Alert.alert('Validation Error', 'Event City is required');
      return;
    }

    if (!formData.description || formData.description.length < 10) {
      Alert.alert('Validation Error', 'Please provide an event description (at least 10 characters)');
      return;
    }

    if (!formData.email || !formData.phone) {
      Alert.alert('Validation Error', 'Please fill in your email and phone number');
      return;
    }

    // Validate ticket price
    if (formData.ticketPrice.trim() === '') {
      Alert.alert('Validation Error', 'Please enter a ticket price (use 0 for free events)');
      return;
    }
    const parsedPrice = Number(formData.ticketPrice);
    if (Number.isNaN(parsedPrice) || parsedPrice < 0) {
      Alert.alert('Validation Error', 'Ticket price must be a valid number greater than or equal to 0');
      return;
    }

    // Validate total tickets
    if (formData.totalTickets.trim() === '') {
      Alert.alert('Validation Error', 'Please enter the total number of tickets');
      return;
    }
    const parsedTotalTickets = Number(formData.totalTickets);
    if (Number.isNaN(parsedTotalTickets) || parsedTotalTickets < 1) {
      Alert.alert('Validation Error', 'Total tickets must be a valid number greater than 0');
      return;
    }

    const isAuthenticated = useAppStore.getState().isAuthenticated;
    if (!isAuthenticated) {
      Alert.alert('Login Required', 'Please login to update an event', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Login', onPress: () => router.push('/login') },
      ]);
      return;
    }

    setSaving(true);
    try {
      const eventId = getEventId();
      if (!eventId) {
        Alert.alert('Error', 'Event ID is missing');
        return;
      }

      // Handle image upload/update
      let imageUrl: string | undefined = undefined;
      
      // If user selected a new image (not a URL), upload it
      if (formData.imageUri && !formData.imageUri.startsWith('http')) {
        setUploadingImage(true);
        try {
          const uploadResponse = await eventsAPI.uploadEventImage(formData.imageUri);
          if (uploadResponse.success) {
            imageUrl = uploadResponse.imageUrl;
            setFormData((prev) => ({ ...prev, imageUrl }));
          } else {
            console.warn('Image upload failed, continuing without image');
          }
        } catch (uploadError: any) {
          console.warn('Image upload error, continuing without image:', uploadError.message);
        } finally {
          setUploadingImage(false);
        }
      } else if (formData.imageUrl) {
        // Use already uploaded image URL
        imageUrl = formData.imageUrl;
      } else if (formData.imageUri && formData.imageUri.startsWith('http')) {
        // Existing image URL (from event data)
        imageUrl = formData.imageUri;
      }
      // If imageUri is null and there was an original image, user removed it - send empty string
      else if (!formData.imageUri && event?.image) {
        imageUrl = '';
      }

      const eventDate = formData.eventDate.toISOString().split('T')[0];
      
      // Prepare update data
      const updateData: any = {
        title: formData.eventName,
        description: formData.description,
        date: eventDate,
        time: formData.eventTime,
        location: `${formData.eventLocation}, ${formData.eventCity}`,
        email: formData.email,
        phone: formData.phone,
        ticketPrice: parsedPrice,
        totalTickets: parsedTotalTickets,
      };

      // Include image if it changed or was explicitly removed
      if (imageUrl !== undefined && imageUrl !== event?.image) {
        updateData.image = imageUrl;
      }

      const response = await eventsAPI.updateEvent(String(eventId), updateData);

      if (response.success) {
        Alert.alert('Success', 'Event updated successfully', [
          {
            text: 'OK',
            onPress: () => {
              router.back();
            },
          },
        ]);
      } else {
        Alert.alert('Error', response.message || 'Failed to update event');
      }
    } catch (error: any) {
      console.error('Error updating event:', error);
      Alert.alert(
        'Error',
        error.response?.data?.message || error.message || 'Failed to update event. Please try again.'
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View className="flex-1 bg-white">
        <View className="flex-1 items-center justify-center p-10">
          <ActivityIndicator size="large" color="#DC2626" />
          <Text className="text-gray-700 text-base mt-4">Loading event...</Text>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-white"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="flex-row items-center justify-between pt-[60px] px-3 pb-5">
          <TouchableOpacity onPress={() => router.back()}>
            <MaterialIcons name="arrow-back" size={24} color="#111827" />
          </TouchableOpacity>
          <Text className="text-gray-900 text-xl font-bold">Edit Event</Text>
          <View style={{ width: 30 }} />
        </View>

        <View className="px-3">
          <Text className="text-gray-900 text-sm font-semibold mb-2 mt-4">Name</Text>
          <TextInput
            className="bg-gray-50 border border-gray-200 rounded-xl py-3.5 px-4 text-gray-900 text-base"
            placeholder="e.g. Fatima Ali"
            placeholderTextColor="#6B7280"
            value={formData.name}
            onChangeText={(value) => handleInputChange('name', value)}
          />

          <Text className="text-gray-900 text-sm font-semibold mb-2 mt-4">Email</Text>
          <TextInput
            className="bg-gray-50 border border-gray-200 rounded-xl py-3.5 px-4 text-gray-900 text-base"
            placeholder="e.g. fatimaali@gmail.com"
            placeholderTextColor="#6B7280"
            value={formData.email}
            onChangeText={(value) => handleInputChange('email', value)}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <Text className="text-gray-900 text-sm font-semibold mb-2 mt-4">Phone Number</Text>
          <View className="flex-row gap-2">
            <TouchableOpacity className="bg-gray-50 border border-gray-200 rounded-xl py-3.5 px-3 flex-row items-center gap-2">
              <Text className="text-gray-900 text-base font-semibold">PK</Text>
              <MaterialIcons name="expand-more" size={16} color="#9CA3AF" />
            </TouchableOpacity>
            <TextInput
              className="flex-1 bg-gray-50 border border-gray-200 rounded-xl py-3.5 px-4 text-gray-900 text-base"
              placeholder="+92 334495437"
              placeholderTextColor="#6B7280"
              value={formData.phone}
              onChangeText={(value) => handleInputChange('phone', value)}
              keyboardType="phone-pad"
            />
          </View>

          <Text className="text-gray-900 text-sm font-semibold mb-2 mt-4">Company Name</Text>
          <TextInput
            className="bg-gray-50 border border-gray-200 rounded-xl py-3.5 px-4 text-gray-900 text-base"
            placeholder="e.g. Paymo events"
            placeholderTextColor="#6B7280"
            value={formData.companyName}
            onChangeText={(value) => handleInputChange('companyName', value)}
          />

          <Text className="text-gray-900 text-sm font-semibold mb-2 mt-4">Event Name</Text>
          <TextInput
            className="bg-gray-50 border border-gray-200 rounded-xl py-3.5 px-4 text-gray-900 text-base"
            placeholder="e.g. Catcha cat"
            placeholderTextColor="#6B7280"
            value={formData.eventName}
            onChangeText={(value) => handleInputChange('eventName', value)}
          />

          <Text className="text-white text-sm font-semibold mb-2 mt-4">Event Location</Text>
          <TextInput
            className="bg-[#1F1F1F] border border-[#374151] rounded-xl py-3.5 px-4 text-white text-base"
            placeholder="e.g LUMS"
            placeholderTextColor="#6B7280"
            value={formData.eventLocation}
            onChangeText={(value) => handleInputChange('eventLocation', value)}
          />

          <Text className="text-white text-sm font-semibold mb-2 mt-4">Event Date</Text>
          <TouchableOpacity
            className="bg-[#1F1F1F] border border-[#374151] rounded-xl py-3.5 px-4 flex-row justify-between items-center"
            onPress={() => setShowDatePicker(true)}
          >
            <Text className={`text-base ${formData.eventDate ? 'text-white' : 'text-[#6B7280]'}`}>
              {formData.eventDate
                ? formData.eventDate.toLocaleDateString('en-US', {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })
                : 'Select Date'}
            </Text>
            <MaterialIcons name="expand-more" size={16} color="#9CA3AF" />
          </TouchableOpacity>

          {showDatePicker && (
            <View>
              {Platform.OS === 'ios' && (
                <View className="flex-row justify-end gap-2 mt-2 mb-2">
                  <TouchableOpacity
                    className="bg-[#1F1F1F] px-4 py-2 rounded-lg"
                    onPress={() => setShowDatePicker(false)}
                  >
                    <Text className="text-white text-sm">Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    className="bg-primary px-4 py-2 rounded-lg"
                    onPress={() => setShowDatePicker(false)}
                  >
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
                    if (event.type === 'set' && selectedDate) {
                      handleInputChange('eventDate', selectedDate);
                    }
                  } else {
                    if (selectedDate) {
                      handleInputChange('eventDate', selectedDate);
                    }
                  }
                }}
              />
            </View>
          )}

          <Text className="text-white text-sm font-semibold mb-2 mt-4">Event Time</Text>
          <TextInput
            className="bg-[#1F1F1F] border border-[#374151] rounded-xl py-3.5 px-4 text-white text-base"
            placeholder="e.g. 18:00"
            placeholderTextColor="#6B7280"
            value={formData.eventTime}
            onChangeText={(value) => handleInputChange('eventTime', value)}
          />

          <Text className="text-white text-sm font-semibold mb-2 mt-4">Event City</Text>
          <TextInput
            className="bg-[#1F1F1F] border border-[#374151] rounded-xl py-3.5 px-4 text-white text-base"
            placeholder="Enter city name"
            placeholderTextColor="#6B7280"
            value={formData.eventCity}
            onChangeText={(value) => handleInputChange('eventCity', value)}
          />

          <Text className="text-white text-sm font-semibold mb-2 mt-4">Ticket Price (PKR)</Text>
          <TextInput
            className="bg-[#1F1F1F] border border-[#374151] rounded-xl py-3.5 px-4 text-white text-base"
            placeholder="e.g. 1500 (use 0 for free events)"
            placeholderTextColor="#6B7280"
            value={formData.ticketPrice}
            onChangeText={(value) => handleInputChange('ticketPrice', value)}
            keyboardType="numeric"
          />

          <Text className="text-white text-sm font-semibold mb-2 mt-4">Total Tickets</Text>
          <TextInput
            className="bg-[#1F1F1F] border border-[#374151] rounded-xl py-3.5 px-4 text-white text-base"
            placeholder="e.g. 100"
            placeholderTextColor="#6B7280"
            value={formData.totalTickets}
            onChangeText={(value) => handleInputChange('totalTickets', value)}
            keyboardType="numeric"
          />

          <Text className="text-white text-sm font-semibold mb-2 mt-4">
            Event Thumbnail <Text className="text-[#6B7280] text-xs">(Optional)</Text>
          </Text>
          <TouchableOpacity
            className="bg-[#1F1F1F] border border-[#374151] rounded-xl py-4 px-4 items-center justify-center"
            onPress={pickImage}
            disabled={uploadingImage}
          >
            {formData.imageUri ? (
              <View className="w-full items-center">
                <Image
                  source={{ uri: formData.imageUri }}
                  className="w-full h-[200px] rounded-lg mb-2"
                  resizeMode="cover"
                />
                {uploadingImage && (
                  <View className="flex-row items-center">
                    <ActivityIndicator color="#DC2626" size="small" />
                    <Text className="text-primary text-sm ml-2">Uploading...</Text>
                  </View>
                )}
                {formData.imageUrl && !uploadingImage && (
                  <Text className="text-[#10B981] text-sm">✓ Image uploaded</Text>
                )}
                <TouchableOpacity
                  className="mt-2"
                  onPress={() => setFormData((prev) => ({ ...prev, imageUri: null, imageUrl: null }))}
                >
                  <Text className="text-[#EF4444] text-sm">Remove Image</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View className="flex-row items-center">
                <MaterialIcons name="add-photo-alternate" size={24} color="#DC2626" />
                <Text className="text-primary text-base font-semibold ml-2">
                  {uploadingImage ? 'Uploading...' : 'Select Image from Gallery'}
                </Text>
              </View>
            )}
          </TouchableOpacity>

          <Text className="text-white text-sm font-semibold mb-2 mt-4">Event Category</Text>
          <TouchableOpacity
            className="bg-[#1F1F1F] border border-[#374151] rounded-xl py-3.5 px-4 flex-row justify-between items-center"
            onPress={() => {
              Alert.alert(
                'Select Category',
                '',
                categories.map((cat) => ({
                  text: cat,
                  onPress: () => handleInputChange('eventCategory', cat),
                }))
              );
            }}
          >
            <Text className={`text-base ${formData.eventCategory ? 'text-white' : 'text-[#6B7280]'}`}>
              {formData.eventCategory || 'Select Category'}
            </Text>
            <MaterialIcons name="expand-more" size={16} color="#9CA3AF" />
          </TouchableOpacity>

          <Text className="text-white text-sm font-semibold mb-2 mt-4">What is your event about</Text>
          <TextInput
            className="bg-[#1F1F1F] border border-[#374151] rounded-xl py-3.5 px-4 text-white text-base min-h-[120px] pt-3.5"
            placeholder="Enter a description..."
            placeholderTextColor="#6B7280"
            value={formData.description}
            onChangeText={(value) => handleInputChange('description', value)}
            multiline
            numberOfLines={6}
            textAlignVertical="top"
          />

          <TouchableOpacity
            className={`bg-primary py-4 rounded-xl items-center mt-8 ${saving ? 'opacity-60' : ''}`}
            onPress={handleSubmit}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text className="text-white text-base font-semibold">Update Event</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

