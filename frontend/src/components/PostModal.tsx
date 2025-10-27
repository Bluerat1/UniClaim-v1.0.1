import { useEffect, useState } from "react";
import { FiX } from "react-icons/fi";
import LocationMap from "./LocationMap";
import type { Post } from "@/types/Post";
import { useAuth } from "@/context/AuthContext";
import { useNavigate } from "react-router-dom";
import { useMessage } from "@/context/MessageContext";
import ProfilePicture from "./ProfilePicture";
import ClaimDetailsDisplay from "./ClaimDetailsDisplay";
import FlagButton from "./FlagButton";
import TurnoverConfirmationModal from "./TurnoverConfirmationModal";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { usePostCreatorData } from "@/hooks/usePostCreatorData";

interface PostModalProps {
  post: Post;
  onClose: () => void;
  hideSendMessage?: boolean; // Add optional prop to hide send message button
  onConfirmTurnover?: (
    post: Post,
    status: "confirmed" | "not_received",
    notes?: string
  ) => void;
}

function formatDateTime(
  datetime: string | Date | { seconds: number; nanoseconds: number }
) {
  let date: Date;

  if (datetime && typeof datetime === "object" && "seconds" in datetime) {
    // Handle Firestore Timestamp objects
    date = new Date(datetime.seconds * 1000 + datetime.nanoseconds / 1000000);
  } else if (typeof datetime === "string") {
    date = new Date(datetime);
  } else {
    date = datetime as Date;
  }

  // Check if date is valid
  if (isNaN(date.getTime())) {
    return "Invalid Date";
  }

  return date.toLocaleString("en-PH", {
    dateStyle: "long",
    timeStyle: "short",
  });
}

export default function PostModal({
  post,
  onClose,
  hideSendMessage,
  onConfirmTurnover,
}: PostModalProps) {
  const { userData } = useAuth(); // Get current user data
  const navigate = useNavigate(); // Add navigation hook
  const { createConversation } = useMessage(); // Add message context
  const { isAdmin } = useIsAdmin(userData?.uid);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [isCreatingConversation, setIsCreatingConversation] = useState(false);
  const [imageLoadingError, setImageLoadingError] = useState<string | null>(
    null
  );

  // State for turnover confirmation modal
  const [showTurnoverModal, setShowTurnoverModal] = useState(false);
  const [confirmationType, setConfirmationType] = useState<
    "confirmed" | "not_received" | null
  >(null);

  // Check if current user is the creator of the post
  const isCurrentUserCreator = userData?.uid === post.creatorId;

  // Get real-time creator data for the current user's posts
  const creatorData = usePostCreatorData(post);

  const categoryStyles: Record<string, string> = {
    "Student Essentials": "bg-yellow-300 text-black",
    Gadgets: "bg-blue-400 text-black",
    "Personal Belongings": "bg-purple-300 text-black",
  };

  const typeStyles: Record<string, string> = {
    lost: "bg-red-100 text-red-700",
    found: "bg-green-100 text-green-700",
  };

  useEffect(() => {
    // Lock scroll when modal opens
    document.body.style.overflow = "hidden";

    // Clean up: Restore scroll when modal closes
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  useEffect(() => {
    setImageLoadingError(null);

    try {
      const urls = post.images.map((img) =>
        typeof img === "string" ? img : URL.createObjectURL(img)
      );

      setImageUrls(urls);

      // Remove the problematic timeout that was causing false warnings
      // Images are processed immediately, so no need for a loading timeout

      return () => {
        urls.forEach((url) => {
          if (url.startsWith("blob:")) URL.revokeObjectURL(url);
        });
      };
    } catch (error) {
      console.error("Error processing images:", error);
      setImageLoadingError("Failed to load images");
    }
  }, [post.images]);

  // Handle send message button click
  const handleSendMessage = async () => {
    if (!userData) {
      // If user is not logged in, redirect to login
      navigate("/login");
      return;
    }

    if (isCurrentUserCreator) {
      // If user is the creator, show message or redirect to their own posts
      alert("You cannot send a message to yourself. This is your own post.");
      return;
    }

    try {
      setIsCreatingConversation(true);

      // Get the post owner ID - try multiple sources for compatibility
      const postOwnerId = post.creatorId || post.postedById;

      if (!postOwnerId) {
        throw new Error("Cannot identify post owner");
      }

      // Create conversation and get the conversation ID
      const conversationId = await createConversation(
        post.id,
        post.title,
        postOwnerId,
        userData.uid,
        userData,
        post.user // Pass the post owner's user data
      );

      // Close modal and navigate to messages page with the specific conversation
      onClose();
      navigate(`/messages?conversation=${conversationId}`);
    } catch (error: any) {
      console.error("Error creating conversation:", error);
      alert(`Failed to start conversation: ${error.message}`);
    } finally {
      setIsCreatingConversation(false);
    }
  };

  // Handle send message to original finder button click
  const handleSendMessageToOriginalFinder = async () => {
    if (!userData) {
      // If user is not logged in, redirect to login
      navigate("/login");
      return;
    }

    if (!post.turnoverDetails?.originalFinder) {
      alert("Turnover information is not available.");
      return;
    }

    if (userData.uid === post.turnoverDetails.originalFinder.uid) {
      // If user is the original finder, show message or redirect to their own posts
      alert("You cannot send a message to yourself. This is your own post.");
      return;
    }

    try {
      setIsCreatingConversation(true);

      const originalFinder = post.turnoverDetails.originalFinder;
      const originalFinderId = originalFinder.uid;

      if (!originalFinderId) {
        throw new Error("Cannot identify original finder");
      }

      // Create conversation and get the conversation ID
      const conversationId = await createConversation(
        post.id,
        post.title,
        post.creatorId,    // Post creator's ID (not original finder's ID)
        userData.uid,      // Current user's UID
        userData,          // Current user's data
        originalFinder     // Original finder's data as postOwnerUserData
      );

      // Close modal and navigate to messages page with the specific conversation
      onClose();
      navigate(`/messages?conversation=${conversationId}`);
    } catch (error: any) {
      console.error("Error creating conversation with original finder:", error);
      alert(`Failed to start conversation: ${error.message}`);
    } finally {
      setIsCreatingConversation(false);
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        onClick={(e) => {
          // Close modal when clicking on the backdrop (outside the modal content)
          if (e.target === e.currentTarget) {
            onClose();
          }
        }}
      >
        <div className="bg-white rounded p-4 shadow w-[30rem] sm:w-[35rem] md:w-[40rem] lg:w-[42rem] xl:w-[60rem] max-w-full max-h-[90vh] overflow-y-auto modal-scrollbar">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ProfilePicture
                src={creatorData?.profilePicture}
                alt="user profile"
                className="size-10"
              />
              <div className="flex flex-col">
                <p className="text-xs text-gray-500">Posted by:</p>
                <p className="text-sm">
                  {creatorData?.firstName && creatorData?.lastName
                    ? `${creatorData.firstName} ${creatorData.lastName}`
                    : "Anonymous"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {!isCurrentUserCreator && !hideSendMessage && (
                <button
                  onClick={handleSendMessage}
                  disabled={isCreatingConversation || post.status === "resolved"}
                  className="text-[12px] bg-brand py-2 px-3 rounded cursor-pointer hover:bg-yellow-600 text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors duration-300"
                >
                  {isCreatingConversation ? (
                    <>
                      <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Starting...
                    </>
                  ) : (
                    "Send Message"
                  )}
                </button>
              )}
              {!isCurrentUserCreator && (
                <FlagButton
                  postId={post.id}
                  isFlagged={post.isFlagged}
                  flaggedBy={post.flaggedBy}
                  postStatus={post.status}
                />
              )}
              <button className="" onClick={onClose}>
                <FiX className="size-5 stroke-[1.5px]" />
              </button>
            </div>
          </div>

          {imageUrls.length > 0 && (
            <div className="mt-4 flex items-center justify-center">
              <div className="relative group w-full max-w-md">
                <img
                  src={imageUrls[0]}
                  alt="Uploaded image"
                  className="w-full h-auto object-cover rounded"
                />

                <div
                  className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded-full
            block md:hidden
            md:group-hover:block md:pointer-events-none md:select-none"
                >
                  {imageUrls.length}
                </div>
              </div>
            </div>
          )}

          {/* Image loading error display - only show for actual errors */}
          {imageLoadingError && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-md">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="text-red-600 text-sm">
                    ⚠️ {imageLoadingError}
                  </span>
                </div>
                <button
                  onClick={() => {
                    setImageLoadingError(null);
                    // Force re-processing of images
                    const urls = post.images.map((img) =>
                      typeof img === "string" ? img : URL.createObjectURL(img)
                    );
                    setImageUrls(urls);
                  }}
                  className="px-3 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600 transition-colors"
                >
                  Retry
                </button>
              </div>
            </div>
          )}

          <div className="my-3 lg:flex lg:items-center lg:justify-between">
            <h2 className="text-xl font-semibold my-3">{post.title}</h2>

            <div className="flex items-center gap-2 text-[12px]">
              <span
                className={`capitalize px-2 py-1 rounded-[3px] font-medium ${
                  categoryStyles[post.category] || "bg-gray-100 text-gray-700"
                }`}
              >
                {post.category}
              </span>
              <span
                className={`capitalize px-2 py-1 rounded-[3px] font-medium ${
                  typeStyles[post.type] || "bg-gray-100 text-gray-700"
                }`}
              >
                {post.type}
              </span>

              {/* Found Action Badge - only show for found items with action */}
              {post.type === "found" && post.foundAction && (
                <span className="px-2 py-1 rounded-[3px] font-medium bg-blue-100 text-blue-700">
                  {post.foundAction === "keep"
                    ? "Keep"
                    : post.foundAction === "turnover to OSA"
                    ? "OSA"
                    : "Campus Security"}
                </span>
              )}

              {/* Status Badge - show when post is resolved or unclaimed */}
              {post.status === "resolved" && (
                <span className="px-2 py-1 rounded-[3px] font-medium bg-green-100 text-green-700">
                  ✅ RESOLVED
                </span>
              )}
              {post.status === "unclaimed" && (
                <span className="px-2 py-1 rounded-[3px] font-medium bg-orange-100 text-orange-700">
                  ⏰ UNCLAIMED
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 lg:gap-5 lg:grid-cols-2">
            {/* item info */}
            <div className="">
              <p className="text-[13px] mb-2">Date and Time</p>
              <div className="bg-gray-50 border border-gray-400 rounded py-2 px-2">
                {post.createdAt && (
                  <p className="text-[13px] text-black">
                    {formatDateTime(post.createdAt)}
                  </p>
                )}
              </div>
              <p className="text-[13px] mt-3 mb-2">Item Description</p>
              <div className="bg-gray-50 border border-gray-400 rounded py-2 px-2 h-52 overflow-y-auto modal-scrollbar">
                <p className="text-[13px] text-gray-600">{post.description}</p>
              </div>

              {/* Revert Reason - show for all users when post has been reverted */}
              {post.revertReason && (
                <div className="mt-3 p-3 bg-orange-50 border-l-4 border-orange-400 rounded-r-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-orange-600 text-sm">🔄</span>
                    <span className="text-sm font-medium text-orange-800">
                      Reverted by Admin
                    </span>
                  </div>
                  <div className="text-orange-700 text-sm">
                    {post.revertReason}
                  </div>
                </div>
              )}

              {/* Found Action Information - only show for found items */}
              {post.type === "found" && post.foundAction && (
                <>
                  <p className="text-[13px] mt-3 mb-2">Found Item Action</p>
                  <div className="bg-blue-50 border border-blue-200 rounded py-2 px-2">
                    <p className="text-[13px] text-blue-700 font-medium">
                      {post.foundAction === "keep"
                        ? "The finder will keep this item and return it themselves"
                        : post.turnoverDetails &&
                          post.turnoverDetails.originalTurnoverAction === "turnover to Campus Security" &&
                          post.turnoverDetails.turnoverAction === "turnover to OSA"
                        ? "This item was transferred to OSA"
                        : post.foundAction === "turnover to OSA"
                        ? "This item was turned over to OSA office"
                        : "This item was turned over to Campus Security"}
                    </p>
                  </div>
                </>
              )}

              <div className="">
                {post.coordinates && (
                  <>
                    <p className="text-[13px] mt-3 mb-2">Pinned Coordinates</p>
                    <div className="bg-gray-50 border border-gray-400 rounded py-2 px-2 mb-3">
                      <p className="text-[13px] text-gray-600">
                        {post.coordinates.lat.toFixed(5)}{" "}
                        {post.coordinates.lng.toFixed(5)}
                      </p>
                    </div>

                    {/* Item Holder Transfer - show under coordinates in left column */}
                    {post.turnoverDetails &&
                      post.turnoverDetails.turnoverAction === "turnover to OSA" &&
                      post.turnoverDetails.turnoverStatus === "transferred" &&
                      post.turnoverDetails.originalTurnoverAction &&
                      post.turnoverDetails.originalTurnoverAction === "turnover to Campus Security" && (
                        <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                            <h3 className="font-semibold text-blue-800 text-sm">
                              🔄 Item Holder Transfer
                            </h3>
                          </div>
                          <div className="text-sm text-blue-700 space-y-1 text-xs">
                            <p>
                              <strong>Status:</strong> Item has been transferred from Campus Security to OSA (Admin)
                            </p>
                            <p>
                              <strong>Transfer Date:</strong>{" "}
                              {post.turnoverDetails.turnoverDecisionAt
                                ? formatDateTime(post.turnoverDetails.turnoverDecisionAt)
                                : "N/A"}
                            </p>
                            {post.turnoverDetails.turnoverReason && (
                              <p>
                                <strong>Reason:</strong> {post.turnoverDetails.turnoverReason}
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                  </>
                )}
              </div>
            </div>
            {/* location info */}
            <div className="">
              <p className="text-[13px] mt-2">Last seen location</p>
              <div className="bg-gray-50 border border-gray-400 rounded py-2 px-2">
                <p className="text-sm text-gray-700">{post.location}</p>
              </div>
              <p className="text-[13px] mt-3 mb-2">Location</p>
              {post.coordinates && (
                <div className="relative rounded-md overflow-hidden border border-gray-300 mb-3">
                  <LocationMap
                    coordinates={post.coordinates}
                    location={post.location}
                    className="h-[300px]"
                  />
                  {/* Coordinates overlay */}
                  <div className="absolute bottom-2 left-2 right-2 z-10 bg-white/90 backdrop-blur-sm rounded-md px-2 py-1 shadow-sm border border-gray-200 flex justify-center">
                    <span className="text-xs text-gray-600 font-mono">
                      {post.coordinates.lat.toFixed(6)},{" "}
                      {post.coordinates.lng.toFixed(6)}
                    </span>
                  </div>
                </div>
              )}

              {/* Turnover Details - show under map in right column */}
              {post.turnoverDetails && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-blue-600 text-lg">🔄</span>
                    <h4 className="text-sm font-semibold text-blue-800">
                      Turnover Information
                    </h4>
                  </div>
                  <div className="text-sm text-blue-700 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">Originally found by:</span>
                      <ProfilePicture
                        src={post.turnoverDetails.originalFinder.profilePicture}
                        alt={`${post.turnoverDetails.originalFinder.firstName} ${post.turnoverDetails.originalFinder.lastName}`}
                        className="border-blue-300 size-5"
                      />
                      <span>
                        {post.turnoverDetails.originalFinder.firstName}{" "}
                        {post.turnoverDetails.originalFinder.lastName}
                      </span>
                      {!isCurrentUserCreator && userData?.uid !== post.turnoverDetails.originalFinder.uid && (
                        <button
                          onClick={() => handleSendMessageToOriginalFinder()}
                          disabled={isCreatingConversation || post.status === "resolved"}
                          className="text-[10px] bg-brand py-1 px-2 rounded cursor-pointer hover:bg-yellow-600 text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 transition-colors duration-300 ml-2"
                          title="Send message to original finder"
                        >
                          {isCreatingConversation ? (
                            <>
                              <div className="w-2 h-2 border border-white border-t-transparent rounded-full animate-spin"></div>
                              ...
                            </>
                          ) : (
                            "Message"
                          )}
                        </button>
                      )}
                    </div>
                    {isAdmin && (
                      <div>
                        <span className="font-medium">Student ID:</span>{" "}
                        {post.turnoverDetails.originalFinder.studentId || "N/A"}
                      </div>
                    )}
                    {isAdmin && (
                      <div>
                        <span className="font-medium">Email:</span>{" "}
                        {post.turnoverDetails.originalFinder.email}
                      </div>
                    )}
                    {isAdmin && post.turnoverDetails.originalFinder.contactNum && (
                      <div>
                        <span className="font-medium">Contact:</span>{" "}
                        {post.turnoverDetails.originalFinder.contactNum}
                      </div>
                    )}
                    <div>
                      <span className="font-medium">Status:</span>{" "}
                      {post.turnoverDetails.turnoverStatus === "declared"
                        ? "Declared - Awaiting Confirmation"
                        : post.turnoverDetails.turnoverStatus === "confirmed"
                        ? "Confirmed - Item Received"
                        : post.turnoverDetails.turnoverStatus === "not_received"
                        ? "Not Received - Item Deleted"
                        : post.turnoverDetails.turnoverAction === "turnover to Campus Security"
                        ? "Turned over to Campus Security"
                        : post.turnoverDetails.turnoverAction === "turnover to OSA"
                        ? "Turned over to OSA"
                        : post.turnoverDetails.turnoverStatus}
                    </div>
                    <div>
                      <span className="font-medium">Turned over to:</span>{" "}
                      {post.turnoverDetails.turnoverAction === "turnover to OSA"
                        ? "OSA"
                        : post.turnoverDetails.originalTurnoverAction === "turnover to Campus Security"
                        ? "Campus Security"
                        : "Campus Security"}
                    </div>
                    <div>
                      <span className="font-medium">Turned over Date:</span>{" "}
                      {post.turnoverDetails.turnoverDecisionAt
                        ? formatDateTime(post.turnoverDetails.turnoverDecisionAt)
                        : "N/A"}
                    </div>
                    {post.turnoverDetails.turnoverReason && (
                      <div>
                        <span className="font-medium">Reason:</span>{" "}
                        {post.turnoverDetails.turnoverReason}
                      </div>
                    )}
                    {post.turnoverDetails.confirmationNotes && (
                      <div>
                        <span className="font-medium">Item Condition Notes:</span>{" "}
                        {post.turnoverDetails.confirmationNotes}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Show claim details if post is resolved or completed, has claim details, and user is admin */}
          {(post.status === "resolved" || post.status === "completed") &&
            post.claimDetails &&
            isAdmin && (
              <ClaimDetailsDisplay
                claimDetails={post.claimDetails}
                conversationData={post.conversationData}
              />
            )}

          {/* Turnover Confirmation Buttons - Show only for posts awaiting OSA confirmation */}
          {post.turnoverDetails &&
            post.turnoverDetails.turnoverStatus === "declared" &&
            post.turnoverDetails.turnoverAction === "turnover to OSA" &&
            isAdmin && (
              <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-blue-600 text-xl">🔄</span>
                  <h4 className="text-lg font-semibold text-blue-800">
                    Confirm Item Receipt
                  </h4>
                </div>
                <p className="text-sm text-blue-700 mb-4">
                  This item has been turned over to OSA. Please confirm if you have received it.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setConfirmationType("confirmed");
                      setShowTurnoverModal(true);
                    }}
                    className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                  >
                    ✓ Confirm Received
                  </button>
                  <button
                    onClick={() => {
                      setConfirmationType("not_received");
                      setShowTurnoverModal(true);
                    }}
                    className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                  >
                    ✗ Not Received
                  </button>
                </div>
              </div>
            )}
        </div>
      </div>

      {/* Turnover Confirmation Modal */}
      <TurnoverConfirmationModal
        isOpen={showTurnoverModal}
        onClose={() => {
          setShowTurnoverModal(false);
          setConfirmationType(null);
        }}
        onConfirm={(status, notes) => {
          onConfirmTurnover?.(post, status, notes);
        }}
        post={post}
        confirmationType={confirmationType}
      />
    </>
  );
}
