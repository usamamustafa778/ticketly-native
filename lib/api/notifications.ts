// Use same API base as auth, events, tickets (explicit baseURL so requests never use 8081)
import apiClient from './client';
import { API_BASE_URL } from '../config';

export interface NotificationItem {
  _id: string;
  type: string;
  read: boolean;
  readAt: string | null;
  title: string;
  body: string;
  eventId?: {
    _id: string;
    title?: string;
    image?: string;
    date?: string;
    time?: string;
    location?: string;
  } | null;
  actorUserId?: {
    _id: string;
    fullName?: string;
    username?: string;
    profileImage?: string;
  } | null;
  extra?: Record<string, unknown> | null;
  createdAt: string;
}

export interface NotificationsResponse {
  success: boolean;
  notifications: NotificationItem[];
  pagination?: { page: number; limit: number; total: number };
}

const apiConfig = { baseURL: API_BASE_URL };

export const notificationsAPI = {
  list: (params?: { read?: 'true' | 'false'; page?: number; limit?: number }) =>
    apiClient
      .get<NotificationsResponse>('/notifications', { ...apiConfig, params })
      .then((r) => r.data),

  unreadCount: () =>
    apiClient
      .get<{ success: boolean; count: number }>('/notifications/unread-count', apiConfig)
      .then((r) => r.data),

  markAsRead: (id: string) =>
    apiClient
      .patch<{ success: boolean; notification: NotificationItem }>(
        `/notifications/${id}/read`,
        undefined,
        apiConfig
      )
      .then((r) => r.data),

  markAllAsRead: () =>
    apiClient
      .patch<{ success: boolean; modifiedCount: number }>(
        '/notifications/read-all',
        undefined,
        apiConfig
      )
      .then((r) => r.data),
};
