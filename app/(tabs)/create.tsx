import { useRouter } from 'expo-router';
import React, { useState, useCallback } from 'react';
import { Text, TouchableOpacity, View, ScrollView, RefreshControl } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

export default function CreateTabScreen() {
    const router = useRouter();
    const [refreshing, setRefreshing] = useState(false);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        // No data to refresh; just show pull feedback for consistency with other tabs
        setTimeout(() => setRefreshing(false), 400);
    }, []);

    return (
        <ScrollView
            className="flex-1 bg-white pt-[60px]"
            contentContainerStyle={{ flexGrow: 1 }}
            showsVerticalScrollIndicator={false}
            refreshControl={
                <RefreshControl
                    refreshing={refreshing}
                    onRefresh={onRefresh}
                    tintColor="#DC2626"
                    colors={["#DC2626"]}
                />
            }
        >
            <View className="flex-1 min-h-[400px] items-center justify-center px-10">
                <MaterialIcons name="add-circle-outline" size={64} color="#DC2626" />
                <Text className="text-3xl font-bold text-gray-900 mb-3 text-center">Create Event</Text>
                <Text className="text-base text-gray-600 text-center mb-8">
                    Start creating amazing events and reach your audience
                </Text>
                <TouchableOpacity
                    className="bg-primary py-4 px-8 rounded-xl"
                    onPress={() => router.push('/create-event')}
                >
                    <Text className="text-white text-base font-semibold">Get Started</Text>
                </TouchableOpacity>
            </View>
        </ScrollView>
    );
}

