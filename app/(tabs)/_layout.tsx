import { HapticTab } from '@/components/HapticTab';
import TabBarBackground from '@/components/ui/TabBarBackground';
import { useColorScheme } from '@/hooks/useColorScheme';
import { CREATE_EVENT_DRAFT_KEY } from '@/app/(tabs)/create/create-event';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Tabs, useRouter } from 'expo-router';
import React from 'react';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';

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
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#DC2626',
        tabBarInactiveTintColor: '#6B7280',
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
          paddingTop: 4,
          elevation: 0,
          marginBottom: Platform.OS === 'android' ? 38 : 0,
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Discover',
          tabBarIcon: ({ color }) => (
            <MaterialIcons name="explore" size={20} color={color} />
          ),
        }}
      />
         <Tabs.Screen
        name="explore"
        options={{
          title: 'Search',
          tabBarIcon: ({ color }) => (
            <MaterialIcons name="search" size={20} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="create"
        options={{
          title: 'Create',
          tabBarIcon: ({ color }) => (
            <MaterialIcons name="add-circle-outline" size={20} color={color} />
          ),
          tabBarButton: CreateTabButton,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => (
            <MaterialIcons name="person-outline" size={20} color={color} />
          ),
        }}
      />
   
    </Tabs>
  );
}
