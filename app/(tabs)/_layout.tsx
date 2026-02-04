import { HapticTab } from '@/components/HapticTab';
import TabBarBackground from '@/components/ui/TabBarBackground';
import { useColorScheme } from '@/hooks/useColorScheme';
import { CREATE_EVENT_DRAFT_KEY } from '@/app/(tabs)/create/create-event';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Tabs, useRouter } from 'expo-router';
import React, { useEffect } from 'react';
import { Platform } from 'react-native';
import type { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { useAppStore } from '@/store/useAppStore';
import { notificationsAPI } from '@/lib/api/notifications';

function CreateTabButton(props: BottomTabBarButtonProps) {
  const router = useRouter();
  return (
    <HapticTab
      {...props}
      onPress={(e) => {
        AsyncStorage.getItem(CREATE_EVENT_DRAFT_KEY).then((draft) => {
          if (draft) {
            router.push('/create/create-event');
          } else {
            props.onPress?.(e);
          }
        });
      }}
    />
  );
}

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const notificationUnreadCount = useAppStore((s) => s.notificationUnreadCount);
  const user = useAppStore((s) => s.user);

  // Fetch unread count when tabs mount (user logged in) so badge shows without opening notifications
  useEffect(() => {
    if (!user?._id) return;
    notificationsAPI
      .unreadCount()
      .then((res) => res.success && typeof res.count === 'number' && useAppStore.getState().setNotificationUnreadCount(res.count))
      .catch(() => {});
  }, [user?._id]);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#DC2626',
        tabBarInactiveTintColor: '#212121',
        tabBarShowLabel: false,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarBackground: TabBarBackground,
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopWidth: 1,
          borderTopColor: '#E5E7EB',
          height: Platform.OS === 'ios' ? 56 : 52,
          paddingBottom: 36,
          paddingHorizontal: 4,
          paddingTop: 4,
          elevation: 0,
          marginBottom: Platform.OS === 'android' ? 2 : 0,
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Discover',
          tabBarIcon: ({ color }) => (
            <MaterialIcons name="explore" size={24} color={color} />
          ),
        }}
      />
         <Tabs.Screen
        name="explore"
        options={{
          title: 'Search',
          tabBarIcon: ({ color }) => (
            <MaterialIcons name="search" size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="create"
        options={{
          title: 'Create',
          tabBarIcon: ({ color }) => (
            <MaterialIcons name="add-circle-outline" size={24} color={color} />
          ),
          tabBarButton: CreateTabButton,
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: 'Notifications',
          tabBarBadge: notificationUnreadCount > 0 ? notificationUnreadCount : undefined,
          tabBarIcon: ({ color }) => (
            <MaterialIcons name="notifications" size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="liked"
        options={{
          title: 'Liked',
          href: null,
        }}
      />
       <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => (
            <MaterialIcons name="person-outline" size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="user/[id]"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
