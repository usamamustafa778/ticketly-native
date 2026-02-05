// API Configuration
// Environment-based API base URL configuration
// 
// To configure, create a .env file in the root directory with:
// EXPO_PUBLIC_API_BASE_URL=http://YOUR_IP:5001/api
//
// Environment options:
// - LOCAL: http://YOUR_LOCAL_IP:5001/api (for physical devices)
// - EMULATOR: http://10.0.2.2:5001/api (for Android emulator)
// - SIMULATOR: http://localhost:5001/api (for iOS simulator)
// - WEB: http://localhost:5001/api (for web browser)
// - PRODUCTION: https://ticketlybackend-production.up.railway.app/api
//
// To find your local IP:
// - Windows: ipconfig | findstr "IPv4"
// - Mac/Linux: ifconfig | grep "inet "

import { Platform } from 'react-native';

// Environment types
type Environment = 'local' | 'staging' | 'production';

// Get environment from env variable or default to 'production' for builds
const getEnvironment = (): Environment => {
  const env = process.env.EXPO_PUBLIC_ENV || (__DEV__ ? 'local' : 'production');
  return env as Environment;
};

// Get API base URL based on environment and platform
const getApiBaseUrl = (): string => {
  const env = getEnvironment();

  // If explicitly set via EXPO_PUBLIC_API_BASE_URL, use it (highest priority)
  if (process.env.EXPO_PUBLIC_API_BASE_URL) {
    return process.env.EXPO_PUBLIC_API_BASE_URL;
  }

  // Production environment
  if (env === 'production') {
    return 'https://ticketly-backend-oem4.onrender.com/api';
  }

  // Staging environment (if you have one)
  if (env === 'staging') {
    return process.env.EXPO_PUBLIC_STAGING_URL || 'https://ticketlybackend-staging.up.railway.app/api';
  }

  // Local development - platform-specific defaults
  if (Platform.OS === 'web') {
    // Web browser - use localhost
    return 'http://localhost:5001/api';
  }

  if (Platform.OS === 'android') {
    // Android - check if running on emulator or physical device
    // Emulator uses 10.0.2.2, physical device needs actual IP
    const localIp = process.env.EXPO_PUBLIC_LOCAL_IP || 'localhost';
    if (localIp === 'localhost') {
      // Assume emulator
      return 'http://10.0.2.2:5001/api';
    }
    // Physical device - use provided IP
    return `http://${localIp}:5001/api`;
  }

  if (Platform.OS === 'ios') {
    // iOS - simulator uses localhost, physical device needs actual IP
    const localIp = process.env.EXPO_PUBLIC_LOCAL_IP || 'localhost';
    return `http://${localIp}:5001/api`;
  }

  // Fallback
  return 'http://localhost:5001/api';
};
// /
// Use the environment-aware function for automatic URL detection
// export const API_BASE_URL = getApiBaseUrl();
// Or hardcode production URL for all devices:
// export const API_BASE_URL = "https://ticketly-backend-oem4.onrender.com/api";
export const API_BASE_URL = "http://localhost:5001/api";


// Log the API URL being used (for debugging)
if (__DEV__) {
  console.log('🌐 Environment:', getEnvironment());
  console.log('🌐 API Base URL:', API_BASE_URL);
  console.log('🌐 Platform:', Platform.OS);
  console.log('🌐 Local IP:', process.env.EXPO_PUBLIC_LOCAL_IP || 'not set (using default)');

  // Warn if using localhost on mobile (won't work on physical devices)
  if (Platform.OS !== 'web' && API_BASE_URL.includes('localhost') && !API_BASE_URL.includes('10.0.2.2')) {
    console.warn('⚠️  WARNING: Using localhost on mobile. This will NOT work on physical devices!');
    console.warn('⚠️  Set EXPO_PUBLIC_LOCAL_IP or EXPO_PUBLIC_API_BASE_URL in .env file');
  }
}
