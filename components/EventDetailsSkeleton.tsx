import React, { useEffect, useRef } from 'react';
import { View, Animated, Easing, StyleSheet } from 'react-native';

export const EventDetailsSkeleton: React.FC = () => {
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
      {/* Header Image */}
      <Animated.View style={[styles.imageBlock, { opacity }]} />

      {/* Event Info Card */}
      <View style={styles.card}>
        {/* Title + Like row */}
        <View style={styles.titleRow}>
          <Animated.View style={[styles.titleLine1, { opacity }]} />
          <Animated.View style={[styles.likeButton, { opacity }]} />
        </View>

        {/* Date & Time */}
        <View style={styles.infoRow}>
          <Animated.View style={[styles.iconBox, { opacity }]} />
          <View style={styles.infoContent}>
            <Animated.View style={[styles.labelLine, { opacity }]} />
            <Animated.View style={[styles.valueLine, { opacity }]} />
          </View>
        </View>

        {/* Location */}
        <View style={styles.infoRow}>
          <Animated.View style={[styles.iconBox, { opacity }]} />
          <View style={styles.infoContent}>
            <Animated.View style={[styles.labelLine, { opacity }]} />
            <Animated.View style={[styles.valueLine, { opacity }]} />
          </View>
        </View>

        {/* Price */}
        <View style={styles.infoRow}>
          <Animated.View style={[styles.iconBox, { opacity }]} />
          <View style={styles.infoContent}>
            <Animated.View style={[styles.labelLine, { opacity }]} />
            <Animated.View style={[styles.valueLine, { opacity }]} />
          </View>
        </View>

        {/* Register Button */}
        <Animated.View style={[styles.registerButton, { opacity }]} />
      </View>

      {/* Description section */}
      <View style={styles.section}>
        <Animated.View style={[styles.sectionTitle, { opacity }]} />
        <Animated.View style={[styles.descLine1, { opacity }]} />
        <Animated.View style={[styles.descLine2, { opacity }]} />
        <Animated.View style={[styles.descLine3, { opacity }]} />
      </View>
    </View>
  );
};

const SKELETON_BG = '#F3F4F6';
const SKELETON_BG_ALT = '#E5E7EB';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  imageBlock: {
    width: '100%',
    height: 300,
    backgroundColor: SKELETON_BG,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 12,
    marginTop: -20,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: '#E5E7EB',
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  titleLine1: {
    height: 28,
    width: '75%',
    borderRadius: 6,
    backgroundColor: SKELETON_BG,
  },
  likeButton: {
    width: 56,
    height: 36,
    borderRadius: 12,
    backgroundColor: SKELETON_BG,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  iconBox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    backgroundColor: SKELETON_BG,
    marginRight: 12,
    marginTop: 2,
  },
  infoContent: {
    flex: 1,
  },
  labelLine: {
    height: 12,
    width: '40%',
    borderRadius: 4,
    backgroundColor: SKELETON_BG,
    marginBottom: 8,
  },
  valueLine: {
    height: 14,
    width: '70%',
    borderRadius: 4,
    backgroundColor: SKELETON_BG_ALT,
  },
  registerButton: {
    height: 52,
    borderRadius: 12,
    backgroundColor: SKELETON_BG,
    marginTop: 8,
  },
  section: {
    padding: 20,
    borderTopWidth: 1,
    borderColor: '#E5E7EB',
  },
  sectionTitle: {
    height: 24,
    width: '50%',
    borderRadius: 6,
    backgroundColor: SKELETON_BG,
    marginBottom: 12,
  },
  descLine1: {
    height: 14,
    width: '100%',
    borderRadius: 4,
    backgroundColor: SKELETON_BG_ALT,
    marginBottom: 8,
  },
  descLine2: {
    height: 14,
    width: '90%',
    borderRadius: 4,
    backgroundColor: SKELETON_BG_ALT,
    marginBottom: 8,
  },
  descLine3: {
    height: 14,
    width: '65%',
    borderRadius: 4,
    backgroundColor: SKELETON_BG_ALT,
  },
});
