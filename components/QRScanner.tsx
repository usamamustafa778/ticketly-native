import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  Pressable,
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
} from 'react-native';
import { CameraView, Camera } from 'expo-camera';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

interface QRScannerProps {
  visible: boolean;
  onClose: () => void;
  onScan: (data: string) => void;
}

export const QRScanner: React.FC<QRScannerProps> = ({ visible, onClose, onScan }) => {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (visible) {
      requestCameraPermission();
    }
  }, [visible]);

  const requestCameraPermission = async () => {
    try {
      setLoading(true);
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === 'granted');
      
      if (status !== 'granted') {
        Alert.alert(
          'Camera Permission Required',
          'Please enable camera access in your device settings to scan QR codes.',
          [
            { text: 'Cancel', style: 'cancel' },
            { 
              text: 'Open Settings', 
              onPress: () => {
                if (Platform.OS === 'ios') {
                  Linking.openURL('app-settings:');
                } else {
                  Linking.openSettings();
                }
              }
            },
          ]
        );
      }
    } catch (error) {
      console.error('Error requesting camera permission:', error);
      Alert.alert('Error', 'Failed to request camera permission');
      setHasPermission(false);
    } finally {
      setLoading(false);
    }
  };

  const handleBarCodeScanned = ({ type, data }: { type: string; data: string }) => {
    if (!scanned) {
      setScanned(true);
      console.log('QR Code scanned:', data);
      onScan(data);
      
      // Auto-close after successful scan
      setTimeout(() => {
        onClose();
        setScanned(false);
      }, 500);
    }
  };

  const handleClose = () => {
    setScanned(false);
    onClose();
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View className="flex-1 bg-black">
        {/* Header */}
        <View className="absolute top-0 left-0 right-0 z-10 bg-black/50 pt-[50px] pb-4 px-3">
          <View className="flex-row items-center justify-between">
            <Text className="text-white text-xl font-bold">Scan QR Code</Text>
            <TouchableOpacity
              className="bg-white/20 w-10 h-10 rounded-full items-center justify-center"
              onPress={handleClose}
            >
              <MaterialIcons name="close" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
          <Text className="text-[#D1D5DB] text-sm mt-2">
            Position the QR code within the frame to scan
          </Text>
        </View>

        {/* Camera View */}
        {loading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#DC2626" />
            <Text className="text-white text-base mt-4">Requesting camera permission...</Text>
          </View>
        ) : hasPermission === false ? (
          <View className="flex-1 items-center justify-center px-10">
            <MaterialIcons name="camera-alt" size={64} color="#EF4444" />
            <Text className="text-white text-lg font-bold mt-4 text-center">
              Camera Permission Denied
            </Text>
            <Text className="text-[#D1D5DB] text-sm mt-2 text-center">
              Please enable camera access in your device settings to scan QR codes.
            </Text>
            <TouchableOpacity
              className="bg-primary py-3 px-6 rounded-xl mt-6"
              onPress={() => {
                if (Platform.OS === 'ios') {
                  Linking.openURL('app-settings:');
                } else {
                  Linking.openSettings();
                }
              }}
            >
              <Text className="text-white text-base font-semibold">Open Settings</Text>
            </TouchableOpacity>
            <TouchableOpacity
              className="bg-[#374151] py-3 px-6 rounded-xl mt-3"
              onPress={handleClose}
            >
              <Text className="text-white text-base font-semibold">Cancel</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View className="flex-1">
            <CameraView
              style={{ flex: 1 }}
              facing="back"
              onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
              barcodeScannerSettings={{
                barcodeTypes: ['qr'],
              }}
            >
              {/* Scanning Frame Overlay */}
              <View className="flex-1 items-center justify-center">
                {/* Dark overlay with transparent square */}
                <View className="absolute top-0 left-0 right-0 bottom-0">
                  {/* Top overlay */}
                  <View className="flex-1 bg-black/60" />
                  {/* Middle row with square cutout */}
                  <View className="flex-row" style={{ height: 280 }}>
                    <View className="flex-1 bg-black/60" />
                    <View style={{ width: 280 }} className="border-2 border-primary rounded-2xl">
                      {/* Corner indicators */}
                      <View className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-white rounded-tl-xl" />
                      <View className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-white rounded-tr-xl" />
                      <View className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-white rounded-bl-xl" />
                      <View className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-white rounded-br-xl" />
                    </View>
                    <View className="flex-1 bg-black/60" />
                  </View>
                  {/* Bottom overlay */}
                  <View className="flex-1 bg-black/60" />
                </View>

                {/* Scanning indicator */}
                {!scanned && (
                  <View className="absolute bottom-[80px] bg-primary py-3 px-6 rounded-xl flex-row items-center">
                    <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 8 }} />
                    <Text className="text-white text-sm font-semibold">Scanning...</Text>
                  </View>
                )}

                {/* Scanned success indicator */}
                {scanned && (
                  <View className="absolute bottom-[80px] bg-[#10B981] py-3 px-6 rounded-xl flex-row items-center">
                    <MaterialIcons name="check-circle" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                    <Text className="text-white text-sm font-semibold">QR Code Scanned!</Text>
                  </View>
                )}
              </View>
            </CameraView>
          </View>
        )}
      </View>
    </Modal>
  );
};





