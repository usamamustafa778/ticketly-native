import apiClient from './client';
import { Platform } from 'react-native';
import { API_BASE_URL } from '../config';
import { getAccessToken } from './client';

export interface SubmitPaymentRequest {
  ticketId: string;
  method: string;
  screenshotUri: string; // Image URI from expo-image-picker
  // Note: amount is derived from ticket.event.ticketPrice on backend
}

export interface SubmitPaymentResponse {
  success: boolean;
  message: string;
  payment: {
    id: string;
    ticketId: string;
    amount: number;
    method: string;
    status: string;
    screenshotUrl: string;
    screenshotUrlFull: string;
    createdAt: string;
  };
  ticket: {
    id: string;
    status: string;
  };
}

export interface Payment {
  id: string;
  ticketId: string;
  eventId: string;
  userId: string;
  amount: number;
  method: string;
  status: 'pending' | 'approved' | 'rejected';
  screenshotUrl: string;
  createdAt: string;
  updatedAt: string;
}

// Payments API functions
export const paymentsAPI = {
  // Submit Payment with Screenshot
  // This function handles both Web and React Native FormData correctly
  // DO NOT manually set Content-Type header - axios handles it automatically
  // Amount is derived from ticket.event.ticketPrice on backend (source of truth)
  submitPayment: async (
    ticketId: string,
    method: string,
    screenshotUri: string
  ): Promise<SubmitPaymentResponse> => {
    // Validate inputs
    if (!ticketId || typeof ticketId !== 'string' || ticketId.trim() === '') {
      throw new Error('ticketId is required and must be a valid string');
    }
    if (!screenshotUri || typeof screenshotUri !== 'string') {
      throw new Error('screenshotUri is required');
    }

    // Platform detection: Use Platform.OS as the primary check
    // React Native polyfills provide window/File/Blob, so we can't rely on those
    // Only use web path when Platform.OS is explicitly 'web'
    const isWeb = Platform.OS === 'web';
    
    // Create FormData for multipart/form-data upload
    // In web, use native browser FormData (window.FormData); in React Native, use React Native's FormData
    const FormDataConstructor = (isWeb && typeof window !== 'undefined' && (window as any).FormData) 
      ? (window as any).FormData 
      : FormData;
    const formData = new FormDataConstructor();
    
    // Add text fields first (ticketId, method)
    // Amount is derived from ticket.event.ticketPrice on backend (source of truth)
    formData.append('ticketId', ticketId.trim());
    formData.append('method', (method || 'manual').trim());
    
    // Extract filename and MIME type from URI
    // CRITICAL: React Native URIs can be file:// or content://
    // content:// URIs don't have filenames, so we need a fallback
    let filename = 'screenshot.jpg'; // default
    let type = 'image/jpeg'; // default
    
    // Try to extract filename from URI
    if (screenshotUri.includes('/')) {
      const uriParts = screenshotUri.split('/');
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
    if (screenshotUri.startsWith('content://')) {
      filename = `payment_screenshot_${Date.now()}.${ext || 'jpg'}`;
    }
    
    // Minimal professional log: ticketId and screenshot presence
    console.log('💳 Payment submission:', {
      ticketId,
      hasScreenshot: !!screenshotUri,
    });
    
    if (isWeb) {
      // Web browser environment
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
        if (screenshotUri.startsWith('data:')) {
          blob = dataURLToBlob(screenshotUri);
        } else if (screenshotUri.startsWith('blob:')) {
          const response = await fetch(screenshotUri);
          blob = await responseToBlob(response);
        } else if (screenshotUri.startsWith('http://') || screenshotUri.startsWith('https://')) {
          const response = await fetch(screenshotUri);
          blob = await responseToBlob(response);
        } else {
          const response = await fetch(screenshotUri);
          blob = await responseToBlob(response);
        }
        
        // Create a File object from the blob
        const file = new File([blob], filename, { type: blob.type || type });
        // CRITICAL: Field name 'screenshot' must match Multer's field name in backend
        formData.append('screenshot', file);
        
        console.log('💳 Web FormData prepared:', {
          hasFile: file instanceof File,
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
        });
      } catch (error) {
        console.error('❌ Error processing screenshot for web upload:', error);
        throw new Error('Failed to process screenshot for upload: ' + (error instanceof Error ? error.message : 'Unknown error'));
      }
    } else {
      // 📱 React Native environment — use fetch instead of axios to avoid RN axios/FormData issues
      formData.append('screenshot', {
        uri: screenshotUri,
        type: type,
        name: filename,
      } as any);
      
      console.log('💳 React Native FormData prepared for payment upload:', {
        fieldName: 'screenshot',
        uri: screenshotUri.substring(0, 50) + '...',
        type,
        name: filename,
      });
    }

    // Make request with multipart/form-data
    if (isWeb) {
      // 🌐 Web: use axios (already working)
      try {
        console.log('💳 Sending payment submission request to:', '/payments');
        console.log('💳 Request URL will be:', API_BASE_URL + '/payments');
        
        const response = await apiClient.post('/payments', formData, {
          timeout: 60000, // 60 seconds timeout for file uploads
          maxContentLength: Infinity,
          maxBodyLength: Infinity,
          headers: {},
        });
        
        console.log('✅ Payment submission successful:', {
          success: response.data?.success,
          message: response.data?.message,
          paymentId: response.data?.payment?.id,
          ticketStatus: response.data?.ticket?.status,
        });
        
        return response.data;
      } catch (error: any) {
        console.error('❌ Payment submission failed:', {
          message: error.message,
          code: error.code,
          response: error.response?.data,
          status: error.response?.status,
          statusText: error.response?.statusText,
          requestUrl: error.config?.url,
          requestMethod: error.config?.method,
        });
        
        // Provide user-friendly error messages
        if (error.code === 'ERR_NETWORK' || error.message?.includes('Network')) {
          throw new Error('Network error. Please check your internet connection and ensure the backend server is running.');
        }
        if (error.response?.status === 400) {
          throw new Error(error.response.data?.message || 'Invalid payment data. Please check your ticket and try again.');
        }
        if (error.response?.status === 403) {
          throw new Error(error.response.data?.message || 'Access denied. This ticket does not belong to you.');
        }
        if (error.response?.status === 404) {
          throw new Error(error.response.data?.message || 'Ticket not found.');
        }
        if (error.response?.status === 413) {
          throw new Error('Screenshot file is too large. Maximum size is 5MB.');
        }
        if (error.response?.status === 401) {
          throw new Error('Authentication required. Please login again.');
        }
        
        throw error;
      }
    }

    // 📱 React Native: use fetch instead of axios
    try {
      const accessToken = await getAccessToken();
      const url = `${API_BASE_URL}/payments`;

      console.log('📤 [RN] Sending payment upload request via fetch to:', url);

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
        console.warn('⚠️ [RN] Failed to parse JSON response for payment upload, raw text:', responseText);
        throw new Error('Unexpected response from server while uploading payment screenshot.');
      }

      if (!response.ok) {
        console.error('❌ [RN] Payment upload HTTP error:', {
          status: response.status,
          body: data,
        });

        if (response.status === 400) {
          throw new Error(data?.message || 'Invalid payment data. Please check your ticket and try again.');
        }
        if (response.status === 403) {
          throw new Error(data?.message || 'Access denied. This ticket does not belong to you.');
        }
        if (response.status === 404) {
          throw new Error(data?.message || 'Ticket not found.');
        }
        if (response.status === 413) {
          throw new Error('Screenshot file is too large. Maximum size is 5MB.');
        }
        if (response.status === 401) {
          throw new Error('Authentication required. Please login again.');
        }

        throw new Error(data?.message || `Payment upload failed with status ${response.status}`);
      }

      console.log('✅ [RN] Payment upload successful:', {
        success: data?.success,
        message: data?.message,
        paymentId: data?.payment?.id,
        ticketStatus: data?.ticket?.status,
      });

      return data;
    } catch (error: any) {
      console.error('❌ [RN] Payment upload failed via fetch:', {
        message: error?.message,
      });

      if (error?.message?.includes('Network request failed')) {
        throw new Error('Network error. Please check your internet connection and ensure the backend server is running.');
      }

      throw error;
    }
  },

  // Get My Payments
  getMyPayments: async (): Promise<{ success: boolean; payments: Payment[] }> => {
    const response = await apiClient.get('/payments/my');
    return response.data;
  },

  // Get Payment by ID
  getPaymentById: async (paymentId: string): Promise<{ success: boolean; payment: Payment }> => {
    const response = await apiClient.get(`/payments/${paymentId}`);
    return response.data;
  },
};
