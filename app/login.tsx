import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Modal } from '@/components/Modal';
import { ButtonPrimary, ButtonSecondary } from '@/components/ui';
import { DataInput } from '@/components/ui/DataInput';
import { useAppStore } from '@/store/useAppStore';
import { authAPI } from '@/lib/api/auth';
import { getAccessToken, getRefreshToken, setTokens } from '@/lib/api/client';
import { API_BASE_URL } from '@/lib/config';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

export default function LoginScreen() {
  const router = useRouter();
  const login = useAppStore((state) => state.login);
  const setUser = useAppStore((state) => state.setUser);
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [loginMethod, setLoginMethod] = useState<'google' | 'email' | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [tempToken, setTempToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [otpError, setOtpError] = useState('');
  const [loginError, setLoginError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [alertConfig, setAlertConfig] = useState<{ title: string; message: string; variant: 'default' | 'success' | 'error' | 'info' }>({ title: '', message: '', variant: 'info' });

  // Silently check auth on mount - if already authenticated, redirect to home
  useEffect(() => {
    const checkAuth = async () => {
      const accessToken = await getAccessToken();
      if (accessToken) {
        // Try to get user profile to verify token is valid
        try {
          const response = await authAPI.getProfile();
          if (response.success && response.user) {
            // User is authenticated, login and redirect to tabs
            login(response.user);
            router.replace('/(tabs)');
            return;
          }
        } catch (error: any) {
          // If access token is expired, try refresh token
          if (error.response?.status === 401) {
            const refreshToken = await getRefreshToken();
            if (refreshToken) {
              try {
                const refreshResponse = await authAPI.refreshToken(refreshToken);
                if (refreshResponse.success) {
                  // Get profile with new token
                  const profileResponse = await authAPI.getProfile();
                  if (profileResponse.success && profileResponse.user) {
                    // User is authenticated, login and redirect to tabs
                    login(profileResponse.user);
                    router.replace('/(tabs)');
                    return;
                  }
                }
              } catch (refreshError) {
                // Refresh failed - user can stay on login page
                console.log('Token refresh failed');
              }
            }
          }
        }
      }
    };
    checkAuth();
  }, [login, router]);

  // Check for OAuth errors in URL params
  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location?.search || '');
      const error = params.get('error');
      
      if (error) {
        let errorMessage = 'Authentication failed';
        switch (error) {
          case 'authentication_failed':
            errorMessage = 'Google authentication failed. Please try again.';
            break;
          case 'profile_fetch_failed':
            errorMessage = 'Failed to fetch user profile. Please try again.';
            break;
          case 'auth_failed':
            errorMessage = 'Authentication error. Please try again.';
            break;
          case 'invalid_response':
            errorMessage = 'Invalid authentication response. Please try again.';
            break;
          case 'server_error':
            errorMessage = 'Server error. Please try again later.';
            break;
        }
        
        setAlertConfig({ title: 'Login Error', message: errorMessage, variant: 'error' });
        setShowAlertModal(true);
        
        // Clear the error from URL
        if (window.history) {
          window.history.replaceState({}, document.title, '/login');
        }
      }
    }
  }, []);

  const handleGoogleLogin = () => {
    // Get the backend URL (remove /api suffix for the auth route)
    const backendUrl = API_BASE_URL.replace('/api', '');
    const googleAuthUrl = `${backendUrl}/api/auth/google`;
    
    console.log('🔐 Initiating Google OAuth:', googleAuthUrl);
    
    // For web, redirect directly
    if (Platform.OS === 'web') {
      window.location.href = googleAuthUrl;
    } else {
      // For mobile, show info that it's web-only for now
      setAlertConfig({
        title: 'Google Login',
        message: 'Google OAuth is currently supported on web. Please use the web version or login with email/password.',
        variant: 'info',
      });
      setShowAlertModal(true);
      
      // TODO: For mobile OAuth, you would need to implement expo-auth-session
      // Example:
      // import * as WebBrowser from 'expo-web-browser';
      // WebBrowser.openAuthSessionAsync(googleAuthUrl, 'your-app://auth/callback');
    }
  };

  const handleSignup = async () => {
    // Clear previous error
    setErrorMessage('');

    if (!name || !email || !password) {
      setErrorMessage('Please fill in all fields');
      return;
    }

    if (password.length < 8) {
      setErrorMessage('Password must be at least 8 characters');
      return;
    }

    setLoading(true);
    try {
      const response = await authAPI.signup({ name, email, password });
      if (response.success) {
        // Automatically switch to login mode after successful signup
        // Clear name and password, keep email for convenience
        setName('');
        setPassword('');
        setErrorMessage('');
        setMode('login');
        setLoginMethod('email');

        setAlertConfig({
          title: 'Success',
          message: 'Account created successfully! Please login with your email and password.',
          variant: 'success',
        });
        setShowAlertModal(true);
      } else {
        // Show backend error message inline
        setErrorMessage(response.message || 'Failed to create account');
      }
    } catch (error: any) {
      // Extract error message from response and show inline
      const errorMsg = error.response?.data?.message || error.message || 'Failed to create account. Please try again.';
      setErrorMessage(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSubmit = async () => {
    // Clear previous error
    setLoginError('');

    if (!email || !password) {
      setLoginError('Please enter both email and password');
      return;
    }

    // Validate password length
    if (password.length < 8) {
      setLoginError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);
    try {
      const response = await authAPI.login({ email, password });
      if (response.success) {
        // Check if user is verified (has accessToken) or needs OTP (has tempToken)
        if (response.accessToken && response.refreshToken && response.user) {
          // User is verified - save tokens, set user in store, and redirect
          await setTokens(response.accessToken, response.refreshToken);
          // Transform user object to match UserProfile type (id -> _id)
          const userProfile = {
            ...response.user,
            _id: response.user.id,
          };
          login(userProfile);
          // Redirect to home page (tabs)
          router.replace('/(tabs)');
          // Populate profile cache in background so profile tab shows data from storage without waiting for API
          authAPI.getProfile().then((res) => {
            if (res.success && res.user) setUser(res.user);
          }).catch(() => {});
          // Note: No need to set loading to false as we're redirecting
        } else if (response.tempToken) {
          // User is not verified - show OTP form
          setLoginError('');
          setTempToken(response.tempToken);
          setOtpSent(true);
          setAlertConfig({
            title: 'OTP Sent',
            message: `OTP has been sent to ${email}. Please check your email.`,
            variant: 'success',
          });
          setShowAlertModal(true);
          setLoading(false);
        } else {
          // Show backend error message inline
          setLoginError(response.message || 'Login failed');
          setLoading(false);
        }
      } else {
        // Show backend error message inline
        setLoginError(response.message || 'Login failed');
        setLoading(false);
      }
    } catch (error: any) {
      // Handle network errors with helpful messages
      if (error.code === 'ERR_NETWORK' || error.message === 'Network Error' || error.message?.includes('Network')) {
        setLoginError('Cannot connect to backend server. Please make sure the backend is running on port 5001.');
        console.error('Network Error Details:', {
          code: error.code,
          message: error.message,
          apiBaseUrl: API_BASE_URL,
          config: error.config?.url,
        });
      } else {
        // Extract error message from response
        const errorMsg = error.response?.data?.message || error.response?.data?.error || error.message || 'Login failed. Please try again.';
        setLoginError(errorMsg);
      }
      setLoading(false);
    }
  };

  const handleOTPSubmit = async () => {
    // Clear previous error
    setOtpError('');

    if (!otp || otp.length !== 6) {
      setOtpError('Please enter a valid 6-digit OTP');
      return;
    }

    if (!tempToken) {
      setOtpError('Session expired. Please try logging in again.');
      setOtpSent(false);
      return;
    }

    setLoading(true);
    try {
      const response = await authAPI.verifyOtp({ otp, tempToken });
      if (response.success && response.user) {
        // User is now logged in with tokens saved
        setOtpError('');
        login(response.user);
        // Redirect to home page immediately after successful login
        router.replace('/(tabs)');
        // Populate profile cache in background so profile tab shows data from storage without waiting for API
        authAPI.getProfile().then((res) => {
          if (res.success && res.user) setUser(res.user);
        }).catch(() => {});
        // Note: No need to set loading to false as we're redirecting
      } else {
        // Show backend error message inline
        setOtpError(response.message || 'Failed to verify OTP');
        setLoading(false);
      }
    } catch (error: any) {
      // Extract error message from response
      const errorMsg = error.response?.data?.message || error.message || 'Failed to verify OTP. Please try again.';
      setOtpError(errorMsg);
      setLoading(false);
    }
  };

  const cardStyle = {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 } as const,
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 6,
  };

  // Signup Form
  if (mode === 'signup' && loginMethod === 'email' && !otpSent) {
    return (
      <KeyboardAvoidingView
        className="flex-1 bg-gray-100"
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView className="flex-1" contentContainerStyle={{ flexGrow: 1, padding: 24, justifyContent: 'center', alignItems: 'center' }}>
          <View
            className="w-full max-w-md bg-white rounded-2xl p-8"
            style={cardStyle}
          >
            <View className="items-center mb-8">
              <Text className="text-4xl font-bold text-gray-900 mb-2">ticketly</Text>
              <Text className="text-base text-gray-600 text-center">Create your account</Text>
            </View>

            <View className="w-full">
            <DataInput
              label="Full Name"
              placeholder="e.g. Fatima Ali"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              className="mb-2"
            />

            <DataInput
              label="Email"
              placeholder="e.g. fatimaali@gmail.com"
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                if (errorMessage) setErrorMessage('');
              }}
              error={errorMessage}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              className="mb-2"
            />

            <DataInput
              label="Password"
              placeholder="At least 8 characters"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showSignupPassword}
              autoCapitalize="none"
              rightElement={
                <TouchableOpacity
                  onPress={() => setShowSignupPassword(!showSignupPassword)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <MaterialIcons
                    name={showSignupPassword ? "visibility" : "visibility-off"}
                    size={20}
                    color="#9CA3AF"
                  />
                </TouchableOpacity>
              }
              className="mb-2"
            />

            <ButtonPrimary
              fullWidth
              loading={loading}
              disabled={loading}
              onPress={handleSignup}
              className="mb-3"
              size="lg"
            >
              Sign Up
            </ButtonPrimary>

            <TouchableOpacity
              className="items-center mb-3"
              onPress={() => {
                setMode('login');
                setName('');
                setEmail('');
                setPassword('');
                setErrorMessage('');
              }}
            >
              <Text className="text-primary text-sm font-semibold">Already have an account? Login</Text>
            </TouchableOpacity>

            <ButtonSecondary
              fullWidth
              onPress={() => {
                setLoginMethod(null);
                setName('');
                setEmail('');
                setPassword('');
                setErrorMessage('');
              }}
              size="lg"
            >
              Back
            </ButtonSecondary>
          </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // Login Form
  if (mode === 'login' && loginMethod === 'email' && !otpSent) {
    return (
      <KeyboardAvoidingView
        className="flex-1 bg-gray-100"
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView className="flex-1" contentContainerStyle={{ flexGrow: 1, padding: 24, justifyContent: 'center', alignItems: 'center' }}>
          <View
            className="w-full max-w-md bg-white rounded-2xl p-8"
            style={cardStyle}
          >
            <View className="items-center mb-8">
              <Text className="text-4xl font-bold text-gray-900 mb-2">ticketly</Text>
              <Text className="text-base text-gray-600 text-center">Login to your account</Text>
            </View>

            <View className="w-full">
            <DataInput
              label="Email"
              placeholder="e.g. fatimaali@gmail.com"
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                if (loginError) setLoginError('');
              }}
              error={loginError}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              className="mb-2"
            />

            <DataInput
              label="Password"
              placeholder="Enter your password"
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                if (loginError) setLoginError('');
              }}
              error={loginError}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              rightElement={
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <MaterialIcons
                    name={showPassword ? "visibility" : "visibility-off"}
                    size={20}
                    color="#9CA3AF"
                  />
                </TouchableOpacity>
              }
              className="mb-2"
            />

            <ButtonPrimary
              fullWidth
              loading={loading}
              disabled={loading}
              onPress={handleEmailSubmit}
              className="mb-3"
              size="lg"
            >
              Login
            </ButtonPrimary>

            <TouchableOpacity
              className="items-center mb-3"
              onPress={() => {
                setMode('signup');
                setEmail('');
                setPassword('');
                setLoginError('');
              }}
            >
              <Text className="text-primary text-sm font-semibold">Don&apos;t have an account? Sign Up</Text>
            </TouchableOpacity>

            <ButtonSecondary
              fullWidth
              onPress={() => {
                setLoginMethod(null);
                setEmail('');
                setPassword('');
                setLoginError('');
              }}
              size="lg"
            >
              Back
            </ButtonSecondary>
          </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  if (loginMethod === 'email' && otpSent) {
    return (
      <KeyboardAvoidingView
        className="flex-1 bg-gray-100"
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView className="flex-1" contentContainerStyle={{ flexGrow: 1, padding: 24, justifyContent: 'center', alignItems: 'center' }}>
          <View
            className="w-full max-w-md bg-white rounded-2xl p-8"
            style={cardStyle}
          >
            <View className="items-center mb-8">
              <Text className="text-4xl font-bold text-gray-900 mb-2">ticketly</Text>
              <Text className="text-base text-gray-600 text-center">
                {email ? `Enter the OTP sent to ${email}` : 'Enter the OTP sent to your email'}
              </Text>
            </View>

            <View className="w-full">
            <DataInput
              label="OTP"
              placeholder="Enter 6-digit OTP"
              value={otp}
              onChangeText={(text) => {
                setOtp(text);
                if (otpError) setOtpError('');
              }}
              error={otpError}
              keyboardType="number-pad"
              maxLength={6}
              className="mb-2"
            />

            <ButtonPrimary
              fullWidth
              loading={loading}
              disabled={loading}
              onPress={handleOTPSubmit}
              className="mb-3"
            >
              Verify OTP
            </ButtonPrimary>

            <TouchableOpacity
              className="items-center mb-3"
              onPress={() => {
                setOtpSent(false);
                setOtp('');
                setOtpError('');
              }}
            >
              <Text className="text-primary text-sm font-semibold">Resend OTP</Text>
            </TouchableOpacity>

            <ButtonSecondary
              fullWidth
              onPress={() => {
                setLoginMethod(null);
                setOtpSent(false);
                setOtp('');
                setEmail('');
                setPassword('');
                setName('');
                setTempToken('');
                setOtpError('');
              }}
              size="lg"
            >
              Back
            </ButtonSecondary>
          </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  return (
    <View className="flex-1 bg-gray-100">
      <ScrollView className="flex-1" contentContainerStyle={{ flexGrow: 1, padding: 24, justifyContent: 'center', alignItems: 'center' }}>
        <View
          className="w-full max-w-md bg-white rounded-2xl p-8"
          style={cardStyle}
        >
          <View className="items-center mb-8">
            <Text className="text-4xl font-bold text-gray-900 mb-2">ticketly</Text>
            <Text className="text-base text-gray-600 text-center">Login via google account to proceed.</Text>
          </View>

          <View className="gap-4 mb-8">
            <TouchableOpacity
              className="bg-white border border-gray-200 flex-row items-center justify-center py-4 px-6 rounded-xl"
              onPress={handleGoogleLogin}
              activeOpacity={0.8}
            >
              <Text className="text-2xl font-bold text-[#4285F4] mr-3">G</Text>
              <Text className="text-[#1F1F1F] text-base font-semibold">Sign in with Google</Text>
            </TouchableOpacity>

            <TouchableOpacity
              className="bg-gray-50 border border-gray-200 py-4 px-6 rounded-xl"
              onPress={() => {
                setLoginMethod('email');
                setMode('login');
              }}
              activeOpacity={0.8}
            >
              <Text className="text-gray-900 text-base font-semibold text-center">Login with Email</Text>
            </TouchableOpacity>

            <TouchableOpacity
              className="bg-primary py-4 px-6 rounded-xl"
              onPress={() => {
                setLoginMethod('email');
                setMode('signup');
              }}
              activeOpacity={0.8}
            >
              <Text className="text-white text-base font-semibold text-center">Sign Up with Email</Text>
            </TouchableOpacity>
          </View>

          <View className="border-t border-gray-100 pt-6">
            <View className="flex-row justify-center gap-6 mb-4">
              <Text className="text-[#9CA3AF] text-sm">Contact Us</Text>
              <Text className="text-[#9CA3AF] text-sm">Privacy Policy</Text>
              <Text className="text-[#9CA3AF] text-sm">Terms of Service</Text>
            </View>

            <View className="flex-row justify-center gap-3 mb-4">
              <TouchableOpacity className="bg-gray-100 w-10 h-10 rounded-lg items-center justify-center">
                <Text className="text-gray-900 text-base">in</Text>
              </TouchableOpacity>
              <TouchableOpacity className="bg-gray-100 w-10 h-10 rounded-lg items-center justify-center">
                <Text className="text-gray-900 text-base">📷</Text>
              </TouchableOpacity>
            </View>

            <Text className="text-[#6B7280] text-xs text-center">2025 Ticketly. All rights reserved.</Text>
          </View>
        </View>
      </ScrollView>

      <Modal
        visible={showAlertModal}
        onClose={() => setShowAlertModal(false)}
        title={alertConfig.title}
        message={alertConfig.message}
        primaryButtonText="OK"
        onPrimaryPress={() => setShowAlertModal(false)}
        variant={alertConfig.variant}
      />
    </View>
  );
}
