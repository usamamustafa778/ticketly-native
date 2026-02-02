import React, { useState } from 'react';
import { View, Text, Image, Platform, LayoutChangeEvent } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import QRCode from 'react-native-qrcode-svg';
import type { TicketTheme } from '@/lib/types/ticketTheme';
import { mergeTicketTheme } from '@/lib/types/ticketTheme';
import { getEventImageUrl } from '@/lib/utils/imageUtils';
import { BackgroundPattern } from '@/components/BackgroundPattern';

interface PreviewEvent {
  title?: string;
  description?: string;
  date?: string;
  time?: string;
  location?: string;
  ticketPrice?: number;
  image?: string;
  imageUrl?: string;
}

interface TicketPreviewProps {
  theme?: Partial<TicketTheme> | null;
  event?: PreviewEvent | null;
  /** Preview mode: show sample data for theme editor */
  preview?: boolean;
  /** For real ticket: username, email, status, accessKey, createdAt */
  username?: string;
  email?: string;
  status?: string;
  accessKey?: string;
  createdAt?: string;
}

function formatDateShort(dateString?: string) {
  if (!dateString) return 'Feb 28, 2026';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatTimestamp(dateString?: string) {
  if (!dateString) return 'Friday, 30 January 2026 at 19:31:21 pm GMT+5';
  const date = new Date(dateString);
  return date.toLocaleString('en-PK', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    timeZoneName: 'short',
  });
}

function getStatusColor(status: string) {
  const m: Record<string, string> = {
    confirmed: '#10B981',
    pending_payment: '#DC2626',
    payment_in_review: '#3B82F6',
    used: '#6B7280',
    cancelled: '#DC2626',
  };
  return m[status] ?? '#9CA3AF';
}

function getStatusBgColor(status: string) {
  const m: Record<string, string> = {
    confirmed: '#10B9814D',
    pending_payment: '#DC26264D',
    payment_in_review: '#3B82F64D',
    used: '#6B72804D',
    cancelled: '#DC26264D',
  };
  return m[status] ?? '#9CA3AF4D';
}

function getStatusText(status: string) {
  const m: Record<string, string> = {
    confirmed: 'CONFIRMED',
    pending_payment: 'PENDING PAYMENT',
    payment_in_review: 'IN REVIEW',
    used: 'USED',
    cancelled: 'CANCELLED',
  };
  return m[status] ?? (status || '').toUpperCase().replace(/_/g, ' ');
}

export function TicketPreview({
  theme,
  event,
  preview = false,
  username = 'hamzaaliabbasi3237',
  email = 'hamzaaliabbasi3237@gmail.com',
  status = 'payment_in_review',
  accessKey,
  createdAt,
}: TicketPreviewProps) {
  const t = mergeTicketTheme(theme);
  const ev = event || {};
  const title = ev.title || 'MUSIC FESTIVAL 2026';
  const description =
    ev.description?.slice(0, 50) ||
    'Join us for an unforgettable night at F-9 Park fea...';
  const location = ev.location || 'F-9 Park, Islamabad, Islamabd';
  const date = ev.date || '2026-02-28';
  const time = ev.time || '18:00';
  const price = ev.ticketPrice ?? 3000;
  const displayStatus = preview ? 'payment_in_review' : status;
  const displayAccessKey = accessKey || (preview ? undefined : accessKey);
  const eventImageUrl = getEventImageUrl(ev);
  const bgElement = t.backgroundElement ?? 'none';

  const [layout, setLayout] = useState({ width: 320, height: 340 });
  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width > 0 && height > 0) setLayout({ width, height });
  };

  // LinearGradient expects { x, y } for start/end. "to right bottom" => start (0,0) end (1,1)
  const [start, end] = (() => {
    const d = t.gradientDirection || 'to right bottom';
    if (d.includes('right') && d.includes('bottom')) return [{ x: 0, y: 0 }, { x: 1, y: 1 }];
    if (d.includes('right')) return [{ x: 0, y: 0.5 }, { x: 1, y: 0.5 }];
    if (d.includes('bottom')) return [{ x: 0.5, y: 0 }, { x: 0.5, y: 1 }];
    return [{ x: 0, y: 0 }, { x: 1, y: 1 }];
  })();

  return (
    <View
      className="rounded-xl overflow-hidden border border-gray-200"
      style={{ elevation: 8, shadowColor: '#000' }}
      onLayout={onLayout}
    >
      <LinearGradient
        colors={[t.gradientStart, t.gradientEnd]}
        start={start}
        end={end}
        style={{
          padding: 16,
          borderRadius: 12,
          minHeight: 320,
        }}
      >
        <BackgroundPattern
          element={bgElement}
          width={layout.width}
          height={layout.height}
          patternWeight={t.patternWeight ?? 'medium'}
          overlayColor={
            (() => {
              const g = (t.gradientStart || '').toLowerCase().replace('#', '');
              const isLightBg = g === 'ffffff' || g === 'fff';
              return isLightBg ? `${t.accentColor}1F` : 'rgba(255,255,255,0.08)';
            })()
          }
        />
        {/* Header: Event image thumbnail, logo, title, description */}
        <View className="flex-row mb-3">
          {eventImageUrl ? (
            <Image
              source={{ uri: eventImageUrl }}
              className="w-14 h-14 rounded-lg mr-3"
              resizeMode="cover"
            />
          ) : (
            <View
              className="w-14 h-14 rounded-lg mr-3 items-center justify-center"
              style={{ backgroundColor: `${t.accentColor}15`, borderWidth: 1, borderColor: `${t.accentColor}40` }}
            >
              <Text className="text-xs" style={{ color: t.primaryTextColor }}>IMG</Text>
            </View>
          )}
          <View className="flex-1">
            <Text
              className="text-lg font-bold tracking-wide mb-0.5"
              style={{ color: t.brandColor }}
            >
              ticketly
            </Text>
            <Text
              className="text-[18px] font-bold uppercase tracking-wide"
              style={{ color: t.primaryTextColor }}
              numberOfLines={1}
            >
              {title}
            </Text>
            <Text
              className="text-[11px] mt-0.5"
              style={{ color: t.primaryTextColor, opacity: 0.9 }}
              numberOfLines={2}
            >
              {description}
            </Text>
          </View>
        </View>

        <View
          className="h-px my-2.5 border-dashed"
          style={{ borderColor: t.accentColor, borderTopWidth: 2 }}
        />

        {/* Event details */}
        <View className="gap-1">
          <Text
            className="text-[12px]"
            style={{ color: t.primaryTextColor }}
          >
            USER: {username}
          </Text>
          <Text
            className="text-[12px]"
            style={{ color: t.primaryTextColor }}
            numberOfLines={1}
          >
            EMAIL: {email}
          </Text>
          <Text
            className="text-[12px] mt-1"
            style={{ color: t.primaryTextColor }}
          >
            LOCATION: {location}
          </Text>
        </View>

        {/* Date, Time, Price + Status stamp + QR */}
        <View className="flex-row justify-between items-start mt-3">
          <View>
            <Text
              className="text-[12px] leading-5"
              style={{ color: t.primaryTextColor }}
            >
              • Date: {formatDateShort(date)}
            </Text>
            <Text
              className="text-[12px] leading-5"
              style={{ color: t.primaryTextColor }}
            >
              • Time: {time}
            </Text>
            <Text
              className="text-[12px] leading-5"
              style={{ color: t.primaryTextColor }}
            >
              • Price: {price.toLocaleString()} PKR
            </Text>
          </View>
          <View className="relative">
            <View
              className="border border-dashed py-1.5 px-2 rounded"
              style={{
                borderColor: getStatusColor(displayStatus),
                backgroundColor: getStatusBgColor(displayStatus),
                transform: [{ rotate: '-8deg' }],
              }}
            >
              <Text
                className="text-[10px] font-bold"
                style={{ color: getStatusColor(displayStatus) }}
              >
                {getStatusText(displayStatus)}
              </Text>
            </View>
          </View>
          {displayStatus === 'confirmed' && displayAccessKey ? (
            <View
              className="p-1.5 rounded-lg ml-2"
              style={{ backgroundColor: 'rgba(255,255,255,0.95)' }}
            >
              <QRCode value={displayAccessKey} size={56} color="#1F1F1F" backgroundColor="#FFFFFF" />
            </View>
          ) : (
            <View
              className="ml-2 p-2 rounded-lg min-w-[56px] min-h-[56px] items-center justify-center"
              style={{ backgroundColor: `${t.accentColor}15`, borderWidth: 1, borderColor: `${t.accentColor}40` }}
            >
              <Text
                className="text-[9px] text-center"
                style={{ color: t.primaryTextColor }}
              >
                QR after confirm
              </Text>
            </View>
          )}
        </View>

        <View
          className="h-px my-2.5 border-dashed"
          style={{ borderColor: t.accentColor, borderTopWidth: 2 }}
        />

        {/* Footer */}
        {createdAt && (
          <Text
            className="text-[10px] mb-1"
            style={{ color: t.primaryTextColor, opacity: 0.8 }}
          >
            {formatTimestamp(createdAt)}
          </Text>
        )}
        {displayStatus === 'confirmed' && displayAccessKey ? (
          <Text
            className="text-[10px] font-semibold"
            style={{ color: t.accentColor }}
          >
            ACCESS KEY: {displayAccessKey}
          </Text>
        ) : (
          <Text
            className="text-[10px] italic"
            style={{ color: t.primaryTextColor, opacity: 0.8 }}
          >
            Access key is given after payment confirmed
          </Text>
        )}
      </LinearGradient>
    </View>
  );
}
