import React, { useState, useEffect, useRef } from "react";
import type { Message } from "@/types/Post";
import ProfilePicture from "./ProfilePicture";
import { useMessage } from "../context/MessageContext";
import ImagePicker from "./ImagePicker";
import ImageModal from "./ImageModal";
import { handoverClaimService, type HandoverClaimCallbacks } from "../services/handoverClaimService";
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
  const {
    deleteMessage,
  } = useMessage();
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

    const callbacks: HandoverClaimCallbacks = {
      onHandoverResponse,
      onClaimResponse: (messageId, status) => {
        // Handle claim response after ID photo upload
        if (onClaimResponse) {
          onClaimResponse(messageId, status);
        }
        // Don't close the modal yet, wait for the success callback
      },
      onSuccess: (message: any) => {
        // Show success message
        if (message.success) {
          alert('ID photo uploaded successfully. Your claim is being processed.');
        } else {
          alert(message.message || 'ID photo uploaded successfully.');
        }
        
        // Close the modal and reset the photo
        setShowIdPhotoModal(false);
        setSelectedIdPhoto(null);
      },
      onError: (error) => {
        let errorMessage = error;
        if (error.includes("Network request failed")) {
          errorMessage = "Network error. Please check your internet connection and try again.";
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
      if (message.claimData || (userRole !== 'admin' && userRole !== 'campus_security')) {
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
      console.error('Error uploading ID photo:', error);
      alert(`Error: ${error.message || 'Failed to upload ID photo'}`);
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
      if (userRole === 'admin' || userRole === 'campus_security') {
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

    const callbacks: HandoverClaimCallbacks = {
      onClaimResponse,
      onSuccess: (message) => {
        alert(message);
        setShowIdPhotoModal(false);
        setSelectedIdPhoto(null);
      },
      onError: (error) => {
        let errorMessage = error;
        if (error.includes("Network request failed")) {
          errorMessage = "Network error. Please check your internet connection and try again.";
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
              console.log(
                "🔍 Displaying owner ID photo:",
                handoverData.ownerIdPhoto.substring(0, 50) + "..."
              );
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
        {handoverData.itemPhotos && handoverData.itemPhotos.length > 0 && !handoverData.photosDeleted && (
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
        {claimData.evidencePhotos && claimData.evidencePhotos.length > 0 && !claimData.photosDeleted && (
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
                      handleImageClick(photo.url, `Evidence Photo ${index + 1}`)
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

  // ID Photo Modal for claim confirmation
  const renderIdPhotoModal = () => {
    if (!showIdPhotoModal) return null;

    // Check if this is an admin accepting a claim
    const isAdminAcceptingClaim = message.messageType === 'claim_request' && 
      onClaimResponse && 
      message.senderId !== currentUserId &&
      (userRole === 'admin' || userRole === 'campus_security');

    // For regular users, always use handleClaimIdPhotoUpload when accepting a claim
    const isUserAcceptingClaim = message.messageType === 'claim_request' && 
      onClaimResponse && 
      message.senderId !== currentUserId;

    // Use the correct upload handler based on message type and user role
    const uploadHandler = isUserAcceptingClaim 
      ? handleClaimIdPhotoUpload 
      : handleIdPhotoUpload;

    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full mx-4">
          <h3 className="text-lg font-semibold mb-4">
            {isAdminAcceptingClaim ? 'Confirm ID Photo' : 'Upload ID Photo'}
          </h3>
          
          {isAdminAcceptingClaim ? (
            <div className="space-y-4">
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-blue-800">
                  Please verify the ID photo and click 'Confirm' to finalize the claim acceptance.
                </p>
              </div>
              
              {/* Display the existing ID photo if available */}
              {message.claimData?.idPhotoUrl && (
                <div className="mt-4">
                  <p className="text-sm text-gray-600 mb-2">ID Photo:</p>
                  <img 
                    src={message.claimData.idPhotoUrl} 
                    alt="Claimant's ID" 
                    className="max-w-full h-auto rounded border border-gray-200"
                  />
                </div>
              )}
              
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => setShowIdPhotoModal(false)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
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
                          onClearConversation
                        }
                      );
                    } catch (error) {
                      console.error('Error confirming claim:', error);
                      alert('Failed to confirm claim. Please try again.');
                    } finally {
                      setIsUploadingIdPhoto(false);
                    }
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                  disabled={isUploadingIdPhoto}
                >
                  {isUploadingIdPhoto ? 'Processing...' : 'Confirm'}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-blue-800">
                  To accept this claim, please upload a clear photo of your government-issued ID for verification.
                </p>
                <p className="text-sm text-blue-700 mt-2">
                  Your ID will only be used for verification purposes and will be handled securely.
                </p>
              </div>
              
              <ImagePicker
                onImageSelect={(file) => {
                  uploadHandler(file);
                }}
                onClose={() => {
                  if (!isUploadingIdPhoto) {
                    setShowIdPhotoModal(false);
                  } else {
                    alert('Please wait while we process your ID photo.');
                  }
                }}
                isUploading={isUploadingIdPhoto}
              />
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      {renderIdPhotoModal()}
      <div
        ref={messageRef}
        className={`flex ${isOwnMessage ? "justify-end" : "justify-start"} mb-3`}
      >
        <div
          className={`max-w-xs lg:max-w-md ${
            isOwnMessage ? "order-2" : "order-1"
          }`}
        >
          {showSenderName && !isOwnMessage && (
            <div className="flex items-center gap-2 text-xs text-gray-500 mb-1 ml-2">
              <ProfilePicture
                src={message.senderProfilePicture}
                alt="sender profile"
                size="xs"
              />
              <span>{message.senderName}</span>
            </div>
          )}

          <div
            className={`px-4 py-2 rounded-lg ${
              isOwnMessage
                ? "bg-navyblue text-white rounded-br-md"
                : "bg-gray-200 text-gray-800 rounded-bl-md"
            }`}
          >
            <p className="text-sm break-words">{message.text}</p>

            {/* Render special message types */}
            {renderHandoverRequest()}
            {renderHandoverResponse()}
            {renderClaimRequest()}
            {renderClaimResponse()}
            {renderSystemMessage()}
          </div>

        <div
          className={`text-xs text-gray-400 mt-1 ${
            isOwnMessage ? "text-right mr-2" : "ml-2"
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <span>{formatTime(message.timestamp)}</span>
              {isOwnMessage && (
                <span className="ml-1">
                  {message.readBy && message.readBy.length > 1 ? (
                    <span className="text-blue-500" title="Seen">
                      <svg
                        className="w-3 h-3"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                        <path
                          fillRule="evenodd"
                          d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </span>
                  ) : (
                    <span className="text-gray-400" title="Delivered">
                      <svg
                        className="w-3 h-3"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </span>
                  )}
                </span>
              )}
            </div>

            {/* Delete button for own messages */}
            {isOwnMessage && (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="ml-2 text-red-400 hover:text-red-600 transition-colors"
                title="Delete message"
              >
                🗑️
              </button>
            )}
          </div>
        </div>

        {/* Delete confirmation dialog */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white p-4 rounded-lg shadow-lg max-w-sm mx-4">
              <h3 className="text-lg font-semibold mb-2">Delete Message?</h3>
              <p className="text-gray-600 mb-4">
                This action cannot be undone.
              </p>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-3 py-1 text-gray-600 hover:text-gray-800 transition-colors"
                  disabled={isDeleting}
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteMessage}
                  className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 transition-colors disabled:opacity-50"
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
            onClose={() => {
              setShowImageModal(false);
              setSelectedImage(null);
            }}
          />
        )}
      </div>
    </div>
    </>
  );
};

export default MessageBubble;
