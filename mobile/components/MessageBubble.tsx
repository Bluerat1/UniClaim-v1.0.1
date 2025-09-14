import React, { useState } from "react";
import {
  Text,
  TouchableOpacity,
  View,
  Alert,
  Image,
  Linking,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useMessage } from "@/context/MessageContext";
import type { Message } from "@/types/type";
import ImagePicker from "@/components/ImagePicker";

interface MessageBubbleProps {
  message: Message;
  isOwnMessage: boolean;
  conversationId: string;
  currentUserId: string;
  isCurrentUserPostOwner?: boolean;
  onHandoverResponse?: (
    messageId: string,
    status: "accepted" | "rejected"
  ) => void;
  onClaimResponse?: (
    messageId: string,
    status: "accepted" | "rejected"
  ) => void;
  onConfirmIdPhotoSuccess?: (messageId: string) => void;
  onMessageSeen?: () => void;
  onImageClick?: (imageUrl: string, altText: string) => void;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  isOwnMessage,
  conversationId,
  currentUserId,
  isCurrentUserPostOwner,
  onHandoverResponse,
  onClaimResponse,
  onConfirmIdPhotoSuccess,
  onMessageSeen,
  onImageClick,
}) => {
  const {
    deleteMessage,
    confirmHandoverIdPhoto,
    confirmClaimIdPhoto,
    updateClaimResponse,
  } = useMessage();
  const [isDeleting, setIsDeleting] = useState(false);
  const [showIdPhotoModal, setShowIdPhotoModal] = useState(false);
  const [isUploadingIdPhoto, setIsUploadingIdPhoto] = useState(false);

  const formatTime = (timestamp: any) => {
    if (!timestamp) return "";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  // For mobile, visibility detection is handled by FlatList's onViewableItemsChanged
  // This component just provides the callback interface

  const handleHandoverResponse = async (status: "accepted" | "rejected") => {
    if (!onHandoverResponse) return;

    if (status === "accepted") {
      setShowIdPhotoModal(true);
      return;
    }

    try {
      const { messageService } = await import("@/utils/firebase");
      await messageService.updateHandoverResponse(
        conversationId,
        message.id,
        status,
        currentUserId
      );
      onHandoverResponse(message.id, status);
    } catch (error) {
      console.error("Failed to update handover response:", error);
    }
  };

  const handleIdPhotoUpload = async (photoUri: string) => {
    try {
      setIsUploadingIdPhoto(true);

      // Upload ID photo to Cloudinary
      const { cloudinaryService } = await import("@/utils/cloudinary");
      const uploadedUrl = await cloudinaryService.uploadImage(
        photoUri,
        "id_photos"
      );

      // Update handover response with ID photo
      const { messageService } = await import("@/utils/firebase");
      await messageService.updateHandoverResponse(
        conversationId,
        message.id,
        "accepted",
        currentUserId,
        uploadedUrl
      );

      onHandoverResponse?.(message.id, "accepted");
      setShowIdPhotoModal(false);

      Alert.alert(
        "Success",
        "ID photo uploaded successfully! The item owner will now review and confirm."
      );
    } catch (error: any) {
      console.error("Failed to upload ID photo:", error);
      Alert.alert(
        "Upload Error",
        "Failed to upload ID photo. Please try again."
      );
    } finally {
      setIsUploadingIdPhoto(false);
    }
  };

  const handleConfirmIdPhoto = async () => {
    try {
      await confirmHandoverIdPhoto(conversationId, message.id);
    } catch (error: any) {
      console.error("Failed to confirm ID photo:", error);
      Alert.alert("Error", "Failed to confirm ID photo. Please try again.");
    }
  };

  const handleClaimResponse = async (status: "accepted" | "rejected") => {
    if (!onClaimResponse) return;

    if (status === "accepted") {
      setShowIdPhotoModal(true);
      return;
    }

    try {
      await updateClaimResponse(conversationId, message.id, status);
      onClaimResponse(message.id, status);
    } catch (error) {
      console.error("Failed to update claim response:", error);
      Alert.alert(
        "Error",
        "Failed to update claim response. Please try again."
      );
    }
  };

  const handleClaimIdPhotoUpload = async (photoUri: string) => {
    try {
      setIsUploadingIdPhoto(true);

      // Upload ID photo to Cloudinary
      const { cloudinaryService } = await import("@/utils/cloudinary");
      const uploadedUrl = await cloudinaryService.uploadImage(
        photoUri,
        "id_photos"
      );

      // Update claim response with ID photo
      const { messageService } = await import("@/utils/firebase");
      await messageService.updateClaimResponse(
        conversationId,
        message.id,
        "accepted",
        currentUserId,
        uploadedUrl
      );

      onClaimResponse?.(message.id, "accepted");
      setShowIdPhotoModal(false);

      Alert.alert(
        "Success",
        "ID photo uploaded successfully! The post owner will now review and confirm your claim."
      );
    } catch (error: any) {
      console.error("Failed to upload claim ID photo:", error);
      Alert.alert(
        "Upload Error",
        "Failed to upload ID photo. Please try again."
      );
    } finally {
      setIsUploadingIdPhoto(false);
    }
  };

  const handleConfirmClaimIdPhoto = async () => {
    try {
      await confirmClaimIdPhoto(conversationId, message.id);
      // Call the callback to update UI
      onClaimResponse?.(message.id, "accepted");

      // Call the success callback for navigation
      onConfirmIdPhotoSuccess?.(message.id);
    } catch (error: any) {
      console.error("Failed to confirm claim ID photo:", error);
      Alert.alert("Error", "Failed to confirm ID photo. Please try again.");
    }
  };

  const handleDeleteMessage = async () => {
    if (!isOwnMessage) return;

    Alert.alert(
      "Delete Message",
      "This action cannot be undone. Are you sure you want to delete this message?",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              setIsDeleting(true);
              await deleteMessage(conversationId, message.id);
            } catch (error: any) {
              Alert.alert(
                "Error",
                `Failed to delete message: ${error.message}`
              );
            } finally {
              setIsDeleting(false);
            }
          },
        },
      ]
    );
  };

  const renderHandoverRequest = () => {
    if (message.messageType !== "handover_request") return null;

    const handoverData = message.handoverData;
    if (!handoverData) return null;

    const canRespond = handoverData.status === "pending" && !isOwnMessage;
    const canConfirm =
      handoverData.status === "pending_confirmation" &&
      !!isCurrentUserPostOwner;
    const isCompleted =
      handoverData.status === "accepted" || handoverData.status === "rejected";

    return (
      <View className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
        <Text className="text-sm text-blue-800 mb-2">
          <Text className="font-bold">Handover Request:</Text>{" "}
          {handoverData.postTitle}
        </Text>

        {/* Show ID photo if uploaded and not deleted */}
        {handoverData.idPhotoUrl && !handoverData.photosDeleted && (
          <View className="mb-3 p-2 bg-white rounded border">
            <Text className="text-xs text-gray-600 mb-1">Finder ID Photo:</Text>
            <TouchableOpacity
              onPress={() => {
                if (handoverData.idPhotoUrl && onImageClick) {
                  // Use image modal like web version
                  onImageClick(handoverData.idPhotoUrl, "Finder ID Photo");
                }
              }}
            >
              <Image
                source={{ uri: handoverData.idPhotoUrl }}
                className="w-24 h-16 rounded"
                resizeMode="cover"
              />
              <Text className="text-xs text-blue-500 text-center mt-1">
                Tap to view full size
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Show photos deleted indicator if photos were deleted */}
        {handoverData.photosDeleted && (
          <View className="mb-3 p-2 bg-red-50 rounded border border-red-200">
            <Text className="text-xs text-red-600 font-medium mb-1">
              🗑️ Photos Deleted
            </Text>
            <Text className="text-xs text-red-500">
              All photos have been removed from this request
            </Text>
          </View>
        )}

        {/* Show owner's ID photo if uploaded */}
        {handoverData.ownerIdPhoto && (
          <View className="mb-3 p-2 bg-white rounded border">
            <Text className="text-xs text-gray-600 mb-1">Owner ID Photo:</Text>
            <TouchableOpacity
              onPress={() => {
                if (handoverData.ownerIdPhoto && onImageClick) {
                  // Use image modal like web version
                  onImageClick(handoverData.ownerIdPhoto, "Owner ID Photo");
                }
              }}
            >
              <Image
                source={{ uri: handoverData.ownerIdPhoto }}
                className="w-24 h-16 rounded"
                resizeMode="cover"
              />
              <Text className="text-xs text-blue-500 text-center mt-1">
                Tap to view full size
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Show item photos if uploaded and not deleted */}
        {handoverData.itemPhotos && handoverData.itemPhotos.length > 0 && !handoverData.photosDeleted && (
          <View className="mb-3 p-2 bg-white rounded border">
            <Text className="text-xs text-gray-600 mb-1 font-medium">
              Item Photos:
            </Text>
            <View className="gap-2">
              {handoverData.itemPhotos.map((photo, index) => (
                <View key={index}>
                  <TouchableOpacity
                    onPress={() => {
                      if (onImageClick) {
                        // Use image modal like web version
                        onImageClick(photo.url, `Item Photo ${index + 1}`);
                      }
                    }}
                  >
                    <Image
                      source={{ uri: photo.url }}
                      className="w-full h-32 rounded"
                      resizeMode="cover"
                    />
                    <Text className="text-xs text-gray-500 mt-1">
                      Item photo {index + 1}
                    </Text>
                    <Text className="text-xs text-blue-500 text-center mt-1">
                      Tap to view full size
                    </Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Action buttons */}
        {canRespond ? (
          <View className="flex-row gap-2">
            <TouchableOpacity
              onPress={() => handleHandoverResponse("accepted")}
              className="px-3 py-1 bg-green-500 rounded-md"
            >
              <Text className="text-white text-xs">Accept</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handleHandoverResponse("rejected")}
              className="px-3 py-1 bg-red-500 rounded-md"
            >
              <Text className="text-white text-xs">Reject</Text>
            </TouchableOpacity>
          </View>
        ) : canConfirm ? (
          <View className="flex-row gap-2">
            <TouchableOpacity
              onPress={handleConfirmIdPhoto}
              className="px-3 py-1 bg-blue-500 rounded-md"
            >
              <Text className="text-white text-xs">Confirm ID Photo</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handleHandoverResponse("rejected")}
              className="px-3 py-1 bg-red-500 rounded-md"
            >
              <Text className="text-white text-xs">Reject Handover</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <Text className="text-xs text-blue-600">
            Status:{" "}
            <Text className="capitalize font-medium">
              {handoverData.status}
            </Text>
            {isCompleted && handoverData.respondedAt && (
              <Text className="ml-2">
                at {formatTime(handoverData.respondedAt)}
              </Text>
            )}
            {handoverData.status === "accepted" &&
              handoverData.idPhotoConfirmed && (
                <Text className="ml-2 text-green-600">
                  ✓ ID Photo Confirmed
                </Text>
              )}
            {handoverData.status === "accepted" &&
              handoverData.itemPhotosConfirmed && (
                <Text className="ml-2 text-green-600">
                  ✓ Item Photos Confirmed
                </Text>
              )}
          </Text>
        )}
      </View>
    );
  };

  const renderHandoverResponse = () => {
    if (message.messageType !== "handover_response") return null;

    const handoverData = message.handoverData;
    if (!handoverData) return null;

    const statusColor =
      handoverData.status === "accepted" ? "text-green-600" : "text-red-600";
    const statusIcon = handoverData.status === "accepted" ? "✓" : "✗";

    return (
      <View className="mt-2 p-2 bg-gray-50 rounded-lg border border-gray-200">
        <View className={`flex-row items-center gap-2`}>
          <Text>{statusIcon}</Text>
          <Text className={`text-sm ${statusColor} capitalize font-medium`}>
            {handoverData.status}
          </Text>
          {handoverData.responseMessage && (
            <Text className="text-gray-600 text-sm">
              - {handoverData.responseMessage}
            </Text>
          )}
        </View>
      </View>
    );
  };

  const renderClaimRequest = () => {
    if (message.messageType !== "claim_request") return null;

    const claimData = message.claimData;
    if (!claimData) return null;

    const canRespond = claimData.status === "pending" && !isOwnMessage;
    const canConfirm =
      claimData.status === "pending_confirmation" && !!isCurrentUserPostOwner;
    const isCompleted =
      claimData.status === "accepted" || claimData.status === "rejected";

    return (
      <View className="mt-3 p-3 bg-purple-50 rounded-lg border border-purple-200">
        <Text className="text-sm text-purple-800 mb-2">
          <Text className="font-bold">Claim Request:</Text>{" "}
          {claimData.postTitle}
        </Text>

        {/* Show claim reason if provided */}
        {claimData.claimReason && (
          <View className="mb-3 p-2 bg-white rounded border">
            <Text className="text-xs text-gray-600 mb-1 font-medium">
              Claim Reason:
            </Text>
            <Text className="text-sm text-gray-800">
              {claimData.claimReason}
            </Text>
          </View>
        )}

        {/* Show claimer's ID photo if uploaded and not deleted */}
        {claimData.idPhotoUrl && !claimData.photosDeleted && (
          <View className="mb-3 p-2 bg-white rounded border">
            <Text className="text-xs text-gray-600 mb-1">
              Claimer ID Photo:
            </Text>
            <TouchableOpacity
              onPress={() => {
                if (claimData.idPhotoUrl) {
                  // For mobile, we'll use a simple alert with option to view
                  Alert.alert(
                    "View Claimer ID Photo",
                    "Would you like to view the full-size claimer ID photo?",
                    [
                      { text: "Cancel", style: "cancel" },
                      {
                        text: "View Full Size",
                        onPress: () => {
                          // Open in device's default image viewer
                          if (claimData.idPhotoUrl) {
                            Linking.openURL(claimData.idPhotoUrl);
                          }
                        },
                      },
                    ]
                  );
                }
              }}
            >
              <Image
                source={{ uri: claimData.idPhotoUrl }}
                className="w-24 h-16 rounded"
                resizeMode="cover"
              />
              <Text className="text-xs text-blue-500 text-center mt-1">
                Tap to view full size
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Show photos deleted indicator if photos were deleted */}
        {claimData.photosDeleted && (
          <View className="mb-3 p-2 bg-red-50 rounded border border-red-200">
            <Text className="text-xs text-red-600 font-medium mb-1">
              🗑️ Photos Deleted
            </Text>
            <Text className="text-xs text-red-500">
              All photos have been removed from this request
            </Text>
          </View>
        )}

        {/* Show owner's ID photo if uploaded */}
        {claimData.ownerIdPhoto && (
          <View className="mb-3 p-2 bg-white rounded border">
            <Text className="text-xs text-gray-600 mb-1">Owner ID Photo:</Text>
            <TouchableOpacity
              onPress={() => {
                if (claimData.ownerIdPhoto) {
                  // For mobile, we'll use a simple alert with option to view
                  Alert.alert(
                    "View Owner ID Photo",
                    "Would you like to view the full-size owner ID photo?",
                    [
                      { text: "Cancel", style: "cancel" },
                      {
                        text: "View Full Size",
                        onPress: () => {
                          // Open in device's default image viewer
                          if (claimData.ownerIdPhoto) {
                            Linking.openURL(claimData.ownerIdPhoto);
                          }
                        },
                      },
                    ]
                  );
                }
              }}
            >
              <Image
                source={{ uri: claimData.ownerIdPhoto }}
                className="w-24 h-16 rounded"
                resizeMode="cover"
              />
              <Text className="text-xs text-blue-500 text-center mt-1">
                Tap to view full size
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Show evidence photos if uploaded and not deleted */}
        {claimData.evidencePhotos && claimData.evidencePhotos.length > 0 && !claimData.photosDeleted && (
          <View className="mb-3 p-2 bg-white rounded border">
            <Text className="text-xs text-gray-600 mb-1 font-medium">
              Evidence Photos:
            </Text>
            <View className="gap-2">
              {claimData.evidencePhotos.map((photo, index) => (
                <View key={index}>
                  <TouchableOpacity
                    onPress={() => {
                      Alert.alert(
                        `View Evidence Photo ${index + 1}`,
                        "Would you like to view the full-size evidence photo?",
                        [
                          { text: "Cancel", style: "cancel" },
                          {
                            text: "View Full Size",
                            onPress: () => {
                              Linking.openURL(photo.url);
                            },
                          },
                        ]
                      );
                    }}
                  >
                    <Image
                      source={{ uri: photo.url }}
                      className="w-full h-32 rounded"
                      resizeMode="cover"
                    />
                    <Text className="text-xs text-gray-500 mt-1">
                      Evidence photo {index + 1}
                    </Text>
                    <Text className="text-xs text-blue-500 text-center mt-1">
                      Tap to view full size
                    </Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Show legacy verification photos if exists (for backward compatibility) */}
        {claimData.verificationPhotos &&
          claimData.verificationPhotos.length > 0 &&
          !claimData.evidencePhotos && (
            <View className="mb-3 p-2 bg-white rounded border">
              <Text className="text-xs text-gray-600 mb-1 font-medium">
                Verification Photos:
              </Text>
              <View className="gap-2">
                {claimData.verificationPhotos.map((photo, index) => (
                  <View key={index}>
                    <TouchableOpacity
                      onPress={() => {
                        Alert.alert(
                          `View Verification Photo ${index + 1}`,
                          "Would you like to view the full-size verification photo?",
                          [
                            { text: "Cancel", style: "cancel" },
                            {
                              text: "View Full Size",
                              onPress: () => {
                                Linking.openURL(photo.url);
                              },
                            },
                          ]
                        );
                      }}
                    >
                      <Image
                        source={{ uri: photo.url }}
                        className="w-full h-32 rounded"
                        resizeMode="cover"
                      />
                      <Text className="text-xs text-gray-500 mt-1">
                        Verification photo {index + 1}
                      </Text>
                      <Text className="text-xs text-blue-500 text-center mt-1">
                        Tap to view full size
                      </Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            </View>
          )}

        {/* Action buttons */}
        {canRespond ? (
          <View className="flex-row gap-2">
            <TouchableOpacity
              onPress={() => handleClaimResponse("accepted")}
              className="px-3 py-1 bg-green-500 rounded-md"
            >
              <Text className="text-white text-xs">Accept Claim</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handleClaimResponse("rejected")}
              className="px-3 py-1 bg-red-500 rounded-md"
            >
              <Text className="text-white text-xs">Reject Claim</Text>
            </TouchableOpacity>
          </View>
        ) : canConfirm ? (
          <View className="flex-row gap-2">
            <TouchableOpacity
              onPress={handleConfirmClaimIdPhoto}
              className="px-3 py-1 bg-blue-500 rounded-md"
            >
              <Text className="text-white text-xs">Confirm ID Photo</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handleClaimResponse("rejected")}
              className="px-3 py-1 bg-red-500 rounded-md"
            >
              <Text className="text-white text-xs">Reject Claim</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <Text className="text-xs text-purple-600">
            Status:{" "}
            <Text className="capitalize font-medium">{claimData.status}</Text>
            {isCompleted && claimData.respondedAt && (
              <Text className="ml-2">
                at {formatTime(claimData.respondedAt)}
              </Text>
            )}
            {claimData.status === "accepted" && claimData.idPhotoConfirmed && (
              <Text className="ml-2 text-green-600">✓ ID Photo Confirmed</Text>
            )}
            {claimData.status === "accepted" &&
              claimData.evidencePhotosConfirmed && (
                <Text className="ml-2 text-green-600">
                  ✓ Evidence Photos Confirmed
                </Text>
              )}
            {claimData.status === "accepted" &&
              claimData.idPhotoConfirmed &&
              !claimData.evidencePhotosConfirmed && (
                <Text className="ml-2 text-green-600">
                  ✓ ID Photo Confirmed
                </Text>
              )}
            {claimData.status === "accepted" &&
              claimData.photosConfirmed &&
              !claimData.evidencePhotosConfirmed && (
                <Text className="ml-2 text-green-600">
                  ✓ Verification Photos Confirmed
                </Text>
              )}
          </Text>
        )}
      </View>
    );
  };

  const renderClaimResponse = () => {
    if (message.messageType !== "claim_response") return null;

    const claimData = message.claimData;
    if (!claimData) return null;

    const statusColor =
      claimData.status === "accepted" ? "text-green-600" : "text-red-600";
    const statusIcon = claimData.status === "accepted" ? "✓" : "✗";

    return (
      <View className="mt-2 p-2 bg-gray-50 rounded-lg border border-gray-200">
        <View className={`flex-row items-center gap-2`}>
          <Text>{statusIcon}</Text>
          <Text className={`text-sm ${statusColor} capitalize font-medium`}>
            Claim {claimData.status}
          </Text>
          {claimData.responseMessage && (
            <Text className="text-gray-600 text-sm">
              - {claimData.responseMessage}
            </Text>
          )}
        </View>
      </View>
    );
  };

  const renderSystemMessage = () => {
    if (message.messageType !== "system") return null;

    return (
      <View className="mt-2 p-2 bg-yellow-50 rounded-lg border border-yellow-200">
        <Text className="text-sm text-yellow-800">
          <Text className="font-medium">System:</Text> {message.text}
        </Text>
      </View>
    );
  };

  // ID Photo Modal using ImagePicker component
  const renderIdPhotoModal = () => {
    if (!showIdPhotoModal) return null;

    const uploadHandler =
      message.messageType === "claim_request"
        ? handleClaimIdPhotoUpload
        : handleIdPhotoUpload;

    return (
      <ImagePicker
        onImageSelect={uploadHandler}
        onClose={() => setShowIdPhotoModal(false)}
        isUploading={isUploadingIdPhoto}
      />
    );
  };

  return (
    <View className={`mb-3 ${isOwnMessage ? "items-end" : "items-start"}`}>
      {renderIdPhotoModal()}
      <View
        className={`max-w-[80%] rounded-2xl px-4 py-3 ${
          isOwnMessage
            ? "bg-navyblue rounded-br-md"
            : "bg-zinc-200 rounded-bl-md"
        }`}
      >
        <Text
          className={`text-base font-inter ${
            isOwnMessage ? "text-white" : "text-gray-800"
          }`}
        >
          {message.text}
        </Text>

        {/* Render special message types */}
        {renderHandoverRequest()}
        {renderHandoverResponse()}
        {renderClaimRequest()}
        {renderClaimResponse()}
        {renderSystemMessage()}
      </View>
      <View className="flex-row items-center justify-between mt-1 mx-2">
        <View className="flex-row items-center gap-1">
          <Text className="text-xs text-gray-500">
            {formatTime(message.timestamp)}
          </Text>
          {isOwnMessage && (
            <View>
              {message.readBy && message.readBy.length > 1 ? (
                <Ionicons name="eye" size={12} color="#3b82f6" />
              ) : (
                <Ionicons name="checkmark" size={12} color="#9ca3af" />
              )}
            </View>
          )}
        </View>

        {/* Delete button for own messages */}
        {isOwnMessage && (
          <TouchableOpacity
            onPress={handleDeleteMessage}
            disabled={isDeleting}
            className="ml-2 p-1"
          >
            <Ionicons
              name="trash-outline"
              size={16}
              color={isDeleting ? "#9ca3af" : "#ef4444"}
            />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

export default MessageBubble;
