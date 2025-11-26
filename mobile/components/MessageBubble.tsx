import React, { useState, FC, useMemo, useCallback } from "react";
import {
  Text,
  TouchableOpacity,
  View,
  Alert,
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useMessage } from "../context/MessageContext";
import type { Message } from "../types/type";
import ProfilePicture from "./ProfilePicture";
import ProfilePictureSeenIndicator from "./ProfilePictureSeenIndicator";
import PhotoViewerModal from "./PhotoViewerModal";
import {
  handoverClaimService,
  type HandoverClaimCallbacks,
} from "../utils/handoverClaimService";

interface ParticipantData {
  profilePicture?: string;
  photoURL?: string;
  avatar?: string;
  profilePic?: string;
  image?: string;
  picture?: string;
  photo?: string;
  profilePicUrl?: string;
  profileImageUrl?: string;
  firstName: string;
  lastName: string;
  [key: string]: any;
}

const PROFILE_PICTURE_FIELDS = [
  "profilePicture",
  "photoURL",
  "avatar",
  "profilePic",
  "image",
  "picture",
  "photo",
  "profilePicUrl",
  "profileImageUrl",
  "profile_pic",
  "profile_pic_url",
];

const getProfilePictureFromData = (data: any): string | null => {
  if (!data || typeof data !== "object") return null;
  for (const field of PROFILE_PICTURE_FIELDS) {
    const value = data[field];
    if (typeof value === "string" && value.trim() !== "") {
      return value;
    }
  }
  return null;
};

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
    status: "accepted" | "rejected",
    idPhotoUrl?: string
  ) => void;
  onConfirmIdPhotoSuccess?: (messageId: string) => void;
  onImageClick?: (imageUrl: string, altText: string) => void;
  triggerImagePicker?: (messageId: string, messageType: "handover_request" | "claim_request") => void;
  isConfirmationInProgress?: boolean;
  conversationParticipants?: {
    [uid: string]: ParticipantData;
  };
  isLastSeenByOthers?: boolean;
  fallbackProfilePicture?: string | null;
}

const MessageBubble: FC<MessageBubbleProps> = ({
  message,
  isOwnMessage,
  conversationId,
  currentUserId,
  isCurrentUserPostOwner,
  onHandoverResponse,
  onClaimResponse,
  onConfirmIdPhotoSuccess,
  onImageClick,
  triggerImagePicker,
  isConfirmationInProgress = false,
  conversationParticipants = {},
  isLastSeenByOthers = false,
  fallbackProfilePicture = null,
}) => {
  const { deleteMessage } = useMessage();
  const [isDeleting, setIsDeleting] = useState(false);
  const [showPhotoViewerModal, setShowPhotoViewerModal] = useState(false);
  const [photoViewerImages, setPhotoViewerImages] = useState<string[]>([]);
  const [photoViewerInitialIndex, setPhotoViewerInitialIndex] = useState(0);

  // Format time helper function
  const formatTime = (timestamp: any) => {
    if (!timestamp) return "";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  // Main message content
  const renderMessageContent = () => {
    if (!message?.text) return null;
    
    // Determine message delivery status
    const isDelivered = message.readBy && message.readBy.length > 0;
    
    return (
      <View className="flex-1">
        <View
          className={`p-3 rounded-2xl ${
            isOwnMessage ? 'bg-blue-500' : 'bg-gray-200'
          }`}
        >
          <Text
            className={`text-sm ${isOwnMessage ? 'text-white' : 'text-gray-800'}`}
          >
            {message.text}
          </Text>
          <Text
            className={`text-xs mt-1 ${
              isOwnMessage ? 'text-blue-100' : 'text-gray-500'
            }`}
          >
            {formatTime(message.timestamp)}
          </Text>
        </View>
        
        {/* Render message status */}
        {isOwnMessage && (
          <View className="flex-row items-center justify-end mt-1">
            <Text className="text-xs text-gray-500">
              {isDelivered ? 'Delivered' : 'Sent'}
            </Text>
          </View>
        )}
      </View>
    );
  };

  // Helper function to open photo viewer modal
  const openPhotoViewer = (images: string[], initialIndex: number = 0) => {
    setPhotoViewerImages(images);
    setPhotoViewerInitialIndex(initialIndex);
    setShowPhotoViewerModal(true);
  };

  // Get the other participant's data (for the profile picture)
  const getOtherParticipantData = (): ParticipantData | null => {
    if (!conversationParticipants) return null;
    
    // Find the first participant that's not the current user
    const participantId = Object.keys(conversationParticipants).find(
      (uid) => uid !== currentUserId
    );
    
    if (!participantId) return null;
    
    const participant = conversationParticipants[participantId];
    if (!participant || typeof participant !== "object") return null;

    const profilePicUrl = getProfilePictureFromData(participant);

    return {
      ...participant,
      firstName: participant.firstName || "Unknown",
      lastName: participant.lastName || "User",
      profilePicture: profilePicUrl || undefined,
    };
  };

  // Memoize the other participant data
  const getOtherParticipantDataMemoized = useCallback(
    getOtherParticipantData,
    [conversationParticipants, currentUserId]
  );
  
  const otherParticipant = useMemo(
    () => getOtherParticipantDataMemoized(),
    [getOtherParticipantDataMemoized]
  );

  const resolvedSenderProfilePicture = useMemo(() => {
    // For other users' messages, prioritize the fallbackProfilePicture if available
    if (!isOwnMessage && fallbackProfilePicture) {
      return fallbackProfilePicture;
    }

    // For own messages or if no fallback is available, check other sources
    if (
      typeof message.senderProfilePicture === "string" &&
      message.senderProfilePicture.trim() !== ""
    ) {
      return message.senderProfilePicture;
    }

    const participantData = conversationParticipants?.[message.senderId];
    const participantPicture = getProfilePictureFromData(participantData);
    if (participantPicture) {
      return participantPicture;
    }

    if (!isOwnMessage) {
      const otherPicture = getProfilePictureFromData(otherParticipant);
      if (otherPicture) {
        return otherPicture;
      }
    }

    // Fallback to the fallbackProfilePicture if not already returned
    if (fallbackProfilePicture && typeof fallbackProfilePicture === "string") {
      return fallbackProfilePicture;
    }

    return null;
  }, [
    message.senderProfilePicture,
    conversationParticipants,
    message.senderId,
    otherParticipant,
    isOwnMessage,
    fallbackProfilePicture,
  ]);

  
  // Add a check for message existence
  if (!message) {
    return null;
  }

  // Convert readBy user IDs to user objects with profile data
  const getReadersWithProfileData = () => {
    if (!message.readBy || !Array.isArray(message.readBy)) return [];

    return message.readBy
      .filter((uid: string) => uid !== currentUserId)
      .map((uid: string) => {
        const participant = conversationParticipants?.[uid];
        const resolvedParticipant =
          participant ||
          (otherParticipant && (otherParticipant as any)?.uid === uid
            ? otherParticipant
            : undefined);

        let profilePicture = getProfilePictureFromData(participant);

        if (!profilePicture && resolvedParticipant) {
          profilePicture = getProfilePictureFromData(resolvedParticipant);
        }

        if (!profilePicture) {
          if (uid === message.senderId && resolvedSenderProfilePicture) {
            profilePicture = resolvedSenderProfilePicture;
          } else if (
            otherParticipant &&
            (otherParticipant as any)?.uid === uid &&
            typeof fallbackProfilePicture === "string"
          ) {
            profilePicture = fallbackProfilePicture;
          } else if (typeof fallbackProfilePicture === "string") {
            profilePicture = fallbackProfilePicture;
          }
        }

        const firstName =
          resolvedParticipant?.firstName ||
          participant?.firstName ||
          (otherParticipant && (otherParticipant as any)?.uid === uid
            ? otherParticipant.firstName
            : undefined) ||
          "Unknown";

        const lastName =
          resolvedParticipant?.lastName ||
          participant?.lastName ||
          (otherParticipant && (otherParticipant as any)?.uid === uid
            ? otherParticipant.lastName
            : undefined) ||
          "User";

        return {
          uid,
          profilePicture: profilePicture || null,
          firstName,
          lastName,
        };
      })
      .filter((reader) => reader !== null);
  };

  const handleHandoverResponse = async (status: "accepted" | "rejected") => {
    if (!onHandoverResponse) return;

    // If accepting, trigger ImagePicker at Chat level
    if (status === "accepted") {
      if (triggerImagePicker) {
        triggerImagePicker(message.id, "handover_request");
      }
      return;
    }

    // For rejection, use the consolidated service
    const callbacks: HandoverClaimCallbacks = {
      onHandoverResponse,
      onError: (error) => Alert.alert("Error", error),
    };

    await handoverClaimService.handleHandoverResponse(
      conversationId,
      message.id,
      status,
      currentUserId,
      callbacks
    );
  };

  const handleConfirmIdPhoto = async () => {
    const callbacks: HandoverClaimCallbacks = {
      onSuccess: (message) => Alert.alert("Success", message),
      onError: (error) => Alert.alert("Error", error),
      onClearConversation: () => {
        if (onConfirmIdPhotoSuccess) {
          onConfirmIdPhotoSuccess(message.id);
        }
      },
    };

    // Determine if this is a handover or claim request
    const isHandover = message.messageType === 'handover_request' || message.handoverData;
    const type = isHandover ? 'handover' : 'claim';

    await handoverClaimService.handleConfirmIdPhoto(
      conversationId,
      message.id,
      currentUserId,
      type,
      callbacks
    );
  };

  const handleClaimResponse = async (status: "accepted" | "rejected") => {
    if (!onClaimResponse) return;

    // If accepting, trigger ImagePicker at Chat level
    if (status === "accepted") {
      if (triggerImagePicker) {
        triggerImagePicker(message.id, "claim_request");
      }
      return;
    }

    // For rejection, use the consolidated service
    const callbacks: HandoverClaimCallbacks = {
      onClaimResponse: (messageId, status) => {
        if (onClaimResponse) {
          onClaimResponse(messageId, status);
        }
      },
      onError: (error) => Alert.alert("Error", error),
    };

    await handoverClaimService.handleClaimResponse(
      conversationId,
      message.id,
      status,
      currentUserId,
      callbacks
    );
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
              await deleteMessage(conversationId, message.id, currentUserId);
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

    const handoverData = message.handoverData as {
      status: string;
      postTitle?: string;
      idPhotoUrl?: string;
      photosDeleted?: boolean;
      ownerIdPhoto?: string;
      itemPhotos?: { url: string }[];
      respondedAt?: any;
      idPhotoConfirmed?: boolean;
      itemPhotosConfirmed?: boolean;
      photosConfirmed?: boolean;
    } | undefined;
    if (!handoverData) return null;

    const canRespond = handoverData.status === "pending" && !isOwnMessage;
    const canConfirm =
      handoverData.status === "pending_confirmation" &&
      !!isCurrentUserPostOwner;
    const isCompleted =
      handoverData.status === "accepted" || handoverData.status === "rejected";

    return (
      <View className="mt-3 p-3 bg-blue-50 rounded-md border border-blue-200">
        <Text className="text-sm text-blue-800 mb-2">
          <Text className="font-manrope-bold">Handover Request:</Text>{" "}
          {handoverData.postTitle}
        </Text>

        {/* Show ID photo if uploaded and not deleted */}
        {handoverData.idPhotoUrl && !handoverData.photosDeleted && (
          <View className="mb-3 p-2 bg-white rounded border">
            <Text className="text-xs font-inter text-gray-600 mb-1">
              Finder ID Photo:
            </Text>
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
              <Text className="text-xs font-inter text-blue-500 text-center mt-1">
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
            <Text className="text-xs font-inter text-red-500">
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
              <Text className="text-xs font-inter text-blue-500 text-center mt-1">
                Tap to view full size
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Show item photos if uploaded and not deleted */}
        {handoverData.itemPhotos &&
          handoverData.itemPhotos.length > 0 &&
          !handoverData.photosDeleted && (
            <View className="mb-3 p-2 bg-white rounded border">
              <Text className="text-xs font-inter text-gray-600 mb-1 font-medium">
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
                      <Text className="text-xs font-inter text-gray-500 mt-1">
                        Item photo {index + 1}
                      </Text>
                      <Text className="text-xs font-inter text-blue-500 text-center mt-1">
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
          <View className="flex-row gap-2 flex-wrap">
            <TouchableOpacity
              onPress={() => handleHandoverResponse("accepted")}
              className="px-3 py-1 bg-green-500 rounded-md flex-shrink"
            >
              <Text className="text-white text-xs">Accept</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handleHandoverResponse("rejected")}
              className="px-3 py-1 bg-red-500 rounded-md flex-shrink"
            >
              <Text className="text-white text-xs">Reject</Text>
            </TouchableOpacity>
          </View>
        ) : canConfirm ? (
          <View className="flex-row gap-2 flex-wrap">
            <TouchableOpacity
              onPress={handleConfirmIdPhoto}
              disabled={isConfirmationInProgress}
              className={`px-3 py-1 rounded-md flex-shrink ${isConfirmationInProgress ? "bg-gray-400" : "bg-blue-500"}`}
            >
              <Text className="text-white text-xs">
                {isConfirmationInProgress
                  ? "Confirming..."
                  : "Confirm ID Photo"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handleHandoverResponse("rejected")}
              className="px-3 py-1 bg-red-500 rounded-md flex-shrink"
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

    const claimData = message.claimData as {
      status: string;
      postTitle?: string;
      claimReason?: string;
      idPhotoUrl?: string;
      photosDeleted?: boolean;
      ownerIdPhoto?: string;
      evidencePhotos?: { url: string }[];
      verificationPhotos?: { url: string }[];
      respondedAt?: any;
      idPhotoConfirmed?: boolean;
      evidencePhotosConfirmed?: boolean;
      photosConfirmed?: boolean;
    } | undefined;
    if (!claimData) return null;

    const hasIdPhoto = !!claimData.idPhotoUrl || !!claimData.ownerIdPhoto;
    const isPhotoConfirmed = !!claimData.idPhotoConfirmed;

    // Allow confirmation if status is pending_confirmation OR if it's accepted but has an unconfirmed photo
    // This handles cases where the status might not have transitioned correctly
    const canConfirm =
      (claimData.status === "pending_confirmation" ||
        (claimData.status === "accepted" && hasIdPhoto)) &&
      !isPhotoConfirmed &&
      (!isOwnMessage || !!isCurrentUserPostOwner);

    // Allow uploading photo if accepted but no photo exists yet (and user is owner)
    const canUploadPhoto =
      claimData.status === "accepted" &&
      !hasIdPhoto &&
      (!isOwnMessage || !!isCurrentUserPostOwner);

    const isCompleted =
      (claimData.status === "accepted" &&
        (isPhotoConfirmed || (!hasIdPhoto && !canUploadPhoto))) ||
      claimData.status === "rejected";

    const canRespond = claimData.status === "pending" && !isOwnMessage;

    return (
      <View className="mt-3 p-3 bg-purple-50 rounded-lg border border-purple-200">
        <Text className="text-sm text-purple-800 mb-2">
          <Text className="font-manrope-bold">Claim Request:</Text>{" "}
          {claimData.postTitle}
        </Text>

        {/* Show claim reason if provided */}
        {claimData.claimReason && (
          <View className="mb-3 p-2 bg-white rounded border">
            <Text className="text-xs text-gray-600 mb-1 font-manrope-medium">
              Claim Reason:
            </Text>
            <Text className="text-sm font-inter text-gray-800">
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
                  openPhotoViewer([claimData.idPhotoUrl], 0);
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
                  openPhotoViewer([claimData.ownerIdPhoto], 0);
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
        {claimData.evidencePhotos &&
          claimData.evidencePhotos.length > 0 &&
          !claimData.photosDeleted && (
            <View className="mb-3 p-2 bg-white rounded border">
              <Text className="text-xs text-gray-600 mb-1 font-medium">
                Evidence Photos:
              </Text>
              <View className="gap-2">
                {claimData.evidencePhotos.map((photo, index) => (
                  <View key={index}>
                    <TouchableOpacity
                      onPress={() => {
                        if (claimData.evidencePhotos && claimData.evidencePhotos.length > 0) {
                          const imageUrls = claimData.evidencePhotos.map(p => p.url);
                          openPhotoViewer(imageUrls, index);
                        }
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
                        if (claimData.verificationPhotos && claimData.verificationPhotos.length > 0) {
                          const imageUrls = claimData.verificationPhotos.map(p => p.url);
                          openPhotoViewer(imageUrls, index);
                        }
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
          <View className="flex-row gap-2 flex-wrap">
            <TouchableOpacity
              onPress={() => handleClaimResponse("accepted")}
              className="px-3 py-1 bg-green-500 rounded-md flex-shrink"
            >
              <Text className="text-white text-xs">Accept Claim</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handleClaimResponse("rejected")}
              className="px-3 py-1 bg-red-500 rounded-md flex-shrink"
            >
              <Text className="text-white text-xs">Reject Claim</Text>
            </TouchableOpacity>
          </View>
        ) : canConfirm ? (
          <View className="flex-row gap-2 flex-wrap">
            <TouchableOpacity
              onPress={handleConfirmIdPhoto}
              disabled={isConfirmationInProgress}
              className={`px-3 py-1 rounded-md flex-shrink ${isConfirmationInProgress ? "bg-gray-400" : "bg-blue-500"}`}
            >
              <Text className="text-white text-xs">
                {isConfirmationInProgress
                  ? "Confirming..."
                  : "Confirm ID Photo"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handleClaimResponse("rejected")}
              className="px-3 py-1 bg-red-500 rounded-md flex-shrink"
            >
              <Text className="text-white text-xs">Reject Claim</Text>
            </TouchableOpacity>
          </View>
        ) : canUploadPhoto ? (
          <View className="flex-row gap-2 flex-wrap">
            <TouchableOpacity
              onPress={() => {
                if (triggerImagePicker) {
                  triggerImagePicker(message.id, "claim_request");
                }
              }}
              className="px-3 py-1 bg-blue-500 rounded-md flex-shrink"
            >
              <Text className="text-white text-xs">Upload ID Photo</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handleClaimResponse("rejected")}
              className="px-3 py-1 bg-red-500 rounded-md flex-shrink"
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

  return (
    <View className={`mb-3 ${isOwnMessage ? "items-end" : "items-start"}`}>
      {/* Photo Viewer Modal */}
      <PhotoViewerModal
        visible={showPhotoViewerModal}
        images={photoViewerImages}
        initialIndex={photoViewerInitialIndex}
        onClose={() => setShowPhotoViewerModal(false)}
      />

      <View
        className={`flex-row items-end gap-2 ${isOwnMessage ? "flex-row-reverse" : ""}`}
      >
        {!isOwnMessage && (
          <View className="mr-2">
            <ProfilePicture
              src={resolvedSenderProfilePicture}
              size="sm"
            />
            {isLastSeenByOthers && (
              <View className="absolute -bottom-1 -right-1 bg-blue-500 rounded-full w-3 h-3 border-2 border-white" />
            )}
          </View>
        )}

        <View className="flex-1">
          <View
            className={`flex-row ${
              isOwnMessage ? "justify-end" : "justify-start"
            }`}
          >
            <View
              className={`max-w-[75%] rounded-2xl px-4 py-3 ${
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
          </View>

          <View
            className={`flex-row items-center justify-start mt-1 mx-1 ${isOwnMessage ? "flex-row-reverse" : ""}`}
          >
            <View className="flex-row items-center gap-2">
              <Text className="text-xs text-gray-500">
                {formatTime(message.timestamp)}
              </Text>
              {isOwnMessage && isLastSeenByOthers && (
                <ProfilePictureSeenIndicator
                  readBy={getReadersWithProfileData()}
                  currentUserId={currentUserId}
                  maxVisible={3}
                  size="xs"
                />
              )}
            </View>

            {/* Delete button for own messages */}
            {isOwnMessage && (
              <TouchableOpacity
                onPress={handleDeleteMessage}
                disabled={isDeleting}
                className="mr-2 p-1"
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
      </View>
    </View>
  );
};

export default MessageBubble;
