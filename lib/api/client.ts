import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../config';
import { triggerSessionExpired } from './sessionExpired';

const ACCESS_TOKEN_KEY = 'accessToken';
const REFRESH_TOKEN_KEY = 'refreshToken';

// Create axios instance
const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  // Don't set default Content-Type here - let the interceptor handle it
  // This prevents issues with FormData uploads
  timeout: 60000, // 60 seconds timeout (file uploads need more time)
  withCredentials: false, // Set to false for CORS (credentials handled via Authorization header)
  // IMPORTANT:
  // Do NOT override validateStatus here. We want 401 responses to be treated
  // as errors so the response interceptor can trigger the refresh-token flow.
});

// Request interceptor to add access token
apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    // Log request for debugging
    if (__DEV__) {
      console.log('📤 Making request:', {
        method: config.method?.toUpperCase(),
        url: config.url,
        baseURL: config.baseURL,
        fullURL: `${config.baseURL}${config.url}`,
      });
    }

    const accessToken = await AsyncStorage.getItem(ACCESS_TOKEN_KEY);
    if (accessToken && config.headers) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    
    // Handle Content-Type based on request data type
    if (config.data instanceof FormData) {
      // For FormData, remove Content-Type completely - let axios/browser set it with boundary
      if (config.headers) {
        delete config.headers['Content-Type'];
        delete config.headers['content-type'];
      }
    } else if (config.headers) {
      // For non-FormData requests, set Content-Type to application/json
      // Only if it's not already set and if there's data to send
      if (config.data && !config.headers['Content-Type'] && !config.headers['content-type']) {
        config.headers['Content-Type'] = 'application/json';
      }
    }
    
    return config;
  },
  (error: AxiosError) => {
    console.error('❌ Request interceptor error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor to handle token refresh
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: unknown) => void;
  reject: (reason?: unknown) => void;
}> = [];

const processQueue = (error: AxiosError | null, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  
  failedQueue = [];
};

apiClient.interceptors.response.use(
  (response) => {
    if (__DEV__) {
      console.log('✅ Response received:', {
        status: response.status,
        url: response.config.url,
      });
    }
    return response;
  },
  async (error: AxiosError) => {
    // Log error details for debugging
    if (__DEV__) {
      console.error('❌ Response error:', {
        message: error.message,
        code: error.code,
        status: error.response?.status,
        url: error.config?.url,
        baseURL: error.config?.baseURL,
        fullURL: error.config ? `${error.config.baseURL}${error.config.url}` : 'unknown',
      });
    }

    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // Don't try refresh for auth routes that don't use access token (login, signup, verify-otp)
    const url = originalRequest?.url ?? '';
    const isAuthRoute = /\/auth\/(login|signup|verify-otp)/.test(url);
    if (isAuthRoute) {
      return Promise.reject(error);
    }

    // If error is 401 and we haven't retried yet → refresh token and retry (all other APIs that need login)
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        // If already refreshing, queue this request
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${token}`;
            }
            return apiClient(originalRequest);
          })
          .catch((err) => {
            return Promise.reject(err);
          });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = await AsyncStorage.getItem(REFRESH_TOKEN_KEY);

      if (!refreshToken) {
        processQueue(error, null);
        isRefreshing = false;
        await AsyncStorage.multiRemove([ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY]);
        (error as any).isSessionExpired = true;
        triggerSessionExpired();
        return Promise.reject(error);
      }

      try {
        const response = await axios.post(`${API_BASE_URL}/auth/refresh-token`, {
          refreshToken,
        });

        const data = response?.data ?? {};
        const newAccessToken = data.accessToken ?? data.data?.accessToken;
        const newRefreshToken = data.refreshToken ?? data.data?.refreshToken;

        if (!newAccessToken || !newRefreshToken) {
          throw new Error('Invalid refresh response');
        }

        await AsyncStorage.multiSet([
          [ACCESS_TOKEN_KEY, newAccessToken],
          [REFRESH_TOKEN_KEY, newRefreshToken],
        ]);

        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        }

        processQueue(null, newAccessToken);
        isRefreshing = false;

        return apiClient(originalRequest);
      } catch (refreshError: any) {
        processQueue(refreshError as AxiosError, null);
        isRefreshing = false;
        await AsyncStorage.multiRemove([ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY]);
        const err = refreshError?.response?.data?.message
          ? new Error(refreshError.response.data.message)
          : refreshError;
        (err as any).isSessionExpired = true;
        triggerSessionExpired();
        return Promise.reject(err);
      }
    }

    return Promise.reject(error);
  }
);

// Helper functions to manage tokens
export const setTokens = async (accessToken: string, refreshToken: string) => {
  await AsyncStorage.multiSet([
    [ACCESS_TOKEN_KEY, accessToken],
    [REFRESH_TOKEN_KEY, refreshToken],
  ]);
};

export const clearTokens = async () => {
  try {
    // Remove tokens individually to ensure they're cleared
    await Promise.all([
      AsyncStorage.removeItem(ACCESS_TOKEN_KEY),
      AsyncStorage.removeItem(REFRESH_TOKEN_KEY),
    ]);
    
    // Also try multiRemove as backup
    await AsyncStorage.multiRemove([ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY]).catch(() => {
      // Ignore error if items don't exist
    });
    
    // Verify tokens are removed
    const [accessToken, refreshToken] = await Promise.all([
      AsyncStorage.getItem(ACCESS_TOKEN_KEY),
      AsyncStorage.getItem(REFRESH_TOKEN_KEY),
    ]);
    
    // If tokens still exist, force remove them
    if (accessToken) {
      await AsyncStorage.removeItem(ACCESS_TOKEN_KEY);
    }
    if (refreshToken) {
      await AsyncStorage.removeItem(REFRESH_TOKEN_KEY);
    }
    
    // Final check - if still present, clear all storage
    const [finalAccessToken, finalRefreshToken] = await Promise.all([
      AsyncStorage.getItem(ACCESS_TOKEN_KEY),
      AsyncStorage.getItem(REFRESH_TOKEN_KEY),
    ]);
    
    if (finalAccessToken || finalRefreshToken) {
      console.warn('Tokens still exist, clearing all storage');
      await AsyncStorage.clear();
    }
  } catch (error) {
    console.error('Error clearing tokens:', error);
    // Force clear all storage on any error
    try {
      await AsyncStorage.clear();
    } catch (clearError) {
      console.error('Error clearing all storage:', clearError);
    }
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return await AsyncStorage.getItem(ACCESS_TOKEN_KEY);
};

export const getRefreshToken = async (): Promise<string | null> => {
  return await AsyncStorage.getItem(REFRESH_TOKEN_KEY);
};

export default apiClient;

