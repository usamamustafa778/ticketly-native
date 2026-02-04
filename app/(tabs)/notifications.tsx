import React, { useState, useCallback } from 'react';
import {
  View,
  FlatList,
  Text,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { notificationsAPI, type NotificationItem } from '@/lib/api/notifications';
import { getEventImageUrl, getProfileImageUrl } from '@/lib/utils/imageUtils';
import { useBottomPadding } from '@/hooks/useBottomPadding';
import { useAppStore } from '@/store/useAppStore';

function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function NotificationRow({
  item,
  onPress,
}: {
  item: NotificationItem;
  onPress: () => void;
}) {
  const actorName =
    item.actorUserId?.fullName || item.actorUserId?.username || 'Someone';
  const eventTitle = item.eventId?.title;
  const avatarUrl = getProfileImageUrl({
    profileImageUrl: item.actorUserId?.profileImage ?? null,
  });
  const eventImageUrl = item.eventId
    ? getEventImageUrl({ image: item.eventId.image })
    : null;

  return (
    <Pressable
      onPress={onPress}
      className={`flex-row items-center gap-3 px-4 py-3 border-b border-gray-100 ${
        item.read ? 'bg-white' : 'bg-red-50/30'
      }`}
      android_ripple={{ color: 'rgba(0,0,0,0.05)' }}
    >
      <View className="w-10 h-10 rounded-full overflow-hidden bg-gray-200 items-center justify-center">
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} className="w-full h-full" resizeMode="cover" />
        ) : (
          <MaterialIcons name="person" size={22} color="#9CA3AF" />
        )}
      </View>
      <View className="flex-1 min-w-0">
        <Text
          numberOfLines={2}
          className={`text-[15px] ${item.read ? 'text-gray-700' : 'text-gray-900 font-semibold'}`}
        >
          {item.title || item.body || `${actorName} — ${item.type}`}
        </Text>
        <Text className="text-gray-500 text-xs mt-0.5" numberOfLines={1}>
          {formatTimeAgo(item.createdAt)}
        </Text>
      </View>
      {eventImageUrl && (
        <View className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100">
          <Image source={{ uri: eventImageUrl }} className="w-full h-full" resizeMode="cover" />
        </View>
      )}
      {!item.read && (
        <View className="w-2 h-2 rounded-full bg-red-500" />
      )}
    </Pressable>
  );
}

export default function NotificationsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const bottomPadding = useBottomPadding();
  const user = useAppStore((state) => state.user);

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);

  const fetchData = useCallback(async (isRefreshing = false) => {
    if (!user?._id) {
      setNotifications([]);
      setUnreadCount(0);
      setLoading(false);
      return;
    }
    try {
      if (isRefreshing) setRefreshing(true);
      else setLoading(true);
      const [listRes, countRes] = await Promise.all([
        notificationsAPI.list({ limit: 50 }),
        notificationsAPI.unreadCount(),
      ]);
      if (listRes.success && listRes.notifications) {
        setNotifications(listRes.notifications);
      }
      if (countRes.success && typeof countRes.count === 'number') {
        setUnreadCount(countRes.count);
      }
    } catch (e) {
      // keep previous data on error
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?._id]);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  const handleNotificationPress = async (item: NotificationItem) => {
    if (!item.read) {
      try {
        await notificationsAPI.markAsRead(item._id);
        setNotifications((prev) =>
          prev.map((n) =>
            n._id === item._id ? { ...n, read: true } : n
          )
        );
        setUnreadCount((c) => Math.max(0, c - 1));
      } catch (_) {}
    }
    if (item.eventId?._id) {
      router.push(`/event-details/${item.eventId._id}`);
    } else if (item.actorUserId?._id) {
      router.push(`/user/${item.actorUserId._id}`);
    }
  };

  const handleMarkAllRead = async () => {
    if (unreadCount === 0) return;
    try {
      setMarkingAll(true);
      await notificationsAPI.markAllAsRead();
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, read: true, readAt: n.readAt || new Date().toISOString() }))
      );
      setUnreadCount(0);
    } catch (_) {}
    finally {
      setMarkingAll(false);
    }
  };

  if (!user?._id) {
    return (
      <View className="flex-1 bg-white justify-center items-center px-6">
        <MaterialIcons name="notifications-none" size={48} color="#D1D5DB" />
        <Text className="text-gray-600 text-center mt-4">
          Sign in to see your notifications
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-white">
      <View
        className="px-4 py-3 flex-row items-center justify-between bg-white border-b border-gray-100 z-10"
        style={{ paddingTop: insets.top + 8 }}
      >
        <Text className="text-lg font-bold text-gray-900">Notifications</Text>
        {unreadCount > 0 && (
          <TouchableOpacity
            onPress={handleMarkAllRead}
            disabled={markingAll}
            className="flex-row items-center gap-1 px-3 py-1.5 rounded-full bg-red-100"
          >
            {markingAll ? (
              <ActivityIndicator size="small" color="#DC2626" />
            ) : (
              <>
                <MaterialIcons name="done-all" size={18} color="#DC2626" />
                <Text className="text-red-600 text-sm font-medium">Mark all read</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View className="flex-1 justify-center items-center py-20">
          <ActivityIndicator size="large" color="#DC2626" />
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item._id}
          contentContainerStyle={{
            paddingBottom: bottomPadding + 16,
            flexGrow: 1,
          }}
          renderItem={({ item }) => (
            <NotificationRow item={item} onPress={() => handleNotificationPress(item)} />
          )}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchData(true)}
              tintColor="#DC2626"
              colors={['#DC2626']}
            />
          }
          ListEmptyComponent={
            <View className="flex-1 items-center justify-center py-20 px-6">
              <MaterialIcons name="notifications-none" size={56} color="#E5E7EB" />
              <Text className="text-gray-500 text-base font-medium mt-4">
                No notifications yet
              </Text>
              <Text className="text-gray-400 text-sm mt-2 text-center">
                When you get updates, they'll show up here.
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}
