// Notification preferences component for mobile app
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
} from "react-native";
import { useAuth } from "../context/AuthContext";
import { notificationService } from "../utils/firebase/notifications";
import { NotificationPreferences } from "../types/Notification";
import { Feather } from "@expo/vector-icons";
import { ITEM_CATEGORIES } from "../constants/categories";

interface NotificationPreferencesComponentProps {
  onClose: () => void;
}

export default function NotificationPreferencesModal({
  onClose,
}: NotificationPreferencesComponentProps) {
  const { userData } = useAuth();
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    newPosts: true,
    messages: true,
    claimUpdates: true,
    adminAlerts: true,
    claimResponses: true,
    handoverResponses: true,
    locationFilter: false,
    categoryFilter: [],
    quietHours: {
      enabled: false,
      start: "22:00",
      end: "08:00",
    },
    soundEnabled: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Available categories for filtering - using the same categories as items
  const availableCategories = ITEM_CATEGORIES;

  useEffect(() => {
    loadPreferences();
  }, [userData?.uid]);

  const loadPreferences = async () => {
    if (!userData?.uid) return;

    try {
      setLoading(true);
      const userPreferences =
        await notificationService.getNotificationPreferences(userData.uid);
      setPreferences(userPreferences);
    } catch (err: any) {
      setError(err.message || "Failed to load preferences");
    } finally {
      setLoading(false);
    }
  };

  const savePreferences = async () => {
    if (!userData?.uid) return;

    try {
      setSaving(true);
      setError(null);
      await notificationService.updateNotificationPreferences(
        userData.uid,
        preferences
      );
      Alert.alert("Success", "Notification preferences saved successfully!");
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to save preferences");
      Alert.alert("Error", "Failed to save preferences. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = (key: keyof NotificationPreferences) => {
    setPreferences((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleCategoryToggle = (category: string) => {
    setPreferences((prev) => ({
      ...prev,
      categoryFilter: prev.categoryFilter.includes(category)
        ? prev.categoryFilter.filter((c) => c !== category)
        : [...prev.categoryFilter, category],
    }));
  };

  const handleQuietHoursChange = (
    field: "enabled" | "start" | "end",
    value: boolean | string
  ) => {
    setPreferences((prev) => ({
      ...prev,
      quietHours: {
        ...prev.quietHours,
        [field]: value,
      },
    }));
  };

  if (loading) {
    return (
      <View className="flex-1 bg-white">
        <View className="flex-row items-center justify-between p-4 border-b border-gray-200">
          <Text className="text-xl font-bold text-gray-900">
            Notification Preferences
          </Text>
          <TouchableOpacity onPress={onClose}>
            <Feather name="x" size={24} color="#6B7280" />
          </TouchableOpacity>
        </View>
        <View className="flex-1 items-center justify-center">
          <Text className="text-gray-600">Loading preferences...</Text>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-white">
      {/* Header */}
      <View className="flex-row items-center justify-between p-4 border-b border-gray-200">
        <View className="flex-row items-center gap-3">
          <Feather name="bell" size={20} color="#eab308" />
          <Text className="text-xl font-manrope-bold text-gray-900">
            Notification Preferences
          </Text>
        </View>
        <TouchableOpacity onPress={onClose}>
          <Feather name="x" size={24} color="#6B7280" />
        </TouchableOpacity>
      </View>

      <ScrollView className="flex-1 p-4">
        {error && (
          <View className="mb-4 p-3 bg-red-100 border border-red-400 rounded-lg">
            <Text className="text-red-700">{error}</Text>
          </View>
        )}

        {/* Notification Types */}
        <View className="mb-3">
          <Text className="text-lg font-manrope-semibold text-gray-900 mb-4">
            Notification Types
          </Text>

          <View className="">
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-2">
                <Feather name="bell" size={20} color="#10B981" />
                <Text className="text-gray-700 font-inter ">New Posts</Text>
              </View>
              <Switch
                value={preferences.newPosts}
                onValueChange={() => handleToggle("newPosts")}
                trackColor={{ false: "#E5E7EB", true: "#0A193A" }}
                thumbColor={preferences.newPosts ? "#FFFFFF" : "#F3F4F6"}
              />
            </View>

            <View className="flex-row items-center justify-between py-3">
              <View className="flex-row items-center gap-2">
                <Feather name="bell" size={20} color="#3B82F6" />
                <Text className="text-gray-700 font-inter ">Messages</Text>
              </View>
              <Switch
                value={preferences.messages}
                onValueChange={() => handleToggle("messages")}
                trackColor={{ false: "#E5E7EB", true: "#0A193A" }}
                thumbColor={preferences.messages ? "#FFFFFF" : "#F3F4F6"}
              />
            </View>

            <View className="flex-row items-center justify-between py-3">
              <View className="flex-row items-center gap-2">
                <Feather name="bell" size={20} color="#F59E0B" />
                <Text className="text-gray-700 font-inter ">Claim Updates</Text>
              </View>
              <Switch
                value={preferences.claimUpdates}
                onValueChange={() => handleToggle("claimUpdates")}
                trackColor={{ false: "#E5E7EB", true: "#0A193A" }}
                thumbColor={preferences.claimUpdates ? "#FFFFFF" : "#F3F4F6"}
              />
            </View>

            <View className="flex-row items-center justify-between py-3">
              <View className="flex-row items-center gap-2">
                <Feather name="bell" size={20} color="#EF4444" />
                <Text className="text-gray-700 font-inter ">Admin Alerts</Text>
              </View>
              <Switch
                value={preferences.adminAlerts}
                onValueChange={() => handleToggle("adminAlerts")}
                trackColor={{ false: "#E5E7EB", true: "#0A193A" }}
                thumbColor={preferences.adminAlerts ? "#FFFFFF" : "#F3F4F6"}
              />
            </View>

            <View className="flex-row items-center justify-between py-3">
              <View className="flex-row items-center gap-2">
                <Feather name="bell" size={20} color="#8B5CF6" />
                <Text className="text-gray-700 font-inter ">Claim Responses</Text>
              </View>
              <Switch
                value={preferences.claimResponses}
                onValueChange={() => handleToggle("claimResponses")}
                trackColor={{ false: "#E5E7EB", true: "#0A193A" }}
                thumbColor={preferences.claimResponses ? "#FFFFFF" : "#F3F4F6"}
              />
            </View>

            <View className="flex-row items-center justify-between py-3">
              <View className="flex-row items-center gap-2">
                <Feather name="bell" size={20} color="#F97316" />
                <Text className="text-gray-700 font-inter ">Handover Responses</Text>
              </View>
              <Switch
                value={preferences.handoverResponses}
                onValueChange={() => handleToggle("handoverResponses")}
                trackColor={{ false: "#E5E7EB", true: "#0A193A" }}
                thumbColor={preferences.handoverResponses ? "#FFFFFF" : "#F3F4F6"}
              />
            </View>
          </View>
        </View>
        <View className="mb-6">
          <View className="flex-row items-center mb-3 gap-3">
            <Feather name="tag" size={20} color="#8B5CF6" />
            <Text className="text-lg font-manrope-bold text-gray-900">
              Category Filter
            </Text>
          </View>
          <Text className="text-sm font-inter text-gray-600 mb-3">
            Only receive notifications for posts in these categories (leave
            empty for all categories)
          </Text>

          <View className="flex-row flex-wrap">
            {availableCategories.map((category) => (
              <TouchableOpacity
                key={category}
                onPress={() => handleCategoryToggle(category)}
                className={`mr-2 mb-2 px-3 py-2 rounded-full border ${
                  preferences.categoryFilter.includes(category)
                    ? "bg-yellow-200 border-yellow-600"
                    : "bg-gray-50 border-gray-300"
                }`}
              >
                <Text
                  className={`text-sm ${
                    preferences.categoryFilter.includes(category)
                      ? "text-yellow-700"
                      : "text-gray-500"
                  }`}
                >
                  {category}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Quiet Hours */}
        <View className="mb-6">
          <View className="flex-row items-center gap-3">
            <Feather name="clock" size={20} color="#6366F1" />
            <Text className="text-lg font-manrope-bold text-gray-900">
              Quiet Hours
            </Text>
          </View>

          <View className="space-y-3">
            <View className="flex-row items-center justify-between py-3">
              <Text className="text-gray-700">Enable quiet hours</Text>
              <Switch
                value={preferences.quietHours.enabled}
                onValueChange={(value) =>
                  handleQuietHoursChange("enabled", value)
                }
                trackColor={{ false: "#E5E7EB", true: "#0A193A" }}
                thumbColor={
                  preferences.quietHours.enabled ? "#FFFFFF" : "#F3F4F6"
                }
              />
            </View>

            {preferences.quietHours.enabled && (
              <View className="flex-row items-center gap-3">
                <View className="flex-1">
                  <Text className="text-sm font-manrope-medium text-gray-700 mb-2">
                    Start Time
                  </Text>
                  <TouchableOpacity className="p-3 border border-gray-300 rounded-lg">
                    <Text className="text-gray-900 font-inter">
                      {preferences.quietHours.start}
                    </Text>
                  </TouchableOpacity>
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-manrope-medium text-gray-700 mb-2">
                    End Time
                  </Text>
                  <TouchableOpacity className="p-3 border border-gray-300 rounded-lg">
                    <Text className="text-gray-900 font-inter">
                      {preferences.quietHours.end}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </View>
        <View className="mb-6">
          <View className="flex-row items-center gap-3">
            <Feather name="volume-2" size={20} color="#10B981" />
            <Text className="text-lg font-manrope-bold text-gray-900">
              Sound Settings
            </Text>
          </View>

          <View className="flex-row items-center justify-between py-3">
            <View className="flex-row items-center gap-2">
              {preferences.soundEnabled ? (
                <Feather name="volume-2" size={20} color="#10B981" />
              ) : (
                <Feather name="volume-x" size={20} color="#6B7280" />
              )}
              <Text className="text-gray-700 font-inter">Notification Sounds</Text>
            </View>
            <Switch
              value={preferences.soundEnabled}
              onValueChange={() => handleToggle("soundEnabled")}
              trackColor={{ false: "#E5E7EB", true: "#0A193A" }}
              thumbColor={preferences.soundEnabled ? "#FFFFFF" : "#F3F4F6"}
            />
          </View>
        </View>
      </ScrollView>

      {/* Action Buttons */}
      <View className="p-4 border-t border-gray-200">
        <View className="flex-row items-center gap-3">
          <TouchableOpacity
            onPress={onClose}
            className="flex-1 py-3 px-4 bg-gray-100 rounded-lg"
          >
            <Text className="text-center font-manrope-medium text-gray-700 font-medium">
              Cancel
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={savePreferences}
            disabled={saving}
            className={`flex-1 py-3 px-4 rounded-lg ${
              saving ? "bg-gray-300" : "bg-blue-600"
            }`}
          >
            <Text className="text-center font-manrope-medium text-white font-medium">
              {saving ? "Saving..." : "Save Preferences"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}
