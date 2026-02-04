// Zustand store for app state management
import { create } from 'zustand';
import { User, Event } from '@/data/mockData';
import { authAPI } from '@/lib/api/auth';
import { clearTokens } from '@/lib/api/client';
import type { UserProfile } from '@/lib/api/auth';

interface AppState {
  user: UserProfile | null;
  events: Event[];
  isAuthenticated: boolean;
  notificationUnreadCount: number;
  setUser: (user: UserProfile | null) => void;
  setEvents: (events: Event[]) => void;
  setNotificationUnreadCount: (count: number) => void;
  toggleEventLike: (eventId: string, userId: string) => void;
  registerForEvent: (eventId: string, userId: string) => void;
  unregisterFromEvent: (eventId: string, userId: string) => void;
  addEvent: (event: Event) => void;
  login: (user: UserProfile) => void;
  logout: () => Promise<void>;
}

export const useAppStore = create<AppState>((set) => ({
  user: null,
  events: [],
  isAuthenticated: false,
  notificationUnreadCount: 0,

  setUser: (user) => set({ user }),

  setEvents: (events) => set({ events }),

  setNotificationUnreadCount: (count) => set({ notificationUnreadCount: count }),
  
  toggleEventLike: (eventId, userId) => set((state) => ({
    events: state.events.map((event) =>
      event.id === eventId
        ? {
            ...event,
            likedUsers: event.likedUsers.includes(userId)
              ? event.likedUsers.filter((id) => id !== userId)
              : [...event.likedUsers, userId],
          }
        : event
    ),
  })),
  
  registerForEvent: (eventId, userId) => set((state) => ({
    events: state.events.map((event) =>
      event.id === eventId
        ? {
            ...event,
            registeredUsers: event.registeredUsers.includes(userId)
              ? event.registeredUsers
              : [...event.registeredUsers, userId],
          }
        : event
    ),
  })),
  
  unregisterFromEvent: (eventId, userId) => set((state) => ({
    events: state.events.map((event) =>
      event.id === eventId
        ? {
            ...event,
            registeredUsers: event.registeredUsers.filter((id) => id !== userId),
          }
        : event
    ),
  })),
  
  addEvent: (event) => set((state) => ({
    events: [event, ...state.events],
  })),
  
  login: (user) => set({ user, isAuthenticated: true }),
  
  logout: async () => {
    try {
      await authAPI.clearProfileCache();
      await clearTokens();
      set({ user: null, isAuthenticated: false, events: [], notificationUnreadCount: 0 });
    } catch (error) {
      console.error('Logout error:', error);
      set({ user: null, isAuthenticated: false, events: [], notificationUnreadCount: 0 });
    }
  },
}));

