import React, { useState, useEffect, useRef } from "react";
import type { Message } from "@/types/Post";
import ProfilePicture from "./ProfilePicture";
import { useMessage } from "../context/MessageContext";
import ImageModal from "./ImageModal";
import {
  handoverClaimService,
  type HandoverClaimCallbacks,
} from "../services/handoverClaimService";
import { useAuth } from "@/context/AuthContext";

interface MessageBubbleProps {
  message: Message;
  isOwnMessage: boolean;
  showSenderName?: boolean;
  conversationId: string;
  currentUserId: string;
  postOwnerId?: string; // Add post owner ID for handover confirmation logic
  onHandoverResponse?: (
    messageId: string,
    status: "accepted" | "rejected"
  ) => void;
  onClaimResponse?: (
    messageId: string,
    status: "accepted" | "rejected"
  ) => void;
  onConfirmIdPhotoSuccess?: (_messageId: string) => void;
  onClearConversation?: () => void;
  onMessageSeen?: () => void; // Callback when message is seen
}

const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  isOwnMessage,
  showSenderName = false,
  conversationId,
  currentUserId,
  postOwnerId,
  onHandoverResponse,
  onClaimResponse,
  onClearConversation,
  onMessageSeen,
}) => {
  const { deleteMessage } = useMessage();
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showIdPhotoModal, setShowIdPhotoModal] = useState(false);
  const [selectedIdPhoto, setSelectedIdPhoto] = useState<File | null>(null);
  const [isUploadingIdPhoto, setIsUploadingIdPhoto] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [selectedImage, setSelectedImage] = useState<{
    url: string;
    altText: string;
  } | null>(null);
  const messageRef = useRef<HTMLDivElement>(null);
  const [hasBeenSeen, setHasBeenSeen] = useState(false);
  const { userData } = useAuth();
  const userRole = userData?.role;
  const formatTime = (timestamp: any) => {
    if (!timestamp) return "";

    const date = timestamp instanceof Date ? timestamp : timestamp.toDate();
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  // Intersection observer to detect when message comes into view
  useEffect(() => {
    if (!messageRef.current || !onMessageSeen || hasBeenSeen || isOwnMessage)
      return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setHasBeenSeen(true);
            onMessageSeen();
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
    if (!onHandoverResponse) return;

    // If accepting, show ID photo modal
    if (status === "accepted") {
      setShowIdPhotoModal(true);
      return;
    }

    // For rejection, use the consolidated service
    const callbacks: HandoverClaimCallbacks = {
      onHandoverResponse,
      onError: (error) => alert(error),
    };

    await handoverClaimService.handleHandoverResponse(
      conversationId,
      message.id,
      status,
      currentUserId,
      callbacks
    );
  };

  const handleIdPhotoUpload = async (photoFile: File) => {
    setIsUploadingIdPhoto(true);

    // Capture message ID for the callback
    const msgId = message.id;

    const callbacks: HandoverClaimCallbacks = {
      onHandoverResponse,
      onClaimResponse: (messageId, status) => {
        // Handle claim response after ID photo upload
        if (onClaimResponse) {
          onClaimResponse(messageId, status);
        }
        // Don't close the modal yet, wait for the success callback
      },
      onSuccess: (_message: any) => {
        console.log('✅ MessageBubble: Upload successful, calling parent callback');

        // Close the modal and reset the photo
        setShowIdPhotoModal(false);
        setSelectedIdPhoto(null);
        // Small delay to ensure modal closes before parent callback
        setTimeout(() => {
          console.log('🔄 MessageBubble: Calling parent callback after modal close');
          onHandoverResponse?.(msgId, 'accepted');

          // Force refresh of message data from Firebase to get complete updated data
          setTimeout(() => {
            console.log('🔄 MessageBubble: Forcing Firebase refresh for complete data');
            // The parent component will refresh the message data from Firebase
            // This ensures we get the complete updated message with ownerIdPhoto
          }, 200);
        }, 100);
      },
      onError: (error) => {
        console.error('❌ MessageBubble: Upload failed:', error);
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
      },
    };

    try {
      // For claim responses, always use handleClaimIdPhotoUpload for regular users
      if (
        message.claimData ||
        (userRole !== "admin" && userRole !== "campus_security")
      ) {
        await handoverClaimService.handleClaimIdPhotoUpload(
          photoFile,
          conversationId,
          message.id,
          currentUserId,
          callbacks
        );
      } else {
        // For handover responses
        await handoverClaimService.handleIdPhotoUpload(
          photoFile,
          conversationId,
          message.id,
          currentUserId,
          callbacks
        );
      }
    } catch (error: any) {
      console.error("Error uploading ID photo:", error);
      alert(`Error: ${error.message || "Failed to upload ID photo"}`);
    }

    setIsUploadingIdPhoto(false);
  };

  const handleConfirmIdPhoto = async () => {
    const callbacks: HandoverClaimCallbacks = {
      onSuccess: (message) => alert(message),
      onError: (error) => alert(error),
      onClearConversation,
    };

    await handoverClaimService.handleConfirmIdPhoto(
      conversationId,
      message.id,
      currentUserId,
      callbacks
    );
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

    // For rejection, use the consolidated service
    const callbacks: HandoverClaimCallbacks = {
      onClaimResponse,
      onError: (error) => alert(error),
    };

    await handoverClaimService.handleClaimResponse(
      conversationId,
      message.id,
      status,
      currentUserId,
      callbacks
    );
  };

  const handleClaimIdPhotoUpload = async (photoFile: File) => {
    setIsUploadingIdPhoto(true);

    // Capture message ID for the callback
    const msgId = message.id;

    const callbacks: HandoverClaimCallbacks = {
      onClaimResponse,
      onSuccess: (_message) => {
        setShowIdPhotoModal(false);
        setSelectedIdPhoto(null);

        // For handover requests, call onHandoverResponse; for claim requests, call onClaimResponse
        if (message.messageType === "handover_request") {
          onHandoverResponse?.(msgId, 'accepted');
        } else {
          onClaimResponse?.(msgId, 'accepted');
        }

        // Small delay to ensure modal closes before parent callback
        setTimeout(() => {
          // Force refresh hint for parent component
        }, 200);
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
        }
        alert("Upload Error: " + errorMessage);
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
    const callbacks: HandoverClaimCallbacks = {
      onClaimResponse,
      onSuccess: (message) => alert(message),
      onError: (error) => alert(error),
      onClearConversation,
    };

    await handoverClaimService.handleConfirmClaimIdPhoto(
      conversationId,
      message.id,
      currentUserId,
      callbacks
    );
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

  // Handle image click to open in modal
  const handleImageClick = (imageUrl: string, altText: string) => {
    setSelectedImage({ url: imageUrl, altText });
    setShowImageModal(true);
  };

  const renderHandoverRequest = () => {
    if (message.messageType !== "handover_request") return null;

    const handoverData = message.handoverData;
    if (!handoverData) return null;

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
                  handleImageClick(handoverData.idPhotoUrl!, "Finder ID Photo")
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
                            handoverData.ownerIdPhoto!,
                            "Owner ID Photo"
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
                        handleImageClick(photo.url, `Item Photo ${index + 1}`)
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
                  handleImageClick(claimData.idPhotoUrl!, "Claimer ID Photo")
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
                  handleImageClick(claimData.ownerIdPhoto!, "Owner ID Photo")
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
                          photo.url,
                          `Evidence Photo ${index + 1}`
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
                          photo.url,
                          `Verification Photo ${index + 1}`
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
      // Auto-upload the selected file using the appropriate handler
      if (onClaimResponse && message.senderId !== currentUserId) {
        handleClaimIdPhotoUpload(file);
      } else {
        handleIdPhotoUpload(file);
      }
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
      // Auto-upload the captured photo using the appropriate handler
      if (onClaimResponse && message.senderId !== currentUserId) {
        handleClaimIdPhotoUpload(file);
      } else {
        handleIdPhotoUpload(file);
      }
    } else {
      alert("Please capture a valid image");
    }
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

    // For regular users, always use handleClaimIdPhotoUpload when accepting a claim
    const isUserAcceptingClaim =
      message.messageType === "claim_request" &&
      onClaimResponse &&
      message.senderId !== currentUserId;
    return (
      <div className="fixed inset-0 bg-black/50 flex h-screen items-center justify-center z-[1000]">
        <div className="bg-white p-6 rounded-lg shadow-xl max-w-2xl w-full mx-4 relative z-[1000]">
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
                        currentUserId,
                        {
                          onSuccess: (message) => {
                            alert(message);
                            setShowIdPhotoModal(false);
                            if (onClearConversation) onClearConversation();
                          },
                          onError: (error) => {
                            alert(error);
                            setShowIdPhotoModal(false);
                          },
                          onClearConversation,
                        }
                      );
                    } catch (error) {
                      console.error("Error confirming claim:", error);
                      alert("Failed to confirm claim. Please try again.");
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
                    {isUploadingIdPhoto ? "Uploading..." : "Choose from Gallery"}
                  </button>
                  <button
                    onClick={openCamera}
                    className="w-full px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors"
                    disabled={isUploadingIdPhoto}
                  >
                    {isUploadingIdPhoto ? "Uploading..." : "Take Photo"}
                  </button>
                  {selectedIdPhoto && (
                    <div className="mt-3 p-2 bg-gray-100 rounded">
                      <p className="text-sm text-gray-600">
                        Selected: {selectedIdPhoto.name}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div ref={messageRef} className={`mb-4 ${isOwnMessage ? 'ml-auto' : 'mr-auto'} max-w-xs lg:max-w-md`}>
      {/* Message Bubble Content */}
      <div
        className={`relative p-3 rounded-lg ${
          isOwnMessage
            ? 'bg-navyblue text-white ml-auto'
            : 'bg-gray-100 text-gray-900'
        }`}
      >
        {/* Sender name for group conversations */}
        {showSenderName && !isOwnMessage && (
          <div className="text-xs font-medium text-gray-600 mb-1">
            {message.senderName}
          </div>
        )}

        {/* Message text */}
        {message.text && (
          <div className="text-sm whitespace-pre-wrap break-words">
            {message.text}
          </div>
        )}

        {/* Message timestamp */}
        {message.timestamp && (
          <div
            className={`text-xs mt-1 ${
              isOwnMessage ? 'text-blue-200' : 'text-gray-500'
            }`}
          >
            {formatTime(message.timestamp)}
          </div>
        )}

        {/* Render special message types */}
        {renderHandoverRequest()}
        {renderHandoverResponse()}
        {renderClaimRequest()}
        {renderClaimResponse()}
        {renderSystemMessage()}
      </div>

      {/* Delete button for own messages */}
      {isOwnMessage && (
        <div className="flex justify-end mt-1">
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="text-xs text-gray-400 hover:text-gray-600 p-1"
            title="Delete message"
          >
            🗑️
          </button>
        </div>
      )}

      {/* Delete confirmation modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-4 rounded-lg shadow-lg max-w-sm mx-4">
            <h3 className="text-lg font-semibold mb-3">Delete Message?</h3>
            <p className="text-sm text-gray-600 mb-4">
              This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-3 py-2 text-gray-600 bg-gray-100 rounded hover:bg-gray-200"
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteMessage}
                className="px-3 py-2 bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50"
                disabled={isDeleting}
              >
                {isDeleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image Modal */}
      {showImageModal && selectedImage && (
        <ImageModal
          imageUrl={selectedImage.url}
          altText={selectedImage.altText}
          onClose={() => setShowImageModal(false)}
        />
      )}

      {/* ID Photo Modal */}
      {renderIdPhotoModal()}
    </div>
  );
};

export default MessageBubble;
