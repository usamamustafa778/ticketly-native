import React, { useEffect, useRef } from 'react';
import { View, Animated, Easing, StyleSheet } from 'react-native';
import { EventCardSkeleton } from './EventCardSkeleton';

export const UserProfileSkeleton: React.FC = () => {
  const opacity = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.65,
          duration: 800,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.ease),
        }),
        Animated.timing(opacity, {
          toValue: 0.35,
          duration: 800,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.ease),
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <View style={styles.container}>
      {/* Banner */}
      <Animated.View style={[styles.banner, { opacity }]} />

      {/* White card below banner */}
      <View style={styles.card}>
        {/* Avatar overlapping + name row */}
        <View style={styles.headerRow}>
          <Animated.View style={[styles.avatar, { opacity }]} />
          <View style={styles.nameBlock}>
            <Animated.View style={[styles.nameLine, { opacity }]} />
            <Animated.View style={[styles.usernameLine, { opacity }]} />
          </View>
        </View>

        {/* Stats: followers • following • events */}
        <View style={styles.statsRow}>
          <Animated.View style={[styles.statChip, { opacity }]} />
          <Animated.View style={[styles.statChip, { opacity }]} />
          <Animated.View style={[styles.statChipShort, { opacity }]} />
        </View>

        {/* Button placeholder */}
        <Animated.View style={[styles.button, { opacity }]} />

        {/* Tabs row */}
        <View style={styles.tabsRow}>
          <Animated.View style={[styles.tab, { opacity }]} />
          <Animated.View style={[styles.tab, { opacity }]} />
          <Animated.View style={[styles.tab, { opacity }]} />
        </View>
      </View>

      {/* Event grid: 2 columns of skeletons */}
      <View style={styles.grid}>
        {[0, 1, 2].map((row) => (
          <View key={row} style={styles.gridRow}>
            <View style={styles.gridItem}>
              <EventCardSkeleton />
            </View>
            <View style={styles.gridItem}>
              <EventCardSkeleton />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  banner: {
    width: '100%',
    height: 160,
    backgroundColor: '#E5E7EB',
  },
  card: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: -20,
    paddingHorizontal: 16,
    paddingBottom: 8,
    borderTopWidth: 1,
    borderColor: '#E5E7EB',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginTop: -32,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#E5E7EB',
    borderWidth: 4,
    borderColor: '#fff',
  },
  nameBlock: {
    flex: 1,
    marginLeft: 16,
    marginBottom: 4,
  },
  nameLine: {
    height: 22,
    width: '70%',
    borderRadius: 6,
    backgroundColor: '#E5E7EB',
    marginBottom: 6,
  },
  usernameLine: {
    height: 14,
    width: '50%',
    borderRadius: 4,
    backgroundColor: '#E5E7EB',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 8,
  },
  statChip: {
    height: 14,
    width: 72,
    borderRadius: 4,
    backgroundColor: '#E5E7EB',
  },
  statChipShort: {
    height: 14,
    width: 48,
    borderRadius: 4,
    backgroundColor: '#E5E7EB',
  },
  button: {
    height: 40,
    borderRadius: 999,
    backgroundColor: '#E5E7EB',
    marginTop: 16,
  },
  tabsRow: {
    flexDirection: 'row',
    marginTop: 20,
    marginBottom: 12,
    gap: 8,
  },
  tab: {
    flex: 1,
    height: 32,
    borderRadius: 6,
    backgroundColor: '#E5E7EB',
  },
  grid: {
    paddingHorizontal: 4,
    paddingBottom: 24,
  },
  gridRow: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: 4,
  },
  gridItem: {
    flex: 1,
  },
});
