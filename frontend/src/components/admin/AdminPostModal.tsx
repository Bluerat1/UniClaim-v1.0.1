import { useEffect, useState } from "react";
import { FiX } from "react-icons/fi";
import type { Post } from "@/types/Post";
import { useNavigate } from "react-router-dom";
import ProfilePicture from "@/components/user/ProfilePicture";
import HandoverDetailsDisplay from "@/components/common/HandoverDetailsDisplay";
import { postService } from "@/services/firebase/posts";
import { useToast } from "@/context/ToastContext";
import ActivationModal from "@/components/modals/Activation";

interface AdminPostModalProps {
  post: Post;
  onClose: () => void;
  onPostUpdate?: (updatedPost: Post) => void;
  onConfirmTurnover?: (
    post: Post,
    status: "confirmed" | "not_received"
  ) => void;
  onConfirmCampusSecurityCollection?: (
    post: Post,
    status: "collected" | "not_available"
  ) => void;
  onApprove?: (post: Post) => void;
  onHide?: (post: Post) => void;
  onUnhide?: (post: Post) => void;
  onDelete?: (post: Post) => void; // Uses confirmation modal system
  showDeleteButton?: boolean; // Controls whether delete button is visible
  showCampusSecurityButtons?: boolean; // Controls whether Campus Security buttons are visible
  // Unclaimed post specific props
  showUnclaimedFeatures?: boolean; // Controls whether unclaimed-specific features are shown
  isActivating?: boolean; // Loading state for activation
  showFlaggedPostActions?: boolean; // Controls whether flagged post management buttons are shown
  showCampusSecurityActions?: boolean; // Controls whether campus security management buttons are shown
  onActivatePost?: (postId: string) => void; // Callback for when post is activated
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

export default function AdminPostModal({
  post,
  onClose,
  onPostUpdate,
  onConfirmTurnover,
  onConfirmCampusSecurityCollection,
  onApprove,
  onHide,
  onUnhide,
  onDelete,
  showDeleteButton = false,
  showCampusSecurityButtons = true,
  showUnclaimedFeatures = false,
  isActivating = false,
  showFlaggedPostActions = false,
  showCampusSecurityActions = false,
  onActivatePost,
}: AdminPostModalProps) {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [imageLoadingError, setImageLoadingError] = useState<string | null>(
    null
  );
  const [isActivationModalOpen, setIsActivationModalOpen] = useState(false);

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
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  useEffect(() => {
    setImageLoadingError(null);
    setCurrentImageIndex(0); // Reset to first image when new images are loaded

    try {
      const urls = post.images.map((img) =>
        typeof img === "string" ? img : URL.createObjectURL(img)
      );
      setImageUrls(urls);
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

  const handleToggleStatus = async () => {
    try {
      setIsUpdatingStatus(true);
      const newStatus = post.status === "resolved" ? "pending" : "resolved";
      await postService.updatePostStatus(post.id, newStatus);
      showToast(
        "success",
        "Status Updated",
        `Post has been marked as ${newStatus}.`
      );
      onPostUpdate?.({ ...post, status: newStatus });
    } catch (error) {
      console.error("Error updating post status:", error);
      showToast(
        "error",
        "Error",
        "Failed to update post status. Please try again."
      );
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleActivationConfirm = async (adminNotes?: string) => {
    try {
      // Use updatePostStatus instead of activateTicket to support admin notes
      const originalStatus = post.originalStatus || "pending";
      await postService.updatePostStatus(post.id, originalStatus, adminNotes);

      showToast(
        "success",
        "Post Activated",
        "Post has been activated and moved back to active status."
      );

      // Close modal and refresh the post data
      setIsActivationModalOpen(false);

      // Call onPostUpdate if provided to refresh the parent component
      if (onPostUpdate) {
        const updatedPost = { ...post, status: originalStatus, adminNotes };
        onPostUpdate(updatedPost);
      }

      // Notify parent component about activation
      onActivatePost?.(post.id);

      onClose(); // Close the main modal after successful activation
    } catch (error: any) {
      console.error("Failed to activate post:", error);
      showToast(
        "error",
        "Activation Failed",
        error.message || "Failed to activate post"
      );
    }
  };

  const handleViewUser = () => {
    if (post.creatorId) {
      navigate(`/admin/users/${post.creatorId}`);
      onClose();
    }
  };

  // Image navigation functions
  const goToPreviousImage = () => {
    if (imageUrls.length > 1) {
      setCurrentImageIndex((prev) =>
        prev === 0 ? imageUrls.length - 1 : prev - 1
      );
    }
  };

  const goToNextImage = () => {
    if (imageUrls.length > 1) {
      setCurrentImageIndex((prev) =>
        prev === imageUrls.length - 1 ? 0 : prev + 1
      );
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (imageUrls.length <= 1) return;

      if (e.key === 'ArrowLeft') {
        goToPreviousImage();
      } else if (e.key === 'ArrowRight') {
        goToNextImage();
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [imageUrls.length]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded p-4 shadow w-[40rem] sm:w-[43rem] md:w-[45rem] lg:w-[50rem] xl:w-[55rem] max-w-full h-auto max-h-[95vh] overflow-y-auto modal-scrollbar"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ProfilePicture
              src={post.user?.profilePicture}
              alt="user profile"
              className="size-8"
            />
            <div className="flex flex-col">
              <p className="text-xs text-gray-500">Posted by:</p>
              <button
                onClick={handleViewUser}
                className="text-sm text-left hover:underline hover:text-blue-600 transition-colors"
                title="View user details"
              >
                {post.user?.firstName && post.user?.lastName
                  ? `${post.user.firstName} ${post.user.lastName}`
                  : "Anonymous"}
              </button>
              {/* <p className="text-xs text-gray-500">
                {post.creatorId || "Unknown User ID"}
              </p> */}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {post.turnoverDetails &&
              post.turnoverDetails.turnoverStatus === "declared" &&
              post.turnoverDetails.turnoverAction === "turnover to OSA" && (
                <>
                  <button
                    onClick={() => {
                      onConfirmTurnover?.(post, "confirmed");
                    }}
                    className="px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 transition-colors flex items-center gap-1"
                  >
                    ✓ Confirm Received
                  </button>
                  <button
                    onClick={() => {
                      onConfirmTurnover?.(post, "not_received");
                    }}
                    className="px-3 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 transition-colors flex items-center gap-1"
                  >
                    ✗ Not Received
                  </button>
                </>
              )}

            {post.turnoverDetails &&
              post.turnoverDetails.turnoverAction ===
                "turnover to Campus Security" &&
              showCampusSecurityButtons &&
              showCampusSecurityActions && (
                <>
                  <button
                    onClick={() => {
                      onConfirmCampusSecurityCollection?.(post, "collected");
                    }}
                    className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition-colors flex items-center gap-1"
                  >
                    ✓ Item Collected
                  </button>
                  <button
                    onClick={() => {
                      onConfirmCampusSecurityCollection?.(
                        post,
                        "not_available"
                      );
                    }}
                    className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition-colors flex items-center gap-1"
                  >
                    ✗ Not Available
                  </button>
                </>
              )}

            {/* Admin Action Buttons - Top Right */}
            <div className="flex items-center gap-2">
              {/* Unclaimed Post Actions */}
              {showUnclaimedFeatures &&
                (post.status === "unclaimed" || post.movedToUnclaimed) && (
                  <>
                    <button
                      onClick={() => setIsActivationModalOpen(true)}
                      disabled={isActivating}
                      className="px-2 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600 transition"
                      title="Activate - Move back to active status"
                    >
                      {isActivating ? (
                        <span className="flex items-center gap-1">
                          <svg
                            className="animate-spin h-3 w-3"
                            viewBox="0 0 24 24"
                          >
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                              fill="none"
                            />
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            />
                          </svg>
                          Activating...
                        </span>
                      ) : (
                        "Activate"
                      )}
                    </button>

                    <button
                      onClick={() => onDelete?.(post)}
                      className="px-2 py-1 text-xs bg-red-500 hover:bg-red-600 text-white rounded transition"
                      title="Delete Post"
                    >
                      Delete
                    </button>
                  </>
                )}

              {post.isFlagged && onApprove && showFlaggedPostActions && (
                <button
                  onClick={() => onApprove(post)}
                  className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 flex items-center gap-1"
                  title="Approve Post"
                >
                  Approve
                </button>
              )}

              {post.isFlagged &&
                !post.isHidden &&
                onHide &&
                showFlaggedPostActions && (
                  <button
                    onClick={() => onHide(post)}
                    className="px-2 py-1 text-xs bg-orange-600 text-white rounded hover:bg-orange-700 flex items-center gap-1"
                    title="Hide Post"
                  >
                    Hide
                  </button>
                )}

              {post.isFlagged &&
                post.isHidden &&
                onUnhide &&
                showFlaggedPostActions && (
                  <button
                    onClick={() => onUnhide(post)}
                    className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 flex items-center gap-1"
                    title="Unhide Post"
                  >
                    Unhide
                  </button>
                )}

              {showDeleteButton && onDelete && !showUnclaimedFeatures && (
                <button
                  onClick={() => onDelete?.(post)}
                  className="px-2 py-1 text-xs bg-red-500 hover:bg-red-600 text-white rounded transition"
                  title="Delete Post"
                >
                  Delete
                </button>
              )}
            </div>

            <button
              onClick={onClose}
              className="p-1 hover:bg-gray-100 rounded-full"
              aria-label="Close modal"
            >
              <FiX className="size-5 stroke-[1.5px]" />
            </button>
          </div>
        </div>

        {/* Admin Actions */}
        <div className="mt-3 flex flex-wrap gap-2">
          {/* Show regular status button for non-turnover items or turnover items that don't need confirmation */}
          {!(
            (post.turnoverDetails?.turnoverStatus === "declared" &&
              post.turnoverDetails.turnoverAction === "turnover to OSA") ||
            post.turnoverDetails?.turnoverAction ===
              "turnover to Campus Security"
          ) && (
            <button
              onClick={handleToggleStatus}
              disabled={isUpdatingStatus}
              className={`px-3 py-1 text-sm rounded flex items-center gap-1 ${
                post.status === "resolved"
                  ? "bg-yellow-100 text-yellow-800 hover:bg-yellow-200"
                  : "bg-green-100 text-green-800 hover:bg-green-200"
              } hidden`}
            >
              {isUpdatingStatus ? (
                <span className="animate-spin">⟳</span>
              ) : post.status === "resolved" ? (
                "Mark as Pending"
              ) : (
                "Mark as Resolved"
              )}
            </button>
          )}

          {/* Hidden flagged indicator */}
          {post.isFlagged && (
            <span className="px-3 py-1 text-sm bg-red-100 text-red-800 rounded flex items-center gap-1">
              ⚠️ Flagged
            </span>
          )}
        </div>

        {imageUrls.length > 0 && (
          <div className="mt-3 flex items-center justify-center">
            <div className="relative group w-full max-w-md">
              {/* Previous button */}
              {imageUrls.length > 1 && (
                <button
                  onClick={goToPreviousImage}
                  className="absolute left-2 top-1/2 -translate-y-1/2 z-10 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                  aria-label="Previous image"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
              )}

              {/* Main image */}
              <img
                src={imageUrls[currentImageIndex]}
                alt={`Uploaded image ${currentImageIndex + 1}`}
                className="w-full h-auto object-cover rounded cursor-pointer"
                onClick={(e) => {
                  // Click on left half to go previous, right half to go next
                  const rect = e.currentTarget.getBoundingClientRect();
                  const clickX = e.clientX - rect.left;
                  const isLeftHalf = clickX < rect.width / 2;

                  if (imageUrls.length > 1) {
                    if (isLeftHalf) {
                      goToPreviousImage();
                    } else {
                      goToNextImage();
                    }
                  }
                }}
              />

              {/* Next button */}
              {imageUrls.length > 1 && (
                <button
                  onClick={goToNextImage}
                  className="absolute right-2 top-1/2 -translate-y-1/2 z-10 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                  aria-label="Next image"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              )}

              {/* Image counter and current index */}
              <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded-full">
                {currentImageIndex + 1} / {imageUrls.length}
              </div>

              {/* Click hint for mobile */}
              {imageUrls.length > 1 && (
                <div className="absolute bottom-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded-full opacity-0 md:opacity-100 md:pointer-events-none md:select-none">
                  Tap sides to navigate
                </div>
              )}
            </div>
          </div>
        )}

        {imageLoadingError && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-md">
            <div className="flex items-center justify-between">
              <span className="text-red-600 text-sm">
                ⚠️ {imageLoadingError}
              </span>
              <button
                onClick={() => {
                  setImageLoadingError(null);
                  setCurrentImageIndex(0); // Reset to first image
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

        <div className="my-2 lg:flex lg:items-center lg:justify-between">
          <h2 className="text-xl font-semibold my-2">{post.title}</h2>

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

            {post.type === "found" && post.foundAction && (
              <span className="px-2 py-1 rounded-[3px] font-medium bg-blue-100 text-blue-700">
                {post.foundAction === "keep"
                  ? "Keep"
                  : post.foundAction === "turnover to OSA"
                  ? "OSA"
                  : "Campus Security"}
              </span>
            )}

            <span
              className={`px-2 py-1 rounded-[3px] font-medium ${
                post.status === "resolved"
                  ? "bg-green-100 text-green-700"
                  : post.status === "unclaimed"
                  ? "bg-orange-100 text-orange-700"
                  : "bg-gray-100 text-gray-700"
              }`}
            >
              {post.status?.toUpperCase() || "PENDING"}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:gap-4 lg:grid-cols-2">
          <div>
            <p className="text-[13px] mb-2">Date and Time</p>
            <div className="bg-gray-50 border border-gray-400 rounded py-2 px-2">
              {post.createdAt && (
                <p className="text-[13px] text-black">
                  {formatDateTime(post.createdAt)}
                </p>
              )}
            </div>
            <p className="text-[13px] mt-3 mb-2">Item Description</p>
            <div className="bg-gray-50 border border-gray-400 rounded py-2 px-2 h-48 overflow-y-auto">
              <p className="text-[13px] text-gray-600">{post.description}</p>
            </div>

            {/* Unclaimed Status - show when post is unclaimed */}
            {post.status === "unclaimed" && (
              <div className="mt-3 p-3 bg-orange-50 border border-orange-200 rounded-md">
                <div className="text-sm text-orange-800 font-medium mb-2">
                  Unclaimed Status
                </div>
                <div className="text-sm text-orange-700 space-y-2">
                  <p>
                    This post has expired and was automatically moved to
                    unclaimed status after 30 days.
                  </p>
                  <p className="font-medium">
                    Activating this post will restore it with a new 30-day
                    period.
                  </p>
                </div>
              </div>
            )}

            {/* Revert Reason Display - show for admins when post has been reverted */}
            {post.revertReason && (
              <div className="mt-3 p-3 bg-orange-50 border border-orange-200 rounded-md">
                <div className="text-sm text-orange-800 font-medium mb-2">
                  Revert Reason:
                </div>
                <div className="text-sm text-orange-700">
                  {post.revertReason}
                </div>
              </div>
            )}

            {post.type === "found" && post.foundAction && (
              <>
                <p className="text-[13px] mt-3 mb-2">Found Item Action</p>
                <div className="bg-blue-50 border border-blue-200 rounded py-2 px-2">
                  <p className="text-[13px] text-blue-700 font-medium">
                    {post.foundAction === "keep"
                      ? "The finder will keep this item and return it themselves"
                      : post.turnoverDetails &&
                        post.turnoverDetails.originalTurnoverAction ===
                          "turnover to Campus Security" &&
                        post.turnoverDetails.turnoverAction ===
                          "turnover to OSA"
                      ? "This item was transferred to OSA"
                      : post.foundAction === "turnover to OSA"
                      ? "This item was turned over to OSA office"
                      : "This item was turned over to Campus Security"}
                  </p>
                </div>
              </>
            )}

            {post.coordinates && (
              <>
                <p className="text-[13px] mt-3 mb-2">Pinned Coordinates</p>
                <div className="bg-gray-50 border border-gray-400 rounded py-2 px-2 mb-3">
                  <p className="text-[13px] text-gray-600">
                    {post.coordinates.lat.toFixed(5)},{" "}
                    {post.coordinates.lng.toFixed(5)}
                  </p>
                </div>

                {/* Item Holder Transfer - show under coordinates in left column */}
                {post.turnoverDetails &&
                  post.turnoverDetails.originalTurnoverAction ===
                    "turnover to Campus Security" &&
                  post.turnoverDetails.turnoverAction === "turnover to OSA" && (
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                        <h3 className="font-semibold text-blue-800 text-sm">
                          🔄 Item Holder Transfer
                        </h3>
                      </div>
                      <div className="text-sm text-blue-700 space-y-1 text-xs">
                        <p>
                          <strong>Status:</strong> Item has been transferred
                          from Campus Security to OSA (Admin)
                        </p>
                        <p>
                          <strong>Collection Date:</strong>{" "}
                          {post.turnoverDetails.confirmedAt
                            ? formatDateTime(post.turnoverDetails.confirmedAt)
                            : "N/A"}
                        </p>
                        {post.turnoverDetails.turnoverReason && (
                          <p>
                            <strong>Reason:</strong>{" "}
                            {post.turnoverDetails.turnoverReason}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
              </>
            )}
          </div>

          <div>
            <p className="text-[13px] mt-2">Last seen location</p>
            <div className="bg-gray-50 border border-gray-400 rounded py-2 px-2 mb-3">
              <p className="text-sm text-gray-700">{post.location}</p>
            </div>

            {/* Admin Notes Display - show in right column when post has admin notes */}
            {post.adminNotes && (
              <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-md">
                <div className="text-sm text-blue-800 font-medium mb-2">
                  Admin Notes:
                </div>
                <div className="text-sm text-blue-700">{post.adminNotes}</div>
              </div>
            )}

            {post.coordinates && (
              <div className="w-full h-60 mb-3">
                <iframe
                  title="Map location preview"
                  width="100%"
                  height="100%"
                  className="rounded border border-gray-300"
                  loading="lazy"
                  src={`https://www.openstreetmap.org/export/embed.html?bbox=${
                    post.coordinates.lng - 0.001
                  }%2C${post.coordinates.lat - 0.001}%2C${
                    post.coordinates.lng + 0.001
                  }%2C${post.coordinates.lat + 0.001}&layer=mapnik&marker=${
                    post.coordinates.lat
                  }%2C${post.coordinates.lng}`}
                />
              </div>
            )}

            {/* Turnover Details - show under map in right column */}
            {post.turnoverDetails && (
              <div className="p-3 bg-blue-50 border border-blue-200 h-60 rounded-md">
                <h3 className="font-semibold text-blue-800 mb-2 text-sm">
                  Turnover Details
                </h3>
                <div className="text-sm text-blue-700 space-y-1">
                  {/* Original Finder Information */}
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-medium text-blue-800 text-xs">
                      Originally found by:
                    </span>
                    <ProfilePicture
                      src={post.turnoverDetails.originalFinder.profilePicture}
                      alt={`${post.turnoverDetails.originalFinder.firstName} ${post.turnoverDetails.originalFinder.lastName}`}
                      className="size-5 border-blue-300"
                    />
                    <span className="text-blue-700 text-xs">
                      {post.turnoverDetails.originalFinder.firstName}{" "}
                      {post.turnoverDetails.originalFinder.lastName}
                    </span>
                  </div>

                  <div className="flex flex-col gap-2 text-xs">
                    <div>
                      <span className="font-medium">Student ID:</span>{" "}
                      {post.turnoverDetails.originalFinder.studentId || "N/A"}
                    </div>
                    <div>
                      <span className="font-medium">Email:</span>{" "}
                      {post.turnoverDetails.originalFinder.email}
                    </div>
                    {post.turnoverDetails.originalFinder.contactNum && (
                      <div className="col-span-2">
                        <span className="font-medium">Contact:</span>{" "}
                        {post.turnoverDetails.originalFinder.contactNum}
                      </div>
                    )}
                  </div>

                  <div className="border-t space-y-2 border-blue-200 pt-2 mt-3 text-xs">
                    <p>
                      <strong>Status:</strong>{" "}
                      {post.turnoverDetails.turnoverStatus === "declared"
                        ? "Declared - Awaiting Confirmation"
                        : post.turnoverDetails.turnoverStatus === "confirmed"
                        ? "Confirmed - Item Received"
                        : post.turnoverDetails.turnoverStatus === "not_received"
                        ? "Not Received - Item Deleted"
                        : post.turnoverDetails.turnoverAction ===
                          "turnover to Campus Security"
                        ? "Turned over to Campus Security"
                        : post.turnoverDetails.turnoverAction ===
                          "turnover to OSA"
                        ? "Turned over to OSA"
                        : post.turnoverDetails.turnoverStatus}
                    </p>
                    {post.turnoverDetails.turnoverReason && (
                      <p>
                        <strong>Reason:</strong>{" "}
                        {post.turnoverDetails.turnoverReason}
                      </p>
                    )}
                    {post.turnoverDetails.confirmationNotes && (
                      <p>
                        <strong>Item Condition Notes:</strong>{" "}
                        {post.turnoverDetails.confirmationNotes}
                      </p>
                    )}
                    {post.turnoverDetails.confirmedAt && (
                      <p>
                        <strong>Confirmed At:</strong>{" "}
                        {formatDateTime(post.turnoverDetails.confirmedAt)}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {post.handoverDetails && (
          <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-md">
            <h3 className="font-semibold text-blue-800 mb-2 text-sm">
              Handover Details
            </h3>
            <HandoverDetailsDisplay handoverDetails={post.handoverDetails} />
          </div>
        )}
      </div>

      {/* Activation Modal */}
      <ActivationModal
        post={post}
        isOpen={isActivationModalOpen}
        onClose={() => setIsActivationModalOpen(false)}
        onConfirm={handleActivationConfirm}
        isActivating={isActivating}
      />
    </div>
  );
}
