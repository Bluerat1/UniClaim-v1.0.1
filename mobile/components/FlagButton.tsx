import React, { useState } from "react";
import { TouchableOpacity, Text, Alert, ActivityIndicator } from "react-native";
import { postService } from "../utils/firebase/posts";
import { useAuth } from "../context/AuthContext";
import FlagModal from "./FlagModal";

interface FlagButtonProps {
  postId: string;
  isFlagged?: boolean;
  flaggedBy?: string;
  onFlagSuccess?: () => void;
  className?: string;
}

export default function FlagButton({
  postId,
  isFlagged = false,
  flaggedBy,
  onFlagSuccess,
  className = "",
}: FlagButtonProps) {
  const [showFlagModal, setShowFlagModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useAuth();

  const handleFlagClick = () => {
    if (!user) {
      Alert.alert("Login Required", "Please log in to flag posts");
      return;
    }
    setShowFlagModal(true);
  };

  const handleFlagSubmit = async (reason: string) => {
    if (!user) return;

    setIsLoading(true);
    try {
      await postService.flagPost(postId, user.uid, reason);
      setShowFlagModal(false);
      onFlagSuccess?.();
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to flag post");
    } finally {
      setIsLoading(false);
    }
  };

  const isAlreadyFlaggedByUser = isFlagged && flaggedBy === user?.uid;

  return (
    <>
      <TouchableOpacity
        onPress={handleFlagClick}
        disabled={isAlreadyFlaggedByUser || isLoading}
        className={`flex-row items-center gap-1 px-2 py-1 rounded ${
          isAlreadyFlaggedByUser ? "bg-gray-100" : "bg-red-50"
        } ${isAlreadyFlaggedByUser || isLoading ? "opacity-60" : "opacity-100"} ${className}`}
      >
        {isLoading ? (
          <>
            <ActivityIndicator size="small" color="#DC2626" />
            <Text className="text-xs font-medium text-red-600">
              Flagging...
            </Text>
          </>
        ) : (
          <>
            <Text className="text-xs">🚩</Text>
            <Text
              className={`text-xs font-medium ${
                isAlreadyFlaggedByUser ? "text-gray-500" : "text-red-600"
              }`}
            >
              {isAlreadyFlaggedByUser ? "Flagged" : "Flag"}
            </Text>
          </>
        )}
      </TouchableOpacity>

      {showFlagModal && (
        <FlagModal
          onClose={() => setShowFlagModal(false)}
          onSubmit={handleFlagSubmit}
          isLoading={isLoading}
        />
      )}
    </>
  );
}
