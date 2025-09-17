import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  TextInput,
  Alert,
} from "react-native";

interface FlagModalProps {
  onClose: () => void;
  onSubmit: (reason: string) => void;
  isLoading?: boolean;
}

const FLAG_REASONS = [
  "Inappropriate content",
  "Spam/Fake post",
  "Suspicious activity",
  "Wrong category",
  "Other",
];

export default function FlagModal({
  onClose,
  onSubmit,
  isLoading = false,
}: FlagModalProps) {
  const [selectedReason, setSelectedReason] = useState("");
  const [customReason, setCustomReason] = useState("");

  const handleSubmit = () => {
    const reason = selectedReason === "Other" ? customReason : selectedReason;
    if (reason.trim()) {
      onSubmit(reason.trim());
    } else {
      Alert.alert("Error", "Please select a reason for flagging");
    }
  };

  return (
    <Modal
      visible={true}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-black/50 justify-center items-center px-4">
        <View className="bg-white rounded-lg p-6 w-full max-w-sm">
          <Text className="text-lg font-manrope-bold mb-4">
            Why did you flag this post?
          </Text>
          <Text className="text-sm text-gray-600 mb-4 font-inter">
            Please select a reason for flagging this post:
          </Text>

          <ScrollView className="h-90 mb-4">
            <View className="flex-col gap-3">
              {FLAG_REASONS.map((reason) => (
                <TouchableOpacity
                  key={reason}
                  onPress={() => setSelectedReason(reason)}
                  className={`flex-row items-center p-3 rounded-lg border ${
                    selectedReason === reason
                      ? "bg-red-50 border-red-200"
                      : "bg-gray-50 border-gray-200"
                  }`}
                >
                  <View
                    className={`w-4 h-4 rounded-full border-2 mr-3 ${
                      selectedReason === reason
                        ? "bg-red-600 border-red-600"
                        : "border-gray-300"
                    }`}
                  >
                    {selectedReason === reason && (
                      <View className="w-2 h-2 bg-white rounded-full m-0.5" />
                    )}
                  </View>
                  <Text className="text-sm font-manrope-medium flex-1">
                    {reason}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          {selectedReason === "Other" && (
            <View className="mb-4">
              <Text className="text-sm font-manrope-medium text-gray-700 mb-2">
                Please specify:
              </Text>
              <TextInput
                value={customReason}
                onChangeText={setCustomReason}
                placeholder="Enter your reason..."
                multiline
                numberOfLines={3}
                className="w-full px-4 py-3 font-inter border border-gray-300 rounded-md text-sm"
                style={{ textAlignVertical: "top" }}
              />
            </View>
          )}

          <View className="flex-row justify-end gap-3">
            <TouchableOpacity
              onPress={onClose}
              disabled={isLoading}
              className="px-4 py-2 bg-gray-100 rounded-md"
            >
              <Text className="text-sm font-manrope-medium text-gray-700">
                Cancel
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSubmit}
              disabled={
                !selectedReason ||
                (selectedReason === "Other" && !customReason.trim()) ||
                isLoading
              }
              className={`px-4 py-2 rounded-md ${
                !selectedReason ||
                (selectedReason === "Other" && !customReason.trim()) ||
                isLoading
                  ? "bg-zinc-200"
                  : "bg-red-600"
              }`}
            >
              <Text
                className={`text-sm font-manrope-medium ${
                  !selectedReason ||
                  (selectedReason === "Other" && !customReason.trim()) ||
                  isLoading
                    ? "text-gray-500"
                    : "text-white"
                }`}
              >
                {isLoading ? "Flagging..." : "Flag Post"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
