import apiClient from './client';
import { Event, EventsResponse, EventResponse } from './events';

// Admin API functions
export const adminAPI = {
  // Get Pending Events (Admin only)
  getPendingEvents: async (): Promise<EventsResponse> => {
    const response = await apiClient.get('/admin/events/pending');
    return response.data;
  },

  // Approve Event (Admin only)
  approveEvent: async (id: string): Promise<EventResponse> => {
    const response = await apiClient.put(`/admin/events/${id}/approve`);
    return response.data;
  },
};

