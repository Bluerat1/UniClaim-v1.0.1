import React, { useState, useEffect, useRef } from "react";
import type { Message } from "@/types/Post";
import { useMessage } from "@/context/MessageContext";
import handoverClaimService, {
  type HandoverClaimCallbacks,
} from "../services/handoverClaimService";
import { messageService } from "../services/firebase/messages";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { AiOutlineDelete } from "react-icons/ai";
import ProfilePictureSeenIndicator from "./ProfilePictureSeenIndicator";

interface MessageBubbleProps {
  message: Message;
  isOwnMessage: boolean;
  showSenderName?: boolean;
  conversationId: string;
  currentUserId: string;
  postOwnerId?: string; // Add post owner ID for handover confirmation logic
  isLastSeenMessage?: boolean; // Indicates if this is the most recent message that has been seen by other users
  conversationParticipants?: { [uid: string]: { profilePicture?: string; firstName: string; lastName: string; } };
  onHandoverResponse?: (
    messageId: string,
    status: "accepted" | "rejected"
  ) => void;
  onClaimResponse?: (
    messageId: string,
    status: "accepted" | "rejected"
  ) => void;
  onConfirmIdPhotoSuccess?: (messageId: string) => void;
  onMessageSeen?: (messageId: string) => void; // Callback when message is seen
}

const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  isOwnMessage,
  showSenderName = false,
  conversationId,
  currentUserId,
  postOwnerId,
  isLastSeenMessage = false,
  conversationParticipants = {},
  onHandoverResponse,
  onClaimResponse,
  onConfirmIdPhotoSuccess,
  onMessageSeen,
}) => {
  const { deleteMessage } = useMessage();
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showIdPhotoModal, setShowIdPhotoModal] = useState(false);
  const [selectedIdPhoto, setSelectedIdPhoto] = useState<File | null>(null);
  const [isUploadingIdPhoto, setIsUploadingIdPhoto] = useState(false);
  const [showIdPhotoPreview, setShowIdPhotoPreview] = useState(false);
  const [previewPhotoUrl, setPreviewPhotoUrl] = useState<string | null>(null);
  const messageRef = useRef<HTMLDivElement>(null);
  const [hasBeenSeen, setHasBeenSeen] = useState(false);
  const { userData } = useAuth();
  const { showToast } = useToast();
  const userRole = userData?.role ?? "";
  const formatTime = (timestamp: any) => {
    if (!timestamp) return "";
    const date = timestamp instanceof Date ? timestamp : timestamp.toDate();
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  // Function to check if other users have seen this message
  const hasOtherUsersSeenMessage = (): boolean => {
    if (!message.readBy || message.readBy.length === 0) return false;

    // Check if any user other than the current user has read this message
    return message.readBy.some(userId => userId !== currentUserId);
  };

  // Convert readBy user IDs to user objects with profile data
  const getReadersWithProfileData = () => {
    if (!message.readBy || !Array.isArray(message.readBy)) return [];

    return message.readBy
      .filter((uid: string) => uid !== currentUserId) // Exclude current user
      .map((uid: string) => {
        const participant = conversationParticipants[uid];
        return {
          uid,
          profilePicture: participant?.profilePicture || null,
          firstName: participant?.firstName || 'Unknown',
          lastName: participant?.lastName || 'User',
        };
      })
      .filter(reader => reader !== null);
  };
  useEffect(() => {
    if (!messageRef.current || !onMessageSeen || hasBeenSeen || isOwnMessage)
      return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setHasBeenSeen(true);
            onMessageSeen(message.id);
            observer.disconnect();
          }
        });
      },
      { threshold: 0.5 } // Trigger when 50% of message is visible
    );

    observer.observe(messageRef.current);

    return () => observer.disconnect();
  }, [onMessageSeen, hasBeenSeen, isOwnMessage]);

  const handleHandoverResponse = async (status: "accepted" | "rejected") => {
    if (!onHandoverResponse) {
      return;
    }

    // If accepting, show ID photo modal
    if (status === "accepted") {
      setShowIdPhotoModal(true);
      return;
    }

    // For rejection, check if this is after ID photo confirmation
    if (message.handoverData?.status === "pending_confirmation" || message.handoverData?.ownerIdPhoto) {
      console.log("🔄 Rejecting handover after ID photo confirmation");
      try {
        await handoverClaimService.updateHandoverResponse(
          conversationId,
          message.id,
          'rejected',
          currentUserId
        );
        onHandoverResponse(message.id, "rejected");
      } catch (error: any) {
        console.error("Failed to reject handover after confirmation:", error);
        alert(`Failed to reject handover: ${error.message}`);
      }
      return;
    }

    // For rejection, use the consolidated service
    await handoverClaimService.handleHandoverResponse(
      conversationId,
      message.id,
      status,
      currentUserId
    );
  };

  const handleIdPhotoUpload = async (photoFile: File) => {
    setIsUploadingIdPhoto(true);

    // Capture message ID for the callback
    const msgId = message.id;

    const callbacks: HandoverClaimCallbacks = {
      onHandoverResponse: (messageId, status) => {
        // Handle handover response after ID photo upload
        if (onHandoverResponse) {
          onHandoverResponse(messageId, status);
        }
      },
      onClaimResponse: (messageId, status) => {
        // Handle claim response after ID photo upload
        if (onClaimResponse) {
          onClaimResponse(messageId, status);
        }
        // Don't close the modal yet, wait for the success callback
      },
      onSuccess: (_message: string) => {
        // Close the modal and reset the photo
        setShowIdPhotoModal(false);
        setSelectedIdPhoto(null);
        setPreviewPhotoUrl(null);
        setShowIdPhotoPreview(false);

        // Wait for Firebase to fully update before calling parent callback
        setTimeout(() => {
          onHandoverResponse?.(msgId, "accepted");

          // Additional delay to ensure parent has processed the callback
          setTimeout(() => {
            // The parent component will refresh the message data from Firebase
            // This ensures we get the complete updated message with ownerIdPhoto
          }, 500);
        }, 1500); // Longer delay to allow Firebase to fully update
      },
      onError: (error) => {
        let errorMessage = error;
        if (error.includes("Network request failed")) {
          errorMessage =
            "Network error. Please check your internet connection and try again.";
        } else if (error.includes("Cloudinary cloud name not configured")) {
          errorMessage = "Cloudinary not configured. Please contact support.";
        } else if (error.includes("Upload preset not configured")) {
          errorMessage = "Upload configuration error. Please contact support.";
        } else if (error.includes("permission")) {
          errorMessage = "You don't have permission to perform this action.";
        } else if (error.includes("not found")) {
          errorMessage = "The conversation or message could not be found.";
        }
        alert("Error: " + errorMessage);

        // Reset preview state on error
        setPreviewPhotoUrl(null);
        setShowIdPhotoPreview(false);
      },
    };

    try {
      // Route based on message type only
      if (message.messageType === "claim_request") {
        await handoverClaimService.handleClaimIdPhotoUpload(
          photoFile,
          conversationId,
          message.id,
          currentUserId,
          callbacks
        );
      } else if (message.messageType === "handover_request") {
        await handoverClaimService.handleIdPhotoUpload(
          photoFile,
          conversationId,
          message.id,
          currentUserId,
          callbacks
        );
      } else {
        throw new Error(`Unknown message type: ${message.messageType}`);
      }
    } catch (error: any) {
      alert(`Error: ${error.message || "Failed to upload ID photo"}`);

      // Reset preview state on error
      setPreviewPhotoUrl(null);
      setShowIdPhotoPreview(false);
    }

    setIsUploadingIdPhoto(false);
  };

  const handleConfirmIdPhoto = async () => {
    try {
      await handoverClaimService.handleConfirmIdPhoto(
        conversationId,
        message.id,
        currentUserId
      );
      // Call parent callback after successful confirmation
      onConfirmIdPhotoSuccess?.(message.id);
    } catch (error) {
      console.error("Error confirming ID photo:", error);
      showToast('error', "Failed to confirm ID photo. Please try again.");
    }
  };

  const handleClaimResponse = async (status: "accepted" | "rejected") => {
    if (!onClaimResponse) return;

    // If accepting, handle based on user role
    if (status === "accepted") {
      // For admins and campus security, show ID photo upload modal
      if (userRole === "admin" || userRole === "campus_security") {
        setShowIdPhotoModal(true);
      }
      // For regular users, they must upload an ID photo to accept the claim
      else {
        // Set a flag to indicate this is for a claim acceptance
        setShowIdPhotoModal(true);
      }
      return;
    }

    // For rejection, check if this is after ID photo confirmation
    if (message.claimData?.status === "pending_confirmation" || message.claimData?.ownerIdPhoto) {
      console.log("🔄 Rejecting claim after ID photo confirmation");
      try {
        await messageService.updateClaimResponse(
          conversationId,
          message.id,
          'rejected',
          currentUserId
        );
        onClaimResponse(message.id, "rejected");
      } catch (error: any) {
        console.error("Failed to reject claim after confirmation:", error);
        alert(`Failed to reject claim: ${error.message}`);
      }
      return;
    }

    // For rejection, use the consolidated service
    await handoverClaimService.handleClaimResponse(
      conversationId,
      message.id,
      status,
      currentUserId
    );
  };

  const handleClaimIdPhotoUpload = async (photoFile: File) => {
    setIsUploadingIdPhoto(true);

    // Capture message ID for the callback
    const msgId = message.id;

    const callbacks: HandoverClaimCallbacks = {
      onHandoverResponse: (_messageId: string, _status: 'accepted' | 'rejected') => {
        // Handle handover response after ID photo upload
        setShowIdPhotoModal(false);
        setSelectedIdPhoto(null);
        setPreviewPhotoUrl(null);
        setShowIdPhotoPreview(false);

        // For handover requests, call onHandoverResponse; for claim requests, call onClaimResponse
        if (message.messageType === "handover_request") {
          onHandoverResponse?.(msgId, "accepted");
        } else {
          onClaimResponse?.(msgId, "accepted");
        }

        // Small delay to ensure modal closes before parent callback
        setTimeout(() => {
          // Force refresh hint for parent component
        }, 200);
      },
      onClaimResponse: (_messageId: string, _status: 'accepted' | 'rejected') => {
        // Handle claim response after ID photo upload
        if (onClaimResponse) {
          onClaimResponse(_messageId, _status);
        }
        // Don't close the modal yet, wait for the success callback
      },
      onSuccess: (_message: string) => {
        // Close the modal and reset the photo
        setShowIdPhotoModal(false);
        setSelectedIdPhoto(null);
        setPreviewPhotoUrl(null);
        setShowIdPhotoPreview(false);

        // Wait for Firebase to fully update before calling parent callback
        setTimeout(() => {
          onClaimResponse?.(msgId, "accepted");

          // Additional delay to ensure parent has processed the callback
          setTimeout(() => {
            // The parent component will refresh the message data from Firebase
            // This ensures we get the complete updated message with ownerIdPhoto
          }, 500);
        }, 1500); // Longer delay to allow Firebase to fully update
      },
    };

    await handoverClaimService.handleClaimIdPhotoUpload(
      photoFile,
      conversationId,
      message.id,
      currentUserId,
      callbacks
    );

    setIsUploadingIdPhoto(false);
  };

  const handleConfirmClaimIdPhoto = async () => {
    try {
      await handoverClaimService.handleConfirmClaimIdPhoto(
        conversationId,
        message.id,
        currentUserId
      );
      // Call parent callback after successful confirmation
      onConfirmIdPhotoSuccess?.(message.id);
    } catch (error) {
      console.error("Error confirming claim ID photo:", error);
      showToast('error', "Failed to confirm claim ID photo. Please try again.");
    }
  };

  const handleDeleteMessage = async () => {
    if (!isOwnMessage) return;

    try {
      setIsDeleting(true);
      await deleteMessage(conversationId, message.id);
      setShowDeleteConfirm(false);
    } catch (error: any) {
      alert(`Failed to delete message: ${error.message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  // Handle image click to open in new tab
  const handleImageClick = (imageUrl: string) => {
    window.open(imageUrl, '_blank');
  };

  const renderHandoverRequest = () => {
    if (message.messageType !== "handover_request") {
      return null;
    }

    const handoverData = message.handoverData;
    if (!handoverData) {
      return null;
    }

    // Show different UI based on status and user role
    const canRespond = handoverData.status === "pending" && !isOwnMessage;
    const canConfirm =
      handoverData.status === "pending_confirmation" &&
      postOwnerId === currentUserId;
    const isCompleted =
      handoverData.status === "accepted" || handoverData.status === "rejected";

    return (
      <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
        <div className="text-sm text-blue-800 mb-2">
          <strong>Handover Request:</strong> {handoverData.postTitle}
        </div>

        {/* Show ID photo if uploaded and not deleted */}
        {handoverData.idPhotoUrl && !handoverData.photosDeleted && (
          <div className="mb-3 p-2 bg-white rounded border">
            <div className="text-xs text-gray-600 mb-1">Finder ID Photo:</div>
            <div className="relative">
              <img
                src={handoverData.idPhotoUrl}
                alt="Finder ID Photo"
                className="w-24 h-16 rounded object-cover cursor-pointer hover:opacity-90 transition-opacity group"
                onClick={() =>
                  handleImageClick(handoverData.idPhotoUrl!)
                }
                title="Click to view full size"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-all rounded flex items-center justify-center pointer-events-none">
                <span className="text-white opacity-0 group-hover:opacity-100 text-xs font-medium">
                  Click to expand
                </span>
              </div>
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Click the photo to view full size
            </div>
          </div>
        )}

        {/* Show photos deleted indicator if photos were deleted */}
        {handoverData.photosDeleted && (
          <div className="mb-3 p-2 bg-red-50 rounded border border-red-200">
            <div className="text-xs text-red-600 font-medium mb-1">
              🗑️ Photos Deleted
            </div>
            <div className="text-xs text-red-500">
              All photos have been removed from this request
            </div>
          </div>
        )}

        {/* Show owner's ID photo if uploaded */}
        {(() => {
          try {
            if (
              handoverData.ownerIdPhoto &&
              typeof handoverData.ownerIdPhoto === "string"
            ) {
              return (
                <div className="mb-3 p-2 bg-white rounded border">
                  <div className="text-xs text-gray-600 mb-1">
                    Owner ID Photo:
                  </div>
                  <div className="relative">
                    <img
                      src={handoverData.ownerIdPhoto}
                      alt="Owner ID Photo"
                      className="w-24 h-16 rounded object-cover cursor-pointer hover:opacity-90 transition-opacity group"
                      onClick={() => {
                        try {
                          handleImageClick(
                            handoverData.ownerIdPhoto!
                          );
                        } catch (clickError) {
                          console.error(
                            "❌ Error in owner photo click:",
                            clickError
                          );
                        }
                      }}
                      onError={(e) => {
                        console.error(
                          "❌ Error loading owner ID photo:",
                          handoverData.ownerIdPhoto
                        );
                        e.currentTarget.style.display = "none";
                      }}
                      title="Click to view full size"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-all rounded flex items-center justify-center pointer-events-none">
                      <span className="text-white opacity-0 group-hover:opacity-100 text-xs font-medium">
                        Click to expand
                      </span>
                    </div>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Click the photo to view full size
                  </div>
                </div>
              );
            }
            return null;
          } catch (photoError) {
            console.error("❌ Error rendering owner ID photo:", photoError);
            return null;
          }
        })()}

        {/* Show item photos if uploaded and not deleted */}
        {handoverData.itemPhotos &&
          handoverData.itemPhotos.length > 0 &&
          !handoverData.photosDeleted && (
            <div className="mb-3 p-2 bg-white rounded border">
              <div className="text-xs text-gray-600 mb-1 font-medium">
                Item Photos:
              </div>
              <div className="grid grid-cols-1 gap-2">
                {handoverData.itemPhotos.map((photo, index) => (
                  <div key={index} className="relative">
                    <img
                      src={photo.url}
                      alt={`Item Photo ${index + 1}`}
                      className="w-full h-32 rounded object-cover cursor-pointer hover:opacity-90 transition-opacity group"
                      onClick={() =>
                        handleImageClick(photo.url)
                      }
                      title="Click to view full size"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-all rounded flex items-center justify-center pointer-events-none">
                      <span className="text-white opacity-0 group-hover:opacity-100 text-xs font-medium">
                        Click to expand
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">Item photo</div>
                  </div>
                ))}
              </div>
              <div className="text-xs text-gray-500 mt-2">
                Click any photo to view full size
              </div>
            </div>
          )}

        {/* Action buttons */}
        {canRespond ? (
          <div className="flex gap-2">
            <button
              onClick={() => handleHandoverResponse("accepted")}
              className="px-3 py-1 bg-green-500 text-white text-xs rounded-md hover:bg-green-600 transition-colors"
            >
              Accept
            </button>
            <button
              onClick={() => handleHandoverResponse("rejected")}
              className="px-3 py-1 bg-red-500 text-white text-xs rounded-md hover:bg-red-600 transition-colors"
            >
              Reject
            </button>
          </div>
        ) : canConfirm ? (
          <div className="flex gap-2">
            <button
              onClick={handleConfirmIdPhoto}
              className="px-3 py-1 bg-blue-500 text-white text-xs rounded-md hover:bg-blue-600 transition-colors"
            >
              Confirm ID Photo
            </button>
            <button
              onClick={() => handleHandoverResponse("rejected")}
              className="px-3 py-1 bg-red-500 text-white text-xs rounded-md hover:bg-red-600 transition-colors"
            >
              Reject Handover
            </button>
          </div>
        ) : (
          <div className="text-xs text-blue-600">
            Status:{" "}
            <span className="capitalize font-medium">
              {handoverData.status}
            </span>
            {isCompleted && handoverData.respondedAt && (
              <span className="ml-2">
                at {formatTime(handoverData.respondedAt)}
              </span>
            )}
            {handoverData.status === "accepted" &&
              handoverData.idPhotoConfirmed && (
                <span className="ml-2 text-green-600">
                  ✓ ID Photo Confirmed
                </span>
              )}
            {handoverData.status === "accepted" &&
              handoverData.itemPhotosConfirmed && (
                <span className="ml-2 text-green-600">
                  ✓ Item Photos Confirmed
                </span>
              )}
          </div>
        )}
      </div>
    );
  };

  const renderHandoverResponse = () => {
    if (message.messageType !== "handover_response") return null;

    const handoverData = message.handoverData;
    if (!handoverData) return null;

    const statusColor =
      handoverData.status === "accepted" ? "text-green-600" : "text-red-600";
    const statusIcon = handoverData.status === "accepted" ? "✅" : "❌";

    return (
      <div className="mt-2 p-2 bg-gray-50 rounded-lg border border-gray-200">
        <div className={`text-sm ${statusColor} flex items-center gap-2`}>
          <span>{statusIcon}</span>
          <span className="capitalize font-medium">{handoverData.status}</span>
          {handoverData.responseMessage && (
            <span className="text-gray-600">
              - {handoverData.responseMessage}
            </span>
          )}
        </div>
      </div>
    );
  };

  const renderClaimRequest = () => {
    if (message.messageType !== "claim_request") return null;

    const claimData = message.claimData;
    if (!claimData) return null;

    // Show different UI based on status and user role
    const canRespond = claimData.status === "pending" && !isOwnMessage;
    const canConfirm =
      claimData.status === "pending_confirmation" && !isOwnMessage;
    const isCompleted =
      claimData.status === "accepted" || claimData.status === "rejected";

    return (
      <div className="mt-3 p-3 bg-purple-50 rounded-lg border border-purple-200">
        <div className="text-sm text-purple-800 mb-2">
          <strong>Claim Request:</strong> {claimData.postTitle}
        </div>

        {/* Show claim reason if provided */}
        {claimData.claimReason && (
          <div className="mb-3 p-2 bg-white rounded border">
            <div className="text-xs text-gray-600 mb-1 font-medium">
              Claim Reason:
            </div>
            <div className="text-sm text-gray-800">{claimData.claimReason}</div>
          </div>
        )}

        {/* Show claimer's ID photo if uploaded and not deleted */}
        {claimData.idPhotoUrl && !claimData.photosDeleted && (
          <div className="mb-3 p-2 bg-white rounded border">
            <div className="text-xs text-gray-600 mb-1 font-medium">
              Claimer ID Photo:
            </div>
            <div className="relative">
              <img
                src={claimData.idPhotoUrl}
                alt="Claimer ID Photo"
                className="w-24 h-16 rounded object-cover cursor-pointer hover:opacity-90 transition-opacity group"
                onClick={() =>
                  handleImageClick(claimData.idPhotoUrl!)
                }
                title="Click to view full size"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-all rounded flex items-center justify-center pointer-events-none">
                <span className="text-white opacity-0 group-hover:opacity-100 text-xs font-medium">
                  Click to expand
                </span>
              </div>
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Click the photo to view full size
            </div>
          </div>
        )}

        {/* Show photos deleted indicator if photos were deleted */}
        {claimData.photosDeleted && (
          <div className="mb-3 p-2 bg-red-50 rounded border border-red-200">
            <div className="text-xs text-red-600 font-medium mb-1">
              🗑️ Photos Deleted
            </div>
            <div className="text-xs text-red-500">
              All photos have been removed from this request
            </div>
          </div>
        )}

        {/* Show owner's ID photo if uploaded */}
        {claimData.ownerIdPhoto && (
          <div className="mb-3 p-2 bg-white rounded border">
            <div className="text-xs text-gray-600 mb-1 font-medium">
              Owner ID Photo:
            </div>
            <div className="relative">
              <img
                src={claimData.ownerIdPhoto}
                alt="Owner ID Photo"
                className="w-24 h-16 rounded object-cover cursor-pointer hover:opacity-90 transition-opacity group"
                onClick={() =>
                  handleImageClick(claimData.ownerIdPhoto!)
                }
                title="Click to view full size"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-all rounded flex items-center justify-center pointer-events-none">
                <span className="text-white opacity-0 group-hover:opacity-100 text-xs font-medium">
                  Click to expand
                </span>
              </div>
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Click the photo to view full size
            </div>
          </div>
        )}

        {/* Show evidence photos if uploaded and not deleted */}
        {claimData.evidencePhotos &&
          claimData.evidencePhotos.length > 0 &&
          !claimData.photosDeleted && (
            <div className="mb-3 p-2 bg-white rounded border">
              <div className="text-xs text-gray-600 mb-1 font-medium">
                Evidence Photos:
              </div>
              <div className="grid grid-cols-1 gap-2">
                {claimData.evidencePhotos.map((photo, index) => (
                  <div key={index} className="relative">
                    <img
                      src={photo.url}
                      alt={`Evidence Photo ${index + 1}`}
                      className="w-full h-32 rounded object-cover cursor-pointer hover:opacity-90 transition-opacity group"
                      onClick={() =>
                        handleImageClick(
                          photo.url
                        )
                      }
                      title="Click to view full size"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-all rounded flex items-center justify-center pointer-events-none">
                      <span className="text-white opacity-0 group-hover:opacity-100 text-xs font-medium">
                        Click to expand
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      Evidence photo
                    </div>
                  </div>
                ))}
              </div>
              <div className="text-xs text-gray-500 mt-2">
                Click any photo to view full size
              </div>
            </div>
          )}

        {/* Show legacy verification photos if exists (for backward compatibility) */}
        {claimData.verificationPhotos &&
          claimData.verificationPhotos.length > 0 &&
          !claimData.evidencePhotos && (
            <div className="mb-3 p-2 bg-white rounded border">
              <div className="text-xs text-gray-600 mb-1 font-medium">
                Verification Photos:
              </div>
              <div className="grid grid-cols-1 gap-2">
                {claimData.verificationPhotos.map((photo, index) => (
                  <div key={index} className="relative">
                    <img
                      src={photo.url}
                      alt={`Verification Photo ${index + 1}`}
                      className="w-full h-32 rounded object-cover cursor-pointer hover:opacity-90 transition-opacity group"
                      onClick={() =>
                        handleImageClick(
                          photo.url
                        )
                      }
                      title="Click to view full size"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-all rounded flex items-center justify-center pointer-events-none">
                      <span className="text-white opacity-0 group-hover:opacity-100 text-xs font-medium">
                        Click to expand
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      Verification photo
                    </div>
                  </div>
                ))}
              </div>
              <div className="text-xs text-gray-500 mt-2">
                Click any photo to view full size
              </div>
            </div>
          )}

        {/* Action buttons */}
        {canRespond ? (
          <div className="flex gap-2">
            <button
              onClick={() => handleClaimResponse("accepted")}
              className="px-3 py-1 bg-green-500 text-white text-xs rounded-md hover:bg-green-600 transition-colors"
            >
              Accept Claim
            </button>
            <button
              onClick={() => handleClaimResponse("rejected")}
              className="px-3 py-1 bg-red-500 text-white text-xs rounded-md hover:bg-red-600 transition-colors"
            >
              Reject Claim
            </button>
          </div>
        ) : canConfirm ? (
          <div className="flex gap-2">
            <button
              onClick={handleConfirmClaimIdPhoto}
              className="px-3 py-1 bg-blue-500 text-white text-xs rounded-md hover:bg-blue-600 transition-colors"
            >
              Confirm ID Photo
            </button>
            <button
              onClick={() => handleClaimResponse("rejected")}
              className="px-3 py-1 bg-red-500 text-white text-xs rounded-md hover:bg-red-600 transition-colors"
            >
              Reject Claim
            </button>
          </div>
        ) : (
          <div className="text-xs text-purple-600">
            Status:{" "}
            <span className="capitalize font-medium">{claimData.status}</span>
            {isCompleted && claimData.respondedAt && (
              <span className="ml-2">
                at {formatTime(claimData.respondedAt)}
              </span>
            )}
            {claimData.status === "accepted" &&
              claimData.evidencePhotosConfirmed && (
                <span className="ml-2 text-green-600">
                  ✓ Evidence Photos Confirmed
                </span>
              )}
            {claimData.status === "accepted" &&
              claimData.idPhotoConfirmed &&
              !claimData.evidencePhotosConfirmed && (
                <span className="ml-2 text-green-600">
                  ✓ ID Photo Confirmed
                </span>
              )}
            {claimData.status === "accepted" &&
              claimData.photosConfirmed &&
              !claimData.evidencePhotosConfirmed && (
                <span className="ml-2 text-green-600">
                  ✓ Verification Photos Confirmed
                </span>
              )}
          </div>
        )}
      </div>
    );
  };

  const renderClaimResponse = () => {
    if (message.messageType !== "claim_response") return null;

    const claimData = message.claimData;
    if (!claimData) return null;

    const statusColor =
      claimData.status === "accepted" ? "text-green-600" : "text-red-600";
    const statusIcon = claimData.status === "accepted" ? "✅" : "❌";

    return (
      <div className="mt-2 p-2 bg-gray-50 rounded-lg border border-gray-200">
        <div className={`text-sm ${statusColor} flex items-center gap-2`}>
          <span>{statusIcon}</span>
          <span className="capitalize font-medium">
            Claim {claimData.status}
          </span>
          {claimData.responseMessage && (
            <span className="text-gray-600">- {claimData.responseMessage}</span>
          )}
        </div>
      </div>
    );
  };

  const renderSystemMessage = () => {
    if (message.messageType !== "system") return null;

    return (
      <div className="mt-2 p-2 bg-yellow-50 rounded-lg border border-yellow-200">
        <div className="text-sm text-yellow-800">
          <span className="font-medium">System:</span> {message.text}
        </div>
      </div>
    );
  };

  // Refs for file inputs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type.startsWith("image/")) {
      if (file.size > 5 * 1024 * 1024) {
        alert(
          "File size must be less than 5MB. Please choose a smaller image."
        );
        return;
      }
      setSelectedIdPhoto(file);

      // Create preview URL and show preview instead of auto-uploading
      const previewUrl = URL.createObjectURL(file);
      setPreviewPhotoUrl(previewUrl);
      setShowIdPhotoPreview(true);
    } else {
      alert("Please select a valid image file (JPEG, PNG, etc.)");
    }
  };

  const handleCameraCapture = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type.startsWith("image/")) {
      if (file.size > 5 * 1024 * 1024) {
        alert(
          "File size must be less than 5MB. Please choose a smaller image."
        );
        return;
      }
      setSelectedIdPhoto(file);

      // Create preview URL and show preview instead of auto-uploading
      const previewUrl = URL.createObjectURL(file);
      setPreviewPhotoUrl(previewUrl);
      setShowIdPhotoPreview(true);
    } else {
      alert("Please capture a valid image");
    }
  };

  // Cleanup preview URL when component unmounts or modal closes
  useEffect(() => {
    return () => {
      if (previewPhotoUrl) {
        URL.revokeObjectURL(previewPhotoUrl);
      }
    };
  }, [previewPhotoUrl]);

  const handleConfirmUpload = async () => {
    if (!selectedIdPhoto) return;

    setIsUploadingIdPhoto(true);

    // Use the appropriate upload handler based on message type and user
    if (
      message.messageType === "claim_request" &&
      message.senderId !== currentUserId
    ) {
      await handleClaimIdPhotoUpload(selectedIdPhoto);
    } else {
      await handleIdPhotoUpload(selectedIdPhoto);
    }
  };

  const handleCancelPreview = () => {
    // Clean up preview URL
    if (previewPhotoUrl) {
      URL.revokeObjectURL(previewPhotoUrl);
    }

    setSelectedIdPhoto(null);
    setPreviewPhotoUrl(null);
    setShowIdPhotoPreview(false);
  };

  const openGallery = () => fileInputRef.current?.click();
  const openCamera = () => cameraInputRef.current?.click();

  // ID Photo Modal for claim confirmation
  const renderIdPhotoModal = () => {
    if (!showIdPhotoModal) return null;

    // Check if this is an admin accepting a claim
    const isAdminAcceptingClaim =
      message.messageType === "claim_request" &&
      onClaimResponse &&
      message.senderId !== currentUserId &&
      (userRole === "admin" || userRole === "campus_security");
    return (
      <div className="fixed inset-0 bg-black/50 flex h-screen items-center justify-center z-[1000]" onClick={() => setShowIdPhotoModal(false)}>
        <div className="bg-white p-6 rounded-lg shadow-xl max-w-2xl w-full mx-4 relative z-[1000]" onClick={(e) => e.stopPropagation()}>
          <h3 className="text-lg font-semibold mb-4">
            {isAdminAcceptingClaim
              ? "Confirm ID Photo"
              : "Verify Your Identity"}
          </h3>

          {isAdminAcceptingClaim ? (
            <div className="grid grid-cols-2 gap-6">
              {/* Left Column */}
              <div className="bg-blue-50 p-4 rounded-md col-span-2 md:col-span-1">
                <p className="text-blue-800 font-inter font-light text-sm">
                  Please verify the ID photo and click 'Confirm' to finalize the
                  claim acceptance.
                </p>
              </div>

              {/* Right Column */}
              {message.claimData?.idPhotoUrl && (
                <div className="col-span-2 md:col-span-1">
                  <p className="text-sm text-gray-600 mb-2">ID Photo:</p>
                  <img
                    src={message.claimData.idPhotoUrl}
                    alt="Claimant's ID"
                    className="max-w-full h-50 lg:h-full rounded border border-gray-200"
                  />
                </div>
              )}

              {/* Full-width footer actions */}
              <div className="flex justify-end space-x-2 col-span-2 mt-6">
                <button
                  onClick={() => setShowIdPhotoModal(false)}
                  className="px-4 py-2 w-full text-gray-600 bg-navyblue/10 hover:bg-gray-100 rounded-md transition-colors"
                  disabled={isUploadingIdPhoto}
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    try {
                      setIsUploadingIdPhoto(true);
                      await handoverClaimService.handleConfirmClaimIdPhoto(
                        conversationId,
                        message.id,
                        currentUserId
                      );
                    } catch (error) {
                      console.error("Error confirming claim:", error);
                      showToast('error', "Failed to confirm claim. Please try again.");
                    } finally {
                      setIsUploadingIdPhoto(false);
                    }
                  }}
                  className="px-4 py-2 w-full bg-yellow-500 text-white rounded-md hover:bg-yellow-600 transition-colors disabled:opacity-50"
                  disabled={isUploadingIdPhoto}
                >
                  {isUploadingIdPhoto ? "Processing..." : "Confirm"}
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {/* Left Column */}
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-blue-800">
                  To complete your claim, please upload a clear photo of your
                  government-issued ID for verification.
                </p>
                <p className="text-sm text-blue-700 mt-2">
                  Your ID will only be used for verification purposes and will
                  be handled securely.
                </p>
              </div>
              <div className="border border-gray-300 rounded-md p-4 text-center">
                {showIdPhotoPreview && previewPhotoUrl ? (
                  /* Preview Mode */
                  <div className="space-y-4">
                    <div className="border border-gray-200 rounded-lg p-2">
                      <img
                        src={previewPhotoUrl}
                        alt="ID Photo Preview"
                        className="max-w-full h-48 object-contain rounded"
                      />
                    </div>
                    <div className="space-y-2">
                      <button
                        onClick={handleConfirmUpload}
                        className="w-full px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors disabled:opacity-50"
                        disabled={isUploadingIdPhoto}
                      >
                        {isUploadingIdPhoto ? "Uploading..." : "Confirm & Upload"}
                      </button>
                      <button
                        onClick={handleCancelPreview}
                        className="w-full px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 transition-colors"
                        disabled={isUploadingIdPhoto}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Upload Mode */
                  <>
                    {/* Hidden file inputs */}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                    <input
                      ref={cameraInputRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handleCameraCapture}
                      className="hidden"
                    />

                    {/* Upload buttons */}
                    <div className="space-y-3">
                      <button
                        onClick={openGallery}
                        className="w-full px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
                        disabled={isUploadingIdPhoto}
                      >
                        {isUploadingIdPhoto
                          ? "Uploading..."
                          : "Choose from Gallery"}
                      </button>
                      <button
                        onClick={openCamera}
                        className="w-full px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors"
                        disabled={isUploadingIdPhoto}
                      >
                        {isUploadingIdPhoto ? "Uploading..." : "Take Photo"}
                      </button>
                      {selectedIdPhoto && !showIdPhotoPreview && (
                        <div className="mt-3 p-2 bg-gray-100 rounded">
                          <p className="text-sm text-gray-600">
                            Selected: {selectedIdPhoto.name}
                          </p>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div
      ref={messageRef}
      className={`mb-4 flex flex-col ${
        isOwnMessage ? "items-end" : "items-start"
      }`}
    >
      {/* Message Bubble */}
      <div
        className={`relative p-3 rounded-lg break-words whitespace-pre-wrap 
                inline-block max-w-xs lg:max-w-lg ${
                  isOwnMessage
                    ? "bg-navyblue text-white"
                    : "bg-gray-100 text-gray-900"
                }`}
      >
        {showSenderName && !isOwnMessage && (
          <div className="text-xs font-medium text-gray-600 mb-1">
            {message.senderName}
          </div>
        )}

        {message.text && <div className="text-sm">{message.text}</div>}

        {renderHandoverRequest()}
        {renderHandoverResponse()}
        {renderClaimRequest()}
        {renderClaimResponse()}
        {renderSystemMessage()}
      </div>

      {/* Timestamp + seen indicator + delete button outside bubble */}
      {message.timestamp && (
        <div
          className={`flex items-center mt-1 gap-2 ${
            isOwnMessage ? "justify-end" : "justify-start mt-2"
          } w-full`}
        >
          <span
            className={`text-xs ${
              isOwnMessage ? "text-navyblue" : "text-gray-600"
            }`}
          >
            {formatTime(message.timestamp)}
          </span>

          {/* Seen indicator - show on sent messages when others have read them (only on last seen message) */}
          {isOwnMessage && isLastSeenMessage && hasOtherUsersSeenMessage() && (
            <ProfilePictureSeenIndicator
              readBy={getReadersWithProfileData()}
              currentUserId={currentUserId}
              maxVisible={3}
              size="xs"
            />
          )}

          {isOwnMessage && (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="text-xs text-gray-400 hover:text-gray-600 p-1 cursor-pointer"
              title="Delete message"
            >
              <AiOutlineDelete className="size-4 text-red-500 hover:text-red-700 transition-colors duration-300" />
            </button>
          )}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[1000]">
          <div className="bg-white p-6 rounded-lg shadow-xl max-w-sm w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Delete Message</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete this message? This action cannot be undone.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteMessage}
                className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors disabled:opacity-50"
                disabled={isDeleting}
              >
                {isDeleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ID Photo Modal */}
      {renderIdPhotoModal()}
    </div>
  );
};

export default MessageBubble;
