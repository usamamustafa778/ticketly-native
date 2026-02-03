import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Image, Modal, Pressable, ScrollView, Dimensions } from 'react-native';
import { Event } from '@/data/mockData';
import { useRouter } from 'expo-router';
import { getEventImageUrl } from '@/lib/utils/imageUtils';
import { Label } from '@/components/ui/Label';
import { LinearGradient } from 'expo-linear-gradient';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const DROPUP_HEIGHT = Math.min(SCREEN_HEIGHT * 0.5, 400);

interface EventCardProps {
  event: Event;
  onPress?: () => void;
}

type JoinedUser = {
  id?: string;
  _id?: string;
  name?: string;
  fullName?: string;
  avatarUrl?: string | null;
  profileImageUrl?: string | null;
};

export const EventCard: React.FC<EventCardProps> = ({ event, onPress }) => {
  const router = useRouter();
  const [joinedUsersDropUpVisible, setJoinedUsersDropUpVisible] = useState(false);

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      router.push(`/event-details/${event.id}`);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const month = date.toLocaleString('default', { month: 'short' });
    const day = date.getDate();
    return { month, day };
  };

  const { month, day } = formatDate(event.date);

  // Price / access label (handle optional price safely)
  const priceValue = typeof event.price === 'number' ? event.price : 0;
  const isFree = priceValue === 0;
  const priceLabel = isFree
    ? 'Free'
    : `Rs ${priceValue.toLocaleString('en-PK')}`;

  // Prepare attendee avatars (host + joined users). Use host profile image only, never event image.
  const hostAvatarUrl = event.hostAvatarUrl ?? null;
  const joinedUsers = event.joinedUsers || [];
  const joinedCount = event.joinedCount ?? joinedUsers.length ?? 0;
  const visibleJoined = joinedUsers.slice(0, 3);
  const remainingCount = Math.max(joinedCount - visibleJoined.length, 0);

  return (
    <TouchableOpacity
      className="rounded-md overflow-hidden w-full h-[220px] relative"
      onPress={handlePress}
      activeOpacity={0.8}
    >
      {/* Full background image */}
      <Image
        source={{ uri: getEventImageUrl(event) || 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=800' }}
        className="absolute inset-0 w-full h-full"
        resizeMode="cover"
      />

      {/* Gradient overlay from bottom (opaque) to top (transparent) */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.6)', 'rgba(0,0,0,0.85)', 'rgba(0,0,0,1)']}
        locations={[0, 0.35, 0.65, 1]}
        className="absolute bottom-0 w-full h-[60%]"
      />

      {/* Price pill at top-left */}
      <View className="absolute top-2 left-2">
        <Label variant={isFree ? 'neutral' : 'primary'} small>
          {priceLabel}
        </Label>
      </View>

      {/* Joined users avatars at top-right */}
      {(joinedUsers.length > 0 || joinedCount > 0) && (
        <View className="absolute top-2 right-2 flex-row items-center">
          {joinedUsers.length > 0 ? (
            <TouchableOpacity
              className="flex-row items-center"
              activeOpacity={0.9}
              onPress={(e) => {
                e?.stopPropagation?.();
                setJoinedUsersDropUpVisible(true);
              }}
            >
              {visibleJoined.map((user, index) => {
                const u = user as JoinedUser;
                return (
                  <Image
                    key={u.id || u._id || index}
                    source={{
                      uri:
                        u.avatarUrl ||
                        u.profileImageUrl ||
                        'https://images.unsplash.com/photo-1494797710133-75adf6c1f4a3?w=200',
                    }}
                    className="w-6 h-6 rounded-full border-[0.5px] border-white"
                    style={{ marginLeft: index === 0 ? 0 : -8 }}
                    resizeMode="cover"
                  />
                );
              })}
              {remainingCount > 0 && (
                <View className="ml-1 px-1.5 py-[2px] rounded-full bg-black/70">
                  <Text className="text-white text-[9px] font-medium">
                    +{remainingCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          ) : joinedCount > 0 ? (
            <TouchableOpacity
              className="rounded-full bg-black/70 px-2 py-1"
              activeOpacity={0.9}
              onPress={(e) => {
                e?.stopPropagation?.();
                setJoinedUsersDropUpVisible(true);
              }}
            >
              <Text className="text-white text-[9px] font-medium">
                {joinedCount} going
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      )}

      {/* Content at bottom */}
      <View className="absolute bottom-0 left-0 right-0 p-3">
        {/* Date & time row */}
        <Text className="text-gray-300 text-[10px] mb-1">
          {new Date(event.date).toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'short',
          })}{' '}
          {event.time}
        </Text>
        <Text className="text-white text-[14px] font-semibold mb-2" numberOfLines={1}>
          {event.title}
        </Text>

        {/* Host row */}
        {(() => {
          const ev = event as any;
          const organizerId = ev.organizerId || ev.createdBy?._id || ev.createdBy?.id || '';
          const showHostRow = ev.organizerName || ev.createdBy?.fullName || organizerId;
          if (!showHostRow) return null;
          const HostContent = () => (
            <View className="flex-row items-center gap-2">
              <Image
                source={{
                  uri: hostAvatarUrl || 'https://images.unsplash.com/photo-1494797710133-75adf6c1f4a3?w=200',
                }}
                className="w-6 h-6 rounded-full border-[0.5px] border-white"
                resizeMode="cover"
              />
              <View>
                <Text className="text-white text-[11px] font-semibold max-w-[100px]" numberOfLines={1}>
                  {event.organizerName || 'Host'}
                </Text>
                <Text className="text-gray-400 text-[9px]">(Host)</Text>
              </View>
            </View>
          );
          return organizerId ? (
            <TouchableOpacity
              className="flex-row items-center"
              onPress={(e) => {
                (e as any)?.stopPropagation?.();
                router.push(`/user/${organizerId}`);
              }}
              activeOpacity={0.8}
            >
              <HostContent />
            </TouchableOpacity>
          ) : (
            <View className="flex-row items-center">
              <HostContent />
            </View>
          );
        })()}
      </View>

      {/* Joined users drop-up (bottom to middle) */}
      <Modal
        visible={joinedUsersDropUpVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setJoinedUsersDropUpVisible(false)}
      >
        <Pressable
          className="flex-1 justify-end bg-black/50"
          onPress={() => setJoinedUsersDropUpVisible(false)}
        >
          <Pressable
            className="bg-[#1F1F1F] rounded-t-2xl border-t border-[#374151]"
            style={{ minHeight: DROPUP_HEIGHT, maxHeight: DROPUP_HEIGHT }}
            onPress={(e) => e.stopPropagation()}
          >
            {/* Handle bar */}
            <View className="items-center pt-2 pb-1">
              <View className="w-10 h-1 rounded-full bg-[#4B5563]" />
            </View>
            <Text className="text-white text-sm font-semibold px-4 pb-2">
              Joined ({joinedCount > 0 ? joinedCount : joinedUsers.length})
            </Text>
            <ScrollView
              className="flex-1 px-4 pb-6"
              showsVerticalScrollIndicator={false}
            >
              {joinedUsers.length === 0 && joinedCount > 0 ? (
                <Text className="text-[#9CA3AF] text-sm py-4">No attendee list available</Text>
              ) : null}
              {joinedUsers.map((user: JoinedUser, index: number) => (
                <TouchableOpacity
                  key={user.id || user._id || `user-${index}`}
                  className="flex-row items-center py-3 border-b border-[#374151]/50"
                  onPress={() => {
                    const uid = user.id || user._id;
                    if (uid) {
                      setJoinedUsersDropUpVisible(false);
                      router.push(`/user/${uid}`);
                    }
                  }}
                  activeOpacity={user.id || user._id ? 0.7 : 1}
                  disabled={!user.id && !user._id}
                >
                  <Image
                    source={{
                      uri:
                        user.avatarUrl ||
                        user.profileImageUrl ||
                        'https://images.unsplash.com/photo-1494797710133-75adf6c1f4a3?w=200',
                    }}
                    className="w-6 h-6 rounded-full bg-[#374151]"
                    resizeMode="cover"
                  />
                  <Text className="text-white text-base font-medium ml-3 flex-1" numberOfLines={1}>
                    {user.name || user.fullName || 'User'}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </TouchableOpacity>
  );
};

