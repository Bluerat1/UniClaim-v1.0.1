import React from "react";
import { View, Text, TouchableOpacity, Alert } from "react-native";
import { useAuth } from "../context/AuthContext";

interface BanNotificationProps {
  visible: boolean;
  onClose: () => void;
}

const BanNotification: React.FC<BanNotificationProps> = ({
  visible,
  onClose,
}) => {
  const { banInfo, logout } = useAuth();

  if (!visible) return null;

  const getBanDetails = () => {
    if (!banInfo) return { reason: "No reason provided", duration: "Unknown" };

    const reason = banInfo.reason || "No reason provided";
    const duration = banInfo.duration || "Unknown";
    const endDate = banInfo.banEndDate;

    return { reason, duration, endDate };
  };

  const { reason, duration, endDate } = getBanDetails();

  const handleLogout = async () => {
    try {
      await logout();
      onClose();
    } catch (error) {
      console.error("Error logging out:", error);
      Alert.alert("Error", "Failed to logout. Please try again.");
    }
  };

  const handleClose = () => {
    Alert.alert(
      "Close Ban Notification",
      "Are you sure you want to close this notification? You will still be banned.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Close", onPress: onClose },
      ]
    );
  };

  return (
    <View className="absolute inset-0 bg-black/50 justify-center items-center z-[1000]">
      <View className="bg-white rounded-2xl p-6 mx-5 w-full max-w-[400px] max-h-[90%]">
        {/* Header */}
        <View className="items-center mb-6">
          <View className="w-16 h-16 rounded-full bg-red-100 justify-center items-center mb-4">
            <Text className="text-3xl">🚫</Text>
          </View>
          <Text className="text-2xl font-bold text-gray-800 mb-2 text-center">
            Account Banned
          </Text>
          <Text className="text-sm text-gray-500 text-center leading-5">
            Your account has been suspended from using this application.
          </Text>
        </View>

        {/* Ban Information */}
        <View className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
          <Text className="text-base font-semibold text-red-600 mb-3">
            Ban Details
          </Text>

          <View className="flex-row justify-between mb-2">
            <Text className="text-sm font-medium text-red-600">Reason:</Text>
            <Text className="text-sm text-red-600 flex-1 text-right ml-2">
              {reason}
            </Text>
          </View>

          <View className="flex-row justify-between mb-2">
            <Text className="text-sm font-medium text-red-600">Duration:</Text>
            <Text className="text-sm text-red-600 flex-1 text-right ml-2">
              {duration === "permanent" ? "Permanent" : "Temporary"}
            </Text>
          </View>

          {endDate && duration === "temporary" && (
            <View className="flex-row justify-between">
              <Text className="text-sm font-medium text-red-600">Expires:</Text>
              <Text className="text-sm text-red-600 flex-1 text-right ml-2">
                {new Date(
                  endDate.toDate ? endDate.toDate() : endDate
                ).toLocaleDateString()}
              </Text>
            </View>
          )}
        </View>

        {/* What This Means */}
        <View className="bg-amber-50 border border-amber-300 rounded-lg p-4 mb-4">
          <Text className="text-base font-semibold text-amber-800 mb-2">
            What This Means
          </Text>
          <Text className="text-sm text-amber-800 mb-1 leading-5">
            • You cannot access any features of the application
          </Text>
          <Text className="text-sm text-amber-800 mb-1 leading-5">
            • You cannot create posts or send messages
          </Text>
          <Text className="text-sm text-amber-800 leading-5">
            • Your account is suspended until further notice
          </Text>
        </View>

        {/* Next Steps */}
        <View className="bg-blue-50 border border-blue-300 rounded-lg p-4 mb-6">
          <Text className="text-base font-semibold text-blue-800 mb-2">
            Next Steps
          </Text>
          <Text className="text-sm text-blue-800 leading-5">
            {duration === "temporary"
              ? "Wait for your ban to expire, or contact an administrator if you believe this was an error."
              : "This is a permanent ban. Contact an administrator if you believe this was an error."}
          </Text>
        </View>

        {/* Action Buttons */}
        <View className="gap-3">
          <TouchableOpacity
            className="bg-red-600 rounded-lg p-4 items-center"
            onPress={handleLogout}
          >
            <Text className="text-white text-base font-manrope-semibold">
              Logout
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            className="bg-gray-100 rounded-lg p-4 items-center"
            onPress={handleClose}
          >
            <Text className="text-gray-700 text-base font-manrope-semibold">
              Close
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

export default BanNotification;
