import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Line, Path } from 'react-native-svg';
import type { BackgroundElement, PatternWeight } from '@/lib/types/ticketTheme';

interface BackgroundPatternProps {
  element: BackgroundElement;
  width: number;
  height: number;
  /** Sharper = smaller/lighter, Thicker = larger/bolder */
  patternWeight?: PatternWeight;
  /** Overlay color - typically accent or white with low opacity */
  overlayColor?: string;
}

const defaultOverlay = 'rgba(255,255,255,0.08)';

const WEIGHT_MULTIPLIER: Record<PatternWeight, number> = {
  sharper: 0.6,
  sharp: 0.8,
  thin: 1,
  medium: 1.2,
  thick: 1.5,
  thicker: 1.9,
};

/** Organic (Music) - flowing sound-wave inspired waves + soft blobs */
function OrganicBlobs({ width, height, overlayColor, sizeMult }: { width: number; height: number; overlayColor: string; sizeMult: number }) {
  const strokeW = 2 * sizeMult;
  const op = 0.5;
  return (
    <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
      <Path
        d={`M -10 ${height * 0.2} Q ${width * 0.2} ${height * 0.35} ${width * 0.4} ${height * 0.15} T ${width * 0.8} ${height * 0.3} T ${width + 10} ${height * 0.2}`}
        fill="none"
        stroke={overlayColor}
        strokeWidth={strokeW}
        opacity={op}
      />
      <Path
        d={`M -10 ${height * 0.5} Q ${width * 0.25} ${height * 0.35} ${width * 0.5} ${height * 0.55} T ${width * 0.85} ${height * 0.4} T ${width + 10} ${height * 0.55}`}
        fill="none"
        stroke={overlayColor}
        strokeWidth={strokeW}
        opacity={op}
      />
      <Path
        d={`M -10 ${height * 0.78} Q ${width * 0.3} ${height * 0.6} ${width * 0.55} ${height * 0.85} T ${width * 0.9} ${height * 0.7} T ${width + 10} ${height * 0.82}`}
        fill="none"
        stroke={overlayColor}
        strokeWidth={strokeW}
        opacity={op}
      />
      <Path
        d={`M ${width * 0.15} ${height + 10} C ${width * 0.15} ${height * 0.6} ${width * 0.5} ${height * 0.4} ${width * 0.5} ${height * 0.7} C ${width * 0.85} ${height * 0.65} ${width * 0.85} ${height + 10} ${width * 0.15} ${height + 10} Z`}
        fill={overlayColor}
        opacity={0.35}
      />
    </Svg>
  );
}

/** Flowing liquid waves - smooth bezier paths with fill */
function FluidWaves({ width, height, overlayColor, sizeMult }: { width: number; height: number; overlayColor: string; sizeMult: number }) {
  return (
    <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
      <Path
        d={`M -20 ${height * 0.25} C ${width * 0.2} ${height * 0.1} ${width * 0.5} ${height * 0.35} ${width + 20} ${height * 0.2} L ${width + 20} ${height + 20} L -20 ${height + 20} Z`}
        fill={overlayColor}
        opacity={0.45}
      />
      <Path
        d={`M -20 ${height * 0.55} C ${width * 0.3} ${height * 0.45} ${width * 0.65} ${height * 0.7} ${width + 20} ${height * 0.5} L ${width + 20} ${height + 20} L -20 ${height + 20} Z`}
        fill={overlayColor}
        opacity={0.4}
      />
      <Path
        d={`M -20 ${height * 0.8} C ${width * 0.25} ${height * 0.65} ${width * 0.55} ${height * 0.9} ${width + 20} ${height * 0.75} L ${width + 20} ${height + 20} L -20 ${height + 20} Z`}
        fill={overlayColor}
        opacity={0.42}
      />
      <Path
        d={`M -20 ${height * 0.35} Q ${width * 0.25} ${height * 0.2} ${width * 0.5} ${height * 0.4} T ${width + 20} ${height * 0.3}`}
        fill="none"
        stroke={overlayColor}
        strokeWidth={1.5 * sizeMult}
        opacity={0.5}
      />
      <Path
        d={`M -20 ${height * 0.65} Q ${width * 0.35} ${height * 0.55} ${width * 0.6} ${height * 0.75} T ${width + 20} ${height * 0.6}`}
        fill="none"
        stroke={overlayColor}
        strokeWidth={1.2 * sizeMult}
        opacity={0.45}
      />
    </Svg>
  );
}

/** Gradient mesh (Aesthetic) - flowing interconnected waves */
function GradientMeshBlobs({ width, height, overlayColor, sizeMult }: { width: number; height: number; overlayColor: string; sizeMult: number }) {
  const strokeW = 1.5 * sizeMult;
  const op = 0.48;
  return (
    <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
      <Path
        d={`M -20 ${height * 0.15} C ${width * 0.3} ${height * 0.05} ${width * 0.6} ${height * 0.25} ${width + 20} ${height * 0.12} L ${width + 20} ${height + 20} L -20 ${height + 20} Z`}
        fill={overlayColor}
        opacity={0.38}
      />
      <Path
        d={`M -20 ${height * 0.45} C ${width * 0.2} ${height * 0.35} ${width * 0.7} ${height * 0.55} ${width + 20} ${height * 0.4} L ${width + 20} ${height + 20} L -20 ${height + 20} Z`}
        fill={overlayColor}
        opacity={0.35}
      />
      <Path
        d={`M -20 ${height * 0.72} C ${width * 0.35} ${height * 0.6} ${width * 0.65} ${height * 0.85} ${width + 20} ${height * 0.68} L ${width + 20} ${height + 20} L -20 ${height + 20} Z`}
        fill={overlayColor}
        opacity={0.4}
      />
      <Path
        d={`M 0 ${height * 0.4} C ${width * 0.2} ${height * 0.2} ${width * 0.8} ${height * 0.3} ${width} ${height * 0.5}`}
        fill="none"
        stroke={overlayColor}
        strokeWidth={strokeW}
        opacity={op}
      />
      <Path
        d={`M 0 ${height * 0.7} C ${width * 0.3} ${height * 0.5} ${width * 0.7} ${height * 0.6} ${width} ${height * 0.75}`}
        fill="none"
        stroke={overlayColor}
        strokeWidth={strokeW}
        opacity={op}
      />
    </Svg>
  );
}

/** Dynamic (Kinetic) - energetic flowing waves + bold strokes */
function DynamicBlobs({ width, height, overlayColor, sizeMult }: { width: number; height: number; overlayColor: string; sizeMult: number }) {
  const strokeW = 2 * sizeMult;
  const op = 0.5;
  return (
    <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
      <Path
        d={`M -20 ${height * 0.2} C ${width * 0.15} ${height * 0.4} ${width * 0.45} ${height * 0.05} ${width * 0.7} ${height * 0.25} C ${width * 0.95} ${height * 0.45} ${width + 20} ${height * 0.15} ${width + 20} ${height * 0.35}`}
        fill="none"
        stroke={overlayColor}
        strokeWidth={strokeW}
        opacity={op}
      />
      <Path
        d={`M -20 ${height * 0.55} C ${width * 0.25} ${height * 0.35} ${width * 0.5} ${height * 0.7} ${width * 0.75} ${height * 0.45} C ${width} ${height * 0.65} ${width + 20} ${height * 0.5} ${width + 20} ${height * 0.65}`}
        fill="none"
        stroke={overlayColor}
        strokeWidth={strokeW}
        opacity={op}
      />
      <Path
        d={`M -20 ${height * 0.88} C ${width * 0.3} ${height * 0.65} ${width * 0.6} ${height * 0.95} ${width + 20} ${height * 0.78}`}
        fill="none"
        stroke={overlayColor}
        strokeWidth={strokeW}
        opacity={op}
      />
      <Path
        d={`M ${width * 0.2} ${height} C ${width * 0.2} ${height * 0.5} ${width * 0.5} ${height * 0.35} ${width * 0.5} ${height * 0.65} C ${width * 0.8} ${height * 0.6} ${width * 0.8} ${height} Z`}
        fill={overlayColor}
        opacity={0.38}
      />
    </Svg>
  );
}

/** Grid (Tech) - flowing curved tech lines */
function SoftGrid({ width, height, overlayColor, sizeMult }: { width: number; height: number; overlayColor: string; sizeMult: number }) {
  const strokeW = 1.2 * sizeMult;
  const op = 0.5;
  return (
    <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
      {Array.from({ length: 5 }, (_, i) => (
        <Path
          key={`h${i}`}
          d={`M -10 ${height * (0.2 + i * 0.2)} C ${width * 0.3} ${height * (0.15 + i * 0.21)} ${width * 0.7} ${height * (0.25 + i * 0.19)} ${width + 10} ${height * (0.2 + i * 0.2)}`}
          fill="none"
          stroke={overlayColor}
          strokeWidth={strokeW}
          opacity={op}
        />
      ))}
      {Array.from({ length: 6 }, (_, i) => (
        <Path
          key={`v${i}`}
          d={`M ${width * (0.15 + i * 0.17)} -10 C ${width * (0.18 + i * 0.17)} ${height * 0.4} ${width * (0.22 + i * 0.17)} ${height * 0.6} ${width * (0.15 + i * 0.17)} ${height + 10}`}
          fill="none"
          stroke={overlayColor}
          strokeWidth={strokeW}
          opacity={op}
        />
      ))}
    </Svg>
  );
}

/** Geometric (Technical) - flowing angular curves + filled shapes */
function GeometricSoft({ width, height, overlayColor, sizeMult }: { width: number; height: number; overlayColor: string; sizeMult: number }) {
  const strokeW = 2 * sizeMult;
  const op = 0.5;
  return (
    <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
      <Path
        d={`M 0 ${height * 0.3} L ${width * 0.4} ${height * 0.1} L ${width * 0.8} ${height * 0.25} L ${width} ${height * 0.5} L ${width * 0.6} ${height * 0.9} L ${width * 0.2} ${height * 0.75} Z`}
        fill={overlayColor}
        opacity={0.32}
      />
      <Path
        d={`M ${width * 0.25} 0 L ${width * 0.5} ${height * 0.3} L ${width * 0.75} 0`}
        fill="none"
        stroke={overlayColor}
        strokeWidth={strokeW}
        opacity={op}
      />
      <Path
        d={`M 0 ${height * 0.6} L ${width * 0.35} ${height * 0.4} L ${width * 0.7} ${height * 0.65} L ${width} ${height * 0.45}`}
        fill="none"
        stroke={overlayColor}
        strokeWidth={strokeW}
        opacity={op}
      />
    </Svg>
  );
}

/** Mesh (Art) - artistic flowing interconnected curves + filled regions */
function SoftMesh({ width, height, overlayColor, sizeMult }: { width: number; height: number; overlayColor: string; sizeMult: number }) {
  const strokeW = 1.8 * sizeMult;
  const op = 0.5;
  return (
    <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
      <Path
        d={`M -20 ${height * 0.4} C ${width * 0.2} ${height * 0.2} ${width * 0.6} ${height * 0.5} ${width + 20} ${height * 0.35}`}
        fill="none"
        stroke={overlayColor}
        strokeWidth={strokeW}
        opacity={op}
      />
      <Path
        d={`M -20 ${height * 0.7} C ${width * 0.25} ${height * 0.5} ${width * 0.65} ${height * 0.8} ${width + 20} ${height * 0.6}`}
        fill="none"
        stroke={overlayColor}
        strokeWidth={strokeW}
        opacity={op}
      />
      <Path
        d={`M ${width * 0.1} ${height + 20} C ${width * 0.1} ${height * 0.55} ${width * 0.55} ${height * 0.3} ${width * 0.55} ${height * 0.7} C ${width * 0.9} ${height * 0.55} ${width * 0.9} ${height + 20} Z`}
        fill={overlayColor}
        opacity={0.36}
      />
      <Path
        d={`M 0 ${height * 0.55} Q ${width * 0.5} ${height * 0.35} ${width} ${height * 0.5}`}
        fill="none"
        stroke={overlayColor}
        strokeWidth={strokeW}
        opacity={op}
      />
    </Svg>
  );
}

/** Vector - flowing angular but softened */
function VectorSoft({ width, height, overlayColor, sizeMult }: { width: number; height: number; overlayColor: string; sizeMult: number }) {
  const strokeW = 2 * sizeMult;
  const op = 0.5;
  return (
    <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
      <Path
        d={`M ${width * 0.1} ${height} C ${width * 0.1} ${height * 0.5} ${width * 0.5} ${height * 0.4} ${width * 0.5} ${height * 0.6} C ${width * 0.9} ${height * 0.55} ${width * 0.9} ${height} Z`}
        fill={overlayColor}
        opacity={0.35}
      />
      <Path
        d={`M 0 ${height * 0.5} C ${width * 0.3} ${height * 0.3} ${width * 0.7} ${height * 0.4} ${width} ${height * 0.5}`}
        fill="none"
        stroke={overlayColor}
        strokeWidth={strokeW}
        opacity={op}
      />
    </Svg>
  );
}

export function BackgroundPattern({
  element,
  width,
  height,
  patternWeight = 'medium',
  overlayColor = defaultOverlay,
}: BackgroundPatternProps) {
  if (element === 'none') return null;

  const sizeMult = WEIGHT_MULTIPLIER[patternWeight] ?? WEIGHT_MULTIPLIER.medium;

  const SvgPattern = () => {
    switch (element) {
      case 'organic':
        return <OrganicBlobs width={width} height={height} overlayColor={overlayColor} sizeMult={sizeMult} />;

      case 'fluid':
        return <FluidWaves width={width} height={height} overlayColor={overlayColor} sizeMult={sizeMult} />;

      case 'gradient_mesh':
        return <GradientMeshBlobs width={width} height={height} overlayColor={overlayColor} sizeMult={sizeMult} />;

      case 'dynamic':
        return <DynamicBlobs width={width} height={height} overlayColor={overlayColor} sizeMult={sizeMult} />;

      case 'grid':
        return <SoftGrid width={width} height={height} overlayColor={overlayColor} sizeMult={sizeMult} />;

      case 'geometric':
        return <GeometricSoft width={width} height={height} overlayColor={overlayColor} sizeMult={sizeMult} />;

      case 'mesh':
        return <SoftMesh width={width} height={height} overlayColor={overlayColor} sizeMult={sizeMult} />;

      case 'vector':
        return <VectorSoft width={width} height={height} overlayColor={overlayColor} sizeMult={sizeMult} />;

      default:
        return null;
    }
  };

  return (
    <View
      style={[StyleSheet.absoluteFill, { left: 0, top: 0 }]}
      pointerEvents="none"
    >
      <SvgPattern />
    </View>
  );
}
