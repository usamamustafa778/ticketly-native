import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { BackButton } from '@/components/BackButton';
import { CollapsibleSection } from '@/components/CollapsibleSection';
import { Modal } from '@/components/Modal';
import { useAppStore } from '@/store/useAppStore';
import { authAPI } from '@/lib/api/auth';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Token storage keys (must match client.ts)
const ACCESS_TOKEN_KEY = 'accessToken';
const REFRESH_TOKEN_KEY = 'refreshToken';

export default function SettingsScreen() {
  const router = useRouter();
  const { open } = useLocalSearchParams<{ open?: string }>();
  const user = useAppStore((state) => state.user);
  const setUser = useAppStore((state) => state.setUser);
  const logout = useAppStore((state) => state.logout);
  const [expandedSection, setExpandedSection] = useState<'profile' | 'security' | 'liked' | null>(
    open === 'profile' ? 'profile' : open === 'liked' ? 'liked' : null
  );

  const toggleSection = useCallback((section: 'profile' | 'security' | 'liked' | null) => {
    setExpandedSection((prev) => (prev === section ? null : section));
  }, []);
  
  // Edit Profile state
  const [name, setName] = useState(user?.fullName || '');
  const [likedEventsVisibility, setLikedEventsVisibility] = useState<'public' | 'private'>(
    (user as any)?.likedEventsVisibility || 'public'
  );
  const [loadingLikedVisibility, setLoadingLikedVisibility] = useState(false);
  const [loadingName, setLoadingName] = useState(false);
  
  // Security state
  const [email, setEmail] = useState(user?.email || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loadingEmail, setLoadingEmail] = useState(false);
  const [loadingPassword, setLoadingPassword] = useState(false);
  const [nameError, setNameError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successModalMessage, setSuccessModalMessage] = useState('');
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const vis = (user as any)?.likedEventsVisibility;
    if (vis === 'public' || vis === 'private') setLikedEventsVisibility(vis);
  }, [user]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const response = await authAPI.getProfile();
      if (response.success && response.user) {
        setUser(response.user);
        setName(response.user.fullName || '');
        setEmail(response.user.email || '');
        setLikedEventsVisibility((response.user as any)?.likedEventsVisibility || 'public');
      }
    } catch (_) {
      // Ignore refresh errors
    } finally {
      setRefreshing(false);
    }
  }, [setUser]);

  const handleUpdateName = async () => {
    if (!name.trim()) {
      setNameError('Name is required');
      return;
    }

    if (name === user?.fullName) {
      setShowInfoModal(true);
      return;
    }

    setLoadingName(true);
    setNameError('');
    try {
      const response = await authAPI.updateUser({ name: name.trim() });
      if (response.success) {
        if (response.user) {
          setUser(response.user);
        }
        setSuccessModalMessage('Name updated successfully');
        setShowSuccessModal(true);
      } else {
        setNameError(response.message || 'Failed to update name');
      }
    } catch (error: any) {
      setNameError(error.response?.data?.message || 'Failed to update name. Please try again.');
    } finally {
      setLoadingName(false);
    }
  };

  const handleUpdateEmail = async () => {
    if (!email.trim()) {
      setEmailError('Email is required');
      return;
    }

    if (email === user?.email) {
      setShowInfoModal(true);
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setEmailError('Please enter a valid email address');
      return;
    }

    setLoadingEmail(true);
    setEmailError('');
    try {
      const response = await authAPI.updateUser({ email: email.trim() });
      if (response.success) {
        if (response.user) {
          setUser(response.user);
        }
        setSuccessModalMessage('Email updated successfully');
        setShowSuccessModal(true);
        setEmail(email.trim());
      } else {
        setEmailError(response.message || 'Failed to update email');
      }
    } catch (error: any) {
      setEmailError(error.response?.data?.message || 'Failed to update email. Please try again.');
    } finally {
      setLoadingEmail(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError('All password fields are required');
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }

    setLoadingPassword(true);
    setPasswordError('');
    try {
      const response = await authAPI.updateUser({ password: newPassword });
      if (response.success) {
        setSuccessModalMessage('Password updated successfully');
        setShowSuccessModal(true);
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setPasswordError(response.message || 'Failed to update password');
      }
    } catch (error: any) {
      setPasswordError(error.response?.data?.message || 'Failed to update password. Please try again.');
    } finally {
      setLoadingPassword(false);
    }
  };

  const handleLogout = () => {
    setShowLogoutModal(true);
  };

  const confirmLogout = async () => {
    setShowLogoutModal(false);
    await performLogout();
  };

  const performLogout = async () => {
    try {
      // Clear tokens from AsyncStorage
      await Promise.all([
        AsyncStorage.removeItem(ACCESS_TOKEN_KEY),
        AsyncStorage.removeItem(REFRESH_TOKEN_KEY),
      ]);

      // Clear all AsyncStorage
      await AsyncStorage.clear();

      // For web, also clear localStorage
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(ACCESS_TOKEN_KEY);
        window.localStorage.removeItem(REFRESH_TOKEN_KEY);
        window.localStorage.clear();
      }

      // Clear user state in store
      await logout();

      // Small delay to ensure storage operations complete
      await new Promise(resolve => setTimeout(resolve, 200));

      // Navigate to login
      router.replace('/login');
    } catch (error) {
      console.error('Logout error:', error);
      // Even if there's an error, try to clear state and navigate
      await logout();
      router.replace('/login');
    }
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-white"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
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
        {/* Header */}
        <View className="flex-row items-center pt-[60px] px-3 pb-4 border-b border-gray-200">
          <BackButton onPress={() => router.back()} className="-ml-2" />
          <Text className="flex-1 text-gray-900 text-lg font-semibold text-center mr-8">Settings</Text>
        </View>

        {/* List */}
        <View className="px-3 pt-4">
          {/* Edit Profile */}
          <TouchableOpacity
            className="flex-row items-center justify-between py-4 border-b border-gray-200"
            onPress={() => toggleSection('profile')}
            activeOpacity={0.7}
          >
            <View className="flex-row items-center">
              <MaterialIcons name="person-outline" size={22} color="#111827" style={{ marginRight: 12 }} />
              <Text className="text-gray-900 text-base font-medium">Edit Profile</Text>
            </View>
            <MaterialIcons
              name={expandedSection === 'profile' ? 'expand-less' : 'expand-more'}
              size={24}
              color="#6B7280"
            />
          </TouchableOpacity>

          <CollapsibleSection expanded={expandedSection === 'profile'}>
            <View className="pb-6 pt-2">
              <Text className="text-gray-500 text-xs font-medium mb-3 uppercase tracking-wide">Name</Text>
              <TextInput
                className={`bg-gray-50 border rounded-lg py-3 px-4 text-gray-900 text-base mb-2 ${nameError ? 'border-red-500' : 'border-gray-200'}`}
                placeholder="Full name"
                placeholderTextColor="#9CA3AF"
                value={name}
                onChangeText={(text) => {
                  setName(text);
                  if (nameError) setNameError('');
                }}
                autoCapitalize="words"
              />
              {nameError ? <Text className="text-red-500 text-xs mb-4">{nameError}</Text> : null}
              <TouchableOpacity
                className={`bg-gray-900 py-3 rounded-lg items-center ${loadingName ? 'opacity-60' : ''}`}
                onPress={handleUpdateName}
                disabled={loadingName}
              >
                {loadingName ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text className="text-white text-sm font-semibold">Update Name</Text>
                )}
              </TouchableOpacity>
            </View>
          </CollapsibleSection>

          {/* Security */}
          <TouchableOpacity
            className="flex-row items-center justify-between py-4 border-b border-gray-200"
            onPress={() => toggleSection('security')}
            activeOpacity={0.7}
          >
            <View className="flex-row items-center">
              <MaterialIcons name="lock-outline" size={22} color="#111827" style={{ marginRight: 12 }} />
              <Text className="text-gray-900 text-base font-medium">Security</Text>
            </View>
            <MaterialIcons
              name={expandedSection === 'security' ? 'expand-less' : 'expand-more'}
              size={24}
              color="#6B7280"
            />
          </TouchableOpacity>

          <CollapsibleSection expanded={expandedSection === 'security'}>
            <View className="pb-6 pt-2">
              <Text className="text-gray-500 text-xs font-medium mb-3 uppercase tracking-wide">Email</Text>
            <TextInput
              className={`bg-gray-50 border rounded-lg py-3 px-4 text-gray-900 text-base mb-2 ${emailError ? 'border-red-500' : 'border-gray-200'}`}
              placeholder="Email"
              placeholderTextColor="#9CA3AF"
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                if (emailError) setEmailError('');
              }}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            {emailError ? <Text className="text-red-500 text-xs mb-4">{emailError}</Text> : null}
            <TouchableOpacity
              className={`bg-gray-900 py-3 rounded-lg items-center mb-8 ${loadingEmail ? 'opacity-60' : ''}`}
              onPress={handleUpdateEmail}
              disabled={loadingEmail}
            >
              {loadingEmail ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text className="text-white text-sm font-semibold">Update Email</Text>
              )}
            </TouchableOpacity>

            <Text className="text-gray-500 text-xs font-medium mb-3 uppercase tracking-wide">Password</Text>
            <View className="relative mb-3">
              <TextInput
                className="bg-gray-50 border border-gray-200 rounded-lg py-3 px-4 pr-12 text-gray-900 text-base"
                placeholder="Current password"
                placeholderTextColor="#9CA3AF"
                value={currentPassword}
                onChangeText={setCurrentPassword}
                secureTextEntry={!showCurrentPassword}
                autoCapitalize="none"
              />
              <TouchableOpacity
                className="absolute right-3 top-3 p-1"
                onPress={() => setShowCurrentPassword(!showCurrentPassword)}
              >
                <MaterialIcons name={showCurrentPassword ? "visibility" : "visibility-off"} size={20} color="#9CA3AF" />
              </TouchableOpacity>
            </View>
            <View className="relative mb-3">
              <TextInput
                className={`bg-gray-50 border rounded-lg py-3 px-4 pr-12 text-gray-900 text-base ${passwordError ? 'border-red-500' : 'border-gray-200'}`}
                placeholder="New password"
                placeholderTextColor="#9CA3AF"
                value={newPassword}
                onChangeText={(text) => {
                  setNewPassword(text);
                  if (passwordError) setPasswordError('');
                }}
                secureTextEntry={!showNewPassword}
                autoCapitalize="none"
              />
              <TouchableOpacity
                className="absolute right-3 top-3 p-1"
                onPress={() => setShowNewPassword(!showNewPassword)}
              >
                <MaterialIcons name={showNewPassword ? "visibility" : "visibility-off"} size={20} color="#9CA3AF" />
              </TouchableOpacity>
            </View>
            <View className="relative mb-3">
              <TextInput
                className={`bg-gray-50 border rounded-lg py-3 px-4 pr-12 text-gray-900 text-base ${passwordError ? 'border-red-500' : 'border-gray-200'}`}
                placeholder="Confirm new password"
                placeholderTextColor="#9CA3AF"
                value={confirmPassword}
                onChangeText={(text) => {
                  setConfirmPassword(text);
                  if (passwordError) setPasswordError('');
                }}
                secureTextEntry={!showConfirmPassword}
                autoCapitalize="none"
              />
              <TouchableOpacity
                className="absolute right-3 top-3 p-1"
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
              >
                <MaterialIcons name={showConfirmPassword ? "visibility" : "visibility-off"} size={20} color="#9CA3AF" />
              </TouchableOpacity>
            </View>
            {passwordError ? <Text className="text-red-500 text-xs mb-4">{passwordError}</Text> : null}
            <TouchableOpacity
              className={`bg-gray-900 py-3 rounded-lg items-center ${loadingPassword ? 'opacity-60' : ''}`}
              onPress={handleUpdatePassword}
              disabled={loadingPassword}
            >
              {loadingPassword ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text className="text-white text-sm font-semibold">Update Password</Text>
              )}
            </TouchableOpacity>
            </View>
          </CollapsibleSection>

          {/* Liked Events */}
          <TouchableOpacity
            className="flex-row items-center justify-between py-4 border-b border-gray-200"
            onPress={() => toggleSection('liked')}
            activeOpacity={0.7}
          >
            <View className="flex-row items-center">
              <MaterialIcons name="favorite-border" size={22} color="#111827" style={{ marginRight: 12 }} />
              <Text className="text-gray-900 text-base font-medium">Liked Events</Text>
            </View>
            <View className="flex-row items-center">
              <Text className="text-gray-500 text-sm mr-2">{likedEventsVisibility === 'public' ? 'Public' : 'Private'}</Text>
              <MaterialIcons
                name={expandedSection === 'liked' ? 'expand-less' : 'expand-more'}
                size={24}
                color="#6B7280"
              />
            </View>
          </TouchableOpacity>

          <CollapsibleSection expanded={expandedSection === 'liked'}>
            <View className="pb-6 pt-2">
              <Text className="text-gray-600 text-sm mb-3">
                Choose who can see your liked events on your public profile
              </Text>
              <View className="flex-row gap-2">
                <TouchableOpacity
                  className={`flex-1 py-3 rounded-lg items-center border ${likedEventsVisibility === 'public' ? 'bg-primary border-primary' : 'bg-gray-50 border-gray-200'}`}
                  onPress={async () => {
                    if (likedEventsVisibility === 'public') return;
                    setLoadingLikedVisibility(true);
                    try {
                      const res = await authAPI.updateUser({ likedEventsVisibility: 'public' });
                      if (res.success && res.user) {
                        setUser(res.user);
                        setLikedEventsVisibility('public');
                      }
                    } finally {
                      setLoadingLikedVisibility(false);
                    }
                  }}
                  disabled={loadingLikedVisibility}
                >
                  <Text className={`text-sm font-semibold ${likedEventsVisibility === 'public' ? 'text-white' : 'text-gray-600'}`}>
                    Public
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  className={`flex-1 py-3 rounded-lg items-center border ${likedEventsVisibility === 'private' ? 'bg-gray-900 border-gray-900' : 'bg-gray-50 border-gray-200'}`}
                  onPress={async () => {
                    if (likedEventsVisibility === 'private') return;
                    setLoadingLikedVisibility(true);
                    try {
                      const res = await authAPI.updateUser({ likedEventsVisibility: 'private' });
                      if (res.success && res.user) {
                        setUser(res.user);
                        setLikedEventsVisibility('private');
                      }
                    } finally {
                      setLoadingLikedVisibility(false);
                    }
                  }}
                  disabled={loadingLikedVisibility}
                >
                  <Text className={`text-sm font-semibold ${likedEventsVisibility === 'private' ? 'text-white' : 'text-gray-600'}`}>
                    Private
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </CollapsibleSection>
        </View>

        {/* Logout */}
        <View className="mt-12 px-3 pb-8">
          <TouchableOpacity
            className="flex-row items-center justify-center gap-2 py-3 rounded-lg border-2 border-red-500 bg-red-50"
            onPress={handleLogout}
            activeOpacity={0.7}
          >
            <MaterialIcons name="logout" size={20} color="#DC2626" />
            <Text className="text-red-600 text-base font-semibold">Log out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <Modal
        visible={showInfoModal}
        onClose={() => setShowInfoModal(false)}
        title="Info"
        message="No changes made."
        primaryButtonText="OK"
        onPrimaryPress={() => setShowInfoModal(false)}
        variant="info"
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
    </KeyboardAvoidingView>
  );
}

