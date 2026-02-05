import AsyncStorage from '@react-native-async-storage/async-storage';
import apiClient from './client';
import { setTokens, clearTokens, getAccessToken } from './client';
import { Platform } from 'react-native';
import { API_BASE_URL } from '../config';

export const PROFILE_CACHE_KEY = 'auth_profile';

export interface SignupRequest {
  name: string;
  email: string;
  password: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  message: string;
  otpRequired?: boolean;
  tempToken?: string;
  accessToken?: string;
  refreshToken?: string;
  user?: {
    id: string;
    fullName: string;
    username?: string;
    email: string;
    bio?: string | null;
    authProvider?: string;
    role?: string;
    isVerified?: boolean;
    createdEvents?: string[];
    joinedEvents?: string[];
    likedEvents?: string[];
    createdAt?: string;
    updatedAt?: string;
  };
}

export interface VerifyOtpRequest {
  otp: string;
  tempToken: string;
}

export interface VerifyOtpResponse {
  success: boolean;
  message: string;
  accessToken: string;
  refreshToken: string;
  user: {
    _id: string;
    fullName: string;
    email: string;
    username?: string;
    phone?: string;
    companyName?: string;
    role?: string;
    bio?: string | null;
  };
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface RefreshTokenResponse {
  success: boolean;
  message: string;
  accessToken: string;
  refreshToken: string;
}

export interface JoinedEvent {
  event: {
    id: string;
    title: string;
    description: string;
    date: string;
    time: string;
    location: string;
    image?: string;
    email: string;
    phone: string;
    ticketPrice: number;
    totalTickets: number;
    status: string;
    createdBy?: {
      _id: string;
      fullName: string;
      username?: string;
      email: string;
    };
    createdAt: string;
    updatedAt: string;
  };
  tickets: Array<{
    id: string;
    eventId: string;
    username: string;
    email: string;
    phone: string;
    status: string;
    accessKey?: string;
    qrCodeUrl?: string;
    createdAt: string;
    updatedAt: string;
  }>;
}

export interface UserProfile {
  _id: string;
  id?: string;
  fullName: string;
  email: string;
  username?: string;
  phone?: string;
  companyName?: string;
  role?: string;
  bio?: string | null;
  profileImage?: string | null;
  profileImageUrl?: string | null;
   coverImageUrl?: string | null;
  createdEvents?: any[];
  joinedEvents?: string[] | JoinedEvent[]; // Can be IDs (from login) or full objects (from profile)
  likedEvents?: any[];
  likedEventsVisibility?: 'public' | 'private';
  followersVisibility?: 'public' | 'private';
  followingVisibility?: 'public' | 'private';
  followerCount?: number;
  followingCount?: number;
  followers?: PublicUserSummary[];
  following?: PublicUserSummary[];
  createdAt?: string;
  updatedAt?: string;
}

/** Minimal user for followers/following lists */
export interface PublicUserSummary {
  _id: string;
  fullName: string;
  username?: string;
  profileImageUrl?: string | null;
}

/** Public user profile by ID (no auth required) - username, profile image, created/joined/liked events, followers/following */
export interface PublicUserProfile {
  _id: string;
  id?: string;
  username?: string;
  fullName: string;
  bio?: string | null;
  profileImage?: string | null;
  profileImageUrl?: string | null;
  coverImageUrl?: string | null;
  companyName?: string | null;
  likedEventsVisibility?: 'public' | 'private';
  followersVisibility?: 'public' | 'private';
  followingVisibility?: 'public' | 'private';
  followerCount?: number;
  followingCount?: number;
  followers?: PublicUserSummary[];
  following?: PublicUserSummary[];
  isFollowing?: boolean;
  createdEvents?: any[];
  joinedEvents?: { event: any; tickets?: any[] }[];
  likedEvents?: any[];
}

// Auth API functions
export const authAPI = {
  // Signup
  signup: async (data: SignupRequest): Promise<{ success: boolean; message: string }> => {
    const response = await apiClient.post('/auth/signup', data);
    return response.data;
  },

  // Login (Step 1 - Send OTP)
  login: async (data: LoginRequest): Promise<LoginResponse> => {
    try {
      const response = await apiClient.post('/auth/login', data);
      return response.data;
    } catch (error: any) {
      // Handle network errors with helpful messages
      if (error.code === 'ERR_NETWORK' || error.message === 'Network Error' || error.message?.includes('Network')) {
        console.error('❌ Network Error Details:', {
          code: error.code,
          message: error.message,
          apiBaseUrl: API_BASE_URL,
          config: error.config?.url,
        });
        throw new Error(
          `Cannot connect to backend server at ${API_BASE_URL}. ` +
          `Please make sure the backend server is running on port 5001. ` +
          `If you're using a physical device, set EXPO_PUBLIC_LOCAL_IP in your .env file.`
        );
      }
      throw error;
    }
  },

  // Verify OTP (Step 2 - Complete Login)
  verifyOtp: async (data: VerifyOtpRequest): Promise<VerifyOtpResponse> => {
    const response = await apiClient.post('/auth/verify-otp', data);
    const result = response.data;
    
    // Save tokens after successful verification
    if (result.accessToken && result.refreshToken) {
      await setTokens(result.accessToken, result.refreshToken);
    }
    
    return result;
  },

  // Refresh Access Token
  refreshToken: async (refreshToken: string): Promise<RefreshTokenResponse> => {
    const response = await apiClient.post('/auth/refresh-token', { refreshToken });
    const result = response.data;
    
    // Save new tokens
    if (result.accessToken && result.refreshToken) {
      await setTokens(result.accessToken, result.refreshToken);
    }
    
    return result;
  },

  // Get User Profile (saves response to local storage for offline/cached display)
  getProfile: async (): Promise<{ success: boolean; user: UserProfile }> => {
    const response = await apiClient.get('/auth/profile');
    const data = response.data;
    if (data.success && data.user) {
      try {
        await AsyncStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(data));
      } catch (e) {
        console.warn('Failed to cache profile:', e);
      }
    }
    return data;
  },

  /** Get public user profile by ID (no auth required) - name, profile image, created/joined/liked events */
  getUserProfileById: async (userId: string): Promise<{ success: boolean; user: PublicUserProfile }> => {
    const response = await apiClient.get(`/users/${userId}/profile`);
    return response.data;
  },

  clearProfileCache: async (): Promise<void> => {
    try {
      await AsyncStorage.removeItem(PROFILE_CACHE_KEY);
    } catch (e) {
      console.warn('Failed to clear profile cache:', e);
    }
  },

  // Update User (Self Update)
  updateUser: async (data: {
    name?: string;
    email?: string;
    password?: string;
    bio?: string;
    likedEventsVisibility?: 'public' | 'private';
    followersVisibility?: 'public' | 'private';
    followingVisibility?: 'public' | 'private';
  }): Promise<{ success: boolean; message: string; user?: UserProfile }> => {
    const response = await apiClient.put('/auth/update', data);
    return response.data;
  },

  /** Follow a user (auth required) */
  followUser: async (userId: string): Promise<{ success: boolean; message: string; following: boolean; followerCount?: number }> => {
    const response = await apiClient.post(`/users/${userId}/follow`);
    return response.data;
  },

  /** Unfollow a user (auth required) */
  unfollowUser: async (userId: string): Promise<{ success: boolean; message: string; following: boolean; followerCount?: number }> => {
    const response = await apiClient.delete(`/users/${userId}/follow`);
    return response.data;
  },

  // Delete User
  deleteUser: async (): Promise<{ success: boolean; message: string }> => {
    const response = await apiClient.delete('/auth/delete');
    await clearTokens();
    return response.data;
  },

  // Upload Profile Image
  uploadProfileImage: async (imageUri: string): Promise<{ success: boolean; message: string; profileImageUrl: string; user?: UserProfile }> => {
    // Platform detection: Use Platform.OS as the primary check
    const isWeb = Platform.OS === 'web';

    // Create FormData for multipart/form-data upload
    const FormDataConstructor = (isWeb && typeof window !== 'undefined' && (window as any).FormData) 
      ? (window as any).FormData 
      : FormData;
    const formData = new FormDataConstructor();
    
    // Extract filename and MIME type from URI
    // CRITICAL: React Native URIs can be file:// or content://
    // content:// URIs don't have filenames, so we need a fallback
    let filename = 'image.jpg'; // default
    let type = 'image/jpeg'; // default
    
    // Try to extract filename from URI
    if (imageUri.includes('/')) {
      const uriParts = imageUri.split('/');
      const lastPart = uriParts[uriParts.length - 1];
      if (lastPart && lastPart.includes('.')) {
        filename = lastPart.split('?')[0]; // Remove query params
      }
    }
    
    // Determine MIME type from file extension
    // This is a fallback - ideally use type from expo-image-picker asset
    const ext = filename.split('.').pop()?.toLowerCase();
    if (ext === 'png') type = 'image/png';
    else if (ext === 'gif') type = 'image/gif';
    else if (ext === 'webp') type = 'image/webp';
    else if (ext === 'jpg' || ext === 'jpeg') type = 'image/jpeg';
    
    // For content:// URIs on Android, generate a proper filename
    if (imageUri.startsWith('content://')) {
      filename = `image_${Date.now()}.${ext || 'jpg'}`;
    }

    if (isWeb) {
      // 🌐 Web browser environment — keep using axios (already working)
      try {
        let blob: Blob;

        // Helper function to convert response to blob
        const responseToBlob = async (response: Response): Promise<Blob> => {
          if (typeof response.blob === 'function') {
            return await response.blob();
          }
          if (typeof response.arrayBuffer === 'function') {
            const arrayBuffer = await response.arrayBuffer();
            return new Blob([arrayBuffer], { type: response.headers.get('content-type') || type });
          }
          const text = await response.text();
          return new Blob([text], { type: response.headers.get('content-type') || type });
        };

        // Helper function to convert data URL to blob
        const dataURLToBlob = (dataURL: string): Blob => {
          const arr = dataURL.split(',');
          const mimeMatch = arr[0].match(/:(.*?);/);
          const mime = mimeMatch ? mimeMatch[1] : type;
          const bstr = atob(arr[1]);
          let n = bstr.length;
          const u8arr = new Uint8Array(n);
          while (n--) {
            u8arr[n] = bstr.charCodeAt(n);
          }
          return new Blob([u8arr], { type: mime });
        };

        // Handle different URI types
        if (imageUri.startsWith('data:')) {
          blob = dataURLToBlob(imageUri);
        } else if (imageUri.startsWith('blob:')) {
          const response = await fetch(imageUri);
          blob = await responseToBlob(response);
        } else if (imageUri.startsWith('http://') || imageUri.startsWith('https://')) {
          const response = await fetch(imageUri);
          blob = await responseToBlob(response);
        } else {
          const response = await fetch(imageUri);
          blob = await responseToBlob(response);
        }

        // Create a File object from the blob
        const file = new File([blob], filename, { type: blob.type || type });
        formData.append('image', file);

        console.log('🌐 Web FormData prepared for profile upload:', {
          hasFile: file instanceof File,
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
        });

        console.log('📤 Sending web upload request to:', '/auth/upload-profile-image');
        const response = await apiClient.post('/auth/upload-profile-image', formData, {
          timeout: 60000,
          maxContentLength: Infinity,
          maxBodyLength: Infinity,
          headers: {},
        });

        console.log('✅ Web upload successful:', {
          success: response.data?.success,
          profileImageUrl: response.data?.profileImageUrl,
        });

        return response.data;
      } catch (error: any) {
        console.error('❌ Web upload failed:', {
          message: error.message,
          code: error.code,
          response: error.response?.data,
          status: error.response?.status,
          requestUrl: error.config?.url,
          requestMethod: error.config?.method,
        });

        if (error.code === 'ERR_NETWORK' || error.message?.includes('Network')) {
          throw new Error('Network error. Please check your internet connection and ensure the backend server is running.');
        }
        if (error.response?.status === 400) {
          throw new Error(error.response.data?.message || 'Invalid image file. Please try a different image.');
        }
        if (error.response?.status === 413) {
          throw new Error('Image file is too large. Maximum size is 5MB.');
        }

        throw error;
      }
    }

    // 📱 React Native environment — use fetch instead of axios to avoid RN axios/FormData issues
    formData.append('image', {
      uri: imageUri,
      type,
      name: filename,
    } as any);

    console.log('📱 React Native FormData prepared for profile upload:', {
      fieldName: 'image',
      uri: imageUri.substring(0, 50) + '...',
      type,
      name: filename,
    });

    try {
      const accessToken = await getAccessToken();
      const url = `${API_BASE_URL}/auth/upload-profile-image`;

      console.log('📤 [RN] Sending upload request via fetch to:', url);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          // Do NOT set Content-Type; RN will set multipart boundary automatically
        },
        body: formData as any,
      });

      const responseText = await response.text();
      let data: any = null;

      try {
        data = responseText ? JSON.parse(responseText) : {};
      } catch (parseError) {
        console.warn('⚠️ [RN] Failed to parse JSON response for profile upload, raw text:', responseText);
        throw new Error('Unexpected response from server while uploading image.');
      }

      if (!response.ok) {
        console.error('❌ [RN] Upload HTTP error:', {
          status: response.status,
          body: data,
        });

        if (response.status === 400) {
          throw new Error(data?.message || 'Invalid image file. Please try a different image.');
        }
        if (response.status === 413) {
          throw new Error('Image file is too large. Maximum size is 5MB.');
        }

        throw new Error(data?.message || `Upload failed with status ${response.status}`);
      }

      console.log('✅ [RN] Profile upload successful:', {
        success: data?.success,
        profileImageUrl: data?.profileImageUrl,
      });

      return data;
    } catch (error: any) {
      console.error('❌ [RN] Upload failed via fetch:', {
        message: error?.message,
        name: error?.name,
      });

      if (error?.message?.includes('Network request failed')) {
        throw new Error('Network error. Please check your internet connection and ensure the backend server is running.');
      }

      throw error;
    }
  },

  // Upload Cover Image (same behavior as uploadProfileImage but different endpoint)
  uploadCoverImage: async (imageUri: string): Promise<{ success: boolean; message: string; coverImageUrl: string; user?: UserProfile }> => {
    const isWeb = Platform.OS === 'web';
    const FormDataConstructor = (isWeb && typeof window !== 'undefined' && (window as any).FormData)
      ? (window as any).FormData
      : FormData;
    const formData = new FormDataConstructor();

    let filename = 'image.jpg';
    let type = 'image/jpeg';

    if (imageUri.includes('/')) {
      const uriParts = imageUri.split('/');
      const lastPart = uriParts[uriParts.length - 1];
      if (lastPart && lastPart.includes('.')) {
        filename = lastPart.split('?')[0];
      }
    }

    const ext = filename.split('.').pop()?.toLowerCase();
    if (ext === 'png') type = 'image/png';
    else if (ext === 'gif') type = 'image/gif';
    else if (ext === 'webp') type = 'image/webp';
    else if (ext === 'jpg' || ext === 'jpeg') type = 'image/jpeg';

    if (imageUri.startsWith('content://')) {
      filename = `image_${Date.now()}.${ext || 'jpg'}`;
    }

    if (isWeb) {
      try {
        let blob: Blob;
        const responseToBlob = async (response: Response): Promise<Blob> => {
          if (typeof response.blob === 'function') return await response.blob();
          if (typeof response.arrayBuffer === 'function') {
            const arrayBuffer = await response.arrayBuffer();
            return new Blob([arrayBuffer], { type: response.headers.get('content-type') || type });
          }
          const text = await response.text();
          return new Blob([text], { type: response.headers.get('content-type') || type });
        };

        const dataURLToBlob = (dataURL: string): Blob => {
          const arr = dataURL.split(',');
          const mimeMatch = arr[0].match(/:(.*?);/);
          const mime = mimeMatch ? mimeMatch[1] : type;
          const bstr = atob(arr[1]);
          let n = bstr.length;
          const u8arr = new Uint8Array(n);
          while (n--) u8arr[n] = bstr.charCodeAt(n);
          return new Blob([u8arr], { type: mime });
        };

        if (imageUri.startsWith('data:')) {
          blob = dataURLToBlob(imageUri);
        } else {
          const response = await fetch(imageUri);
          blob = await responseToBlob(response);
        }

        const file = new File([blob], filename, { type: blob.type || type });
        formData.append('image', file);

        const response = await apiClient.post('/auth/upload-cover-image', formData, {
          timeout: 60000,
          maxContentLength: Infinity,
          maxBodyLength: Infinity,
          headers: {},
        });
        return response.data;
      } catch (error: any) {
        if (error.code === 'ERR_NETWORK' || error.message?.includes('Network')) {
          throw new Error('Network error. Please check your internet connection and ensure the backend server is running.');
        }
        if (error.response?.status === 400) {
          throw new Error(error.response.data?.message || 'Invalid image file. Please try a different image.');
        }
        if (error.response?.status === 413) {
          throw new Error('Image file is too large. Maximum size is 5MB.');
        }
        throw error;
      }
    }

    (formData as any).append('image', {
      uri: imageUri,
      type,
      name: filename,
    } as any);

    try {
      const accessToken = await getAccessToken();
      const url = `${API_BASE_URL}/auth/upload-cover-image`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: formData as any,
      });

      const responseText = await response.text();
      let data: any = null;
      try {
        data = responseText ? JSON.parse(responseText) : {};
      } catch {
        throw new Error('Unexpected response from server while uploading image.');
      }

      if (!response.ok) {
        if (response.status === 400) {
          throw new Error(data?.message || 'Invalid image file. Please try a different image.');
        }
        if (response.status === 413) {
          throw new Error('Image file is too large. Maximum size is 5MB.');
        }
        throw new Error(data?.message || `Upload failed with status ${response.status}`);
      }
      return data;
    } catch (error: any) {
      if (error?.message?.includes('Network request failed')) {
        throw new Error('Network error. Please check your internet connection and ensure the backend server is running.');
      }
      throw error;
    }
  },
};

