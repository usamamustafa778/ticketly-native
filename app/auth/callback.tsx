import { useEffect } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAppStore } from '@/store/useAppStore';
import { setTokens } from '@/lib/api/client';
import { authAPI } from '@/lib/api/auth';

export default function AuthCallback() {
  const router = useRouter();
  const login = useAppStore((state) => state.login);
  const params = useLocalSearchParams();

  useEffect(() => {
    const handleCallback = async () => {
      const { accessToken, refreshToken, success, error } = params;

      console.log('🔐 OAuth Callback received:', { success, error, hasAccessToken: !!accessToken });

      if (error) {
        console.error('❌ OAuth error:', error);
        router.replace(`/login?error=${error}`);
        return;
      }

      if (success && accessToken && refreshToken) {
        try {
          // Store tokens
          await setTokens(
            accessToken as string,
            refreshToken as string
          );

          console.log('✅ Tokens stored successfully');

          // Get user profile
          const response = await authAPI.getProfile();
          if (response.success && response.user) {
            console.log('✅ User profile fetched:', response.user.email);
            
            // Login and redirect to home - Google users are pre-verified, no OTP needed!
            login(response.user);
            router.replace('/(tabs)');
          } else {
            console.error('❌ Failed to fetch profile');
            router.replace('/login?error=profile_fetch_failed');
          }
        } catch (err) {
          console.error('❌ Error handling OAuth callback:', err);
          router.replace('/login?error=auth_failed');
        }
      } else {
        console.error('❌ Invalid callback response');
        router.replace('/login?error=invalid_response');
      }
    };

    handleCallback();
  }, [params, login, router]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#FF6B6B" />
      <Text style={styles.text}>Completing sign in...</Text>
      <Text style={styles.subtext}>Please wait while we log you in</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  text: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  subtext: {
    marginTop: 8,
    fontSize: 14,
    color: '#666',
  },
});

