import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackButton } from '@/components/BackButton';
import { CollapsibleSection } from '@/components/CollapsibleSection';
import { Modal } from '@/components/Modal';
import { ButtonPrimary } from '@/components/ui/ButtonPrimary';
import { DataInput } from '@/components/ui/DataInput';
import { DataSelection } from '@/components/ui/DataSelection';
import { Icon } from '@/components/ui/Icon';
import { useAppStore } from '@/store/useAppStore';
import { authAPI } from '@/lib/api/auth';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Token storage keys (must match client.ts)
const ACCESS_TOKEN_KEY = 'accessToken';
const REFRESH_TOKEN_KEY = 'refreshToken';

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { open } = useLocalSearchParams<{ open?: string }>();
  const user = useAppStore((state) => state.user);
  const setUser = useAppStore((state) => state.setUser);
  const logout = useAppStore((state) => state.logout);
  const [expandedSection, setExpandedSection] = useState<'profile' | 'security' | 'liked' | 'followers' | null>(
    open === 'profile' ? 'profile' : open === 'liked' ? 'liked' : null
  );

  const toggleSection = useCallback((section: 'profile' | 'security' | 'liked' | 'followers' | null) => {
    setExpandedSection((prev) => (prev === section ? null : section));
  }, []);
  
  // Edit Profile state
  const [name, setName] = useState(user?.fullName || '');
  const [bio, setBio] = useState((user as any)?.bio || '');
  const [likedEventsVisibility, setLikedEventsVisibility] = useState<'public' | 'private'>(
    (user as any)?.likedEventsVisibility || 'public'
  );
  const [followersVisibility, setFollowersVisibility] = useState<'public' | 'private'>(
    (user as any)?.followersVisibility || 'public'
  );
  const [followingVisibility, setFollowingVisibility] = useState<'public' | 'private'>(
    (user as any)?.followingVisibility || 'public'
  );
  const [loadingLikedVisibility, setLoadingLikedVisibility] = useState(false);
  const [loadingFollowersVisibility, setLoadingFollowersVisibility] = useState(false);
  const [loadingFollowingVisibility, setLoadingFollowingVisibility] = useState(false);
  const [loadingName, setLoadingName] = useState(false);
  
  // Security state
  const [email, setEmail] = useState(user?.email || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loadingEmail, setLoadingEmail] = useState(false);
  const [loadingPassword, setLoadingPassword] = useState(false);
  const [nameError, setNameError] = useState('');
  const [bioError, setBioError] = useState('');
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
    const follVis = (user as any)?.followersVisibility;
    if (follVis === 'public' || follVis === 'private') setFollowersVisibility(follVis);
    const folVis = (user as any)?.followingVisibility;
    if (folVis === 'public' || folVis === 'private') setFollowingVisibility(folVis);
    setBio((user as any)?.bio || '');
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
        setFollowersVisibility((response.user as any)?.followersVisibility || 'public');
        setFollowingVisibility((response.user as any)?.followingVisibility || 'public');
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

  const handleUpdateBio = async () => {
    const trimmed = bio.trim();
    if (trimmed.length > 200) {
      setBioError('Bio must be 200 characters or less');
      return;
    }
    if (trimmed === ((user as any)?.bio || '')) {
      setShowInfoModal(true);
      return;
    }
    setBioError('');
    try {
      const response = await authAPI.updateUser({ bio: trimmed });
      if (response.success) {
        if (response.user) {
          setUser(response.user);
        }
        setSuccessModalMessage('Bio updated successfully');
        setShowSuccessModal(true);
      } else {
        setBioError(response.message || 'Failed to update bio');
      }
    } catch (error: any) {
      setBioError(error.response?.data?.message || 'Failed to update bio. Please try again.');
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
      {/* Fixed header - back button stays on top when scrolling */}
      <View
        style={{
          paddingTop: insets.top + 8,
          paddingBottom: 12,
          paddingHorizontal: 12,
          flexDirection: 'row',
          alignItems: 'center',
          borderBottomWidth: 1,
          borderBottomColor: '#E5E7EB',
          backgroundColor: '#FFFFFF',
        }}
      >
        <BackButton onPress={() => router.back()} className="-ml-2" />
        <Text className="flex-1 text-gray-900 text-lg font-semibold text-center mr-8">Settings</Text>
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
              <DataInput
                label="Name"
                placeholder="Full name"
                value={name}
                onChangeText={(text) => {
                  setName(text);
                  if (nameError) setNameError('');
                }}
                error={nameError}
                autoCapitalize="words"
                className="mb-4"
              />
              <ButtonPrimary
                loading={loadingName}
                disabled={loadingName}
                onPress={handleUpdateName}
                size="lg"
              >
                Update Name
              </ButtonPrimary>
              <View className="mt-6">
                <DataInput
                  label="Bio (optional)"
                  placeholder="Tell people what kind of events you host or enjoy"
                  value={bio}
                  onChangeText={(text) => {
                    setBio(text);
                    if (bioError) setBioError('');
                  }}
                  error={bioError}
                  multiline
                  numberOfLines={3}
                  className="mb-3"
                />
                <ButtonPrimary
                  disabled={false}
                  onPress={handleUpdateBio}
                  size="lg"
                >
                  Update Bio
                </ButtonPrimary>
              </View>
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
            <View className="pb-6  pt-2">
              <DataInput
                label="Email"
                placeholder="Email"
                value={email}
                onChangeText={(text) => {
                  setEmail(text);
                  if (emailError) setEmailError('');
                }}
                error={emailError}
                keyboardType="email-address"
                autoCapitalize="none"
                className="mb-4"
              />
              <ButtonPrimary
                loading={loadingEmail}
                disabled={loadingEmail}
                onPress={handleUpdateEmail}
                className="mb-8"
                size="lg"
              >
                Update Email
              </ButtonPrimary>

              <DataInput
                label="Current password"
                placeholder="Current password"
                value={currentPassword}
                onChangeText={setCurrentPassword}
                secureTextEntry={!showCurrentPassword}
                autoCapitalize="none"
                rightElement={
                  <TouchableOpacity onPress={() => setShowCurrentPassword(!showCurrentPassword)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Icon name={showCurrentPassword ? 'visibility' : 'visibility-off'} size="lg" color="#9CA3AF" />
                  </TouchableOpacity>
                }
                className="mb-3"
              />
              <DataInput
                label="New password"
                placeholder="New password"
                value={newPassword}
                onChangeText={(text) => {
                  setNewPassword(text);
                  if (passwordError) setPasswordError('');
                }}
                error={passwordError}
                secureTextEntry={!showNewPassword}
                autoCapitalize="none"
                rightElement={
                  <TouchableOpacity onPress={() => setShowNewPassword(!showNewPassword)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Icon name={showNewPassword ? 'visibility' : 'visibility-off'} size="lg" color="#9CA3AF" />
                  </TouchableOpacity>
                }
                className="mb-3"
              />
              <DataInput
                label="Confirm new password"
                placeholder="Confirm new password"
                value={confirmPassword}
                onChangeText={(text) => {
                  setConfirmPassword(text);
                  if (passwordError) setPasswordError('');
                }}
                secureTextEntry={!showConfirmPassword}
                autoCapitalize="none"
                rightElement={
                  <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Icon name={showConfirmPassword ? 'visibility' : 'visibility-off'} size="lg" color="#9CA3AF" />
                  </TouchableOpacity>
                }
                className="mb-4"
              />
              <ButtonPrimary
                loading={loadingPassword}
                disabled={loadingPassword}
                onPress={handleUpdatePassword}
                size="lg"
              >
                Update Password
              </ButtonPrimary>
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
              <DataSelection<'public' | 'private'>
                label="Who can see your liked events"
                value={likedEventsVisibility}
                onSelect={(value) => {
                  setLoadingLikedVisibility(true);
                  authAPI.updateUser({ likedEventsVisibility: value }).then((res) => {
                    if (res.success && res.user) {
                      setUser(res.user);
                      setLikedEventsVisibility(value);
                    }
                  }).finally(() => setLoadingLikedVisibility(false));
                }}
                options={[
                  { value: 'public', label: 'Public' },
                  { value: 'private', label: 'Private' },
                ]}
                disabled={loadingLikedVisibility}
              />
            </View>
          </CollapsibleSection>

          {/* Followers visibility */}
          <TouchableOpacity
            className="flex-row items-center justify-between py-4 border-b border-gray-200"
            onPress={() => toggleSection('followers')}
            activeOpacity={0.7}
          >
            <View className="flex-row items-center">
              <MaterialIcons name="people-outline" size={22} color="#111827" style={{ marginRight: 12 }} />
              <Text className="text-gray-900 text-base font-medium">Followers & Following</Text>
            </View>
            <MaterialIcons
              name={expandedSection === 'followers' ? 'expand-less' : 'expand-more'}
              size={24}
              color="#6B7280"
            />
          </TouchableOpacity>

          <CollapsibleSection expanded={expandedSection === 'followers'}>
            <View className="pb-6 pt-2">
              <DataSelection<'public' | 'private'>
                label="Who can see your followers list"
                value={followersVisibility}
                onSelect={(value) => {
                  setLoadingFollowersVisibility(true);
                  authAPI.updateUser({ followersVisibility: value }).then((res) => {
                    if (res.success && res.user) {
                      setUser(res.user);
                      setFollowersVisibility(value);
                    }
                  }).finally(() => setLoadingFollowersVisibility(false));
                }}
                options={[
                  { value: 'public', label: 'Public' },
                  { value: 'private', label: 'Private' },
                ]}
                disabled={loadingFollowersVisibility}
              />
              <View className="mt-4">
              <DataSelection<'public' | 'private'>
                label="Who can see your following list"
                value={followingVisibility}
                onSelect={(value) => {
                  setLoadingFollowingVisibility(true);
                  authAPI.updateUser({ followingVisibility: value }).then((res) => {
                    if (res.success && res.user) {
                      setUser(res.user);
                      setFollowingVisibility(value);
                    }
                  }).finally(() => setLoadingFollowingVisibility(false));
                }}
                options={[
                  { value: 'public', label: 'Public' },
                  { value: 'private', label: 'Private' },
                ]}
                disabled={loadingFollowingVisibility}
              />
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

