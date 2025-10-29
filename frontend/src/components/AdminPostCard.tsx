import { useEffect, useMemo, memo, useState } from "react";
import type { Post } from "@/types/Post";
import ProfilePicture from "./ProfilePicture";
import ImageModal from "./ImageModal";

interface AdminPostCardProps {
  post: Post;
  onClick: () => void;
  highlightText: string;
  onDelete?: (post: Post) => void;
  onStatusChange?: (post: Post, status: string, adminNotes?: string) => void;
  onActivateTicket?: (post: Post) => void;
  onHidePost?: (post: Post) => void;
  onUnhidePost?: (post: Post) => void;
  onRestore?: (post: Post) => void;
  onPermanentDelete?: (post: Post) => void;
  onApprove?: (post: Post) => void;
  onConfirmTurnover?: (post: Post, status: "confirmed" | "not_received") => void;
  onConfirmCampusSecurityCollection?: (post: Post, status: "collected" | "not_available") => void;
  onRevert?: (post: Post) => void;
  hideDeleteButton?: boolean;
  isDeleting?: boolean;
  showUnclaimedMessage?: boolean;
  isSelected?: boolean;
  onSelectionChange?: (post: Post, selected: boolean) => void;
  hideStatusDropdown?: boolean;
  showCampusSecurityButtons?: boolean;
}

import { formatDateTime } from "@/utils/dateUtils";

const formatPostTime = (
  date: Date | string | { seconds: number; nanoseconds: number }
) => {
  return formatDateTime(date);
};

function highlightAndTruncate(text: string, keyword: string, maxLength = 90) {
  let truncated = text;
  if (text.length > maxLength) {
    truncated = text.slice(0, maxLength).trim() + "...";
  }

  if (!keyword.trim()) return truncated;

  const words = keyword.toLowerCase().split(" ").filter(Boolean);
  let result = truncated;

  words.forEach((word) => {
    const regex = new RegExp(`(${word})`, "gi");
    result = result.replace(
      regex,
      `<span class="bg-blue-300 font-medium">$1</span>`
    );
  });

  return result;
}

function AdminPostCard({
  post,
  onClick,
  highlightText,
  onDelete,
  onStatusChange,
  onActivateTicket,
  onHidePost,
  onUnhidePost,
  onRestore,
  onPermanentDelete,
  onApprove,
  onConfirmTurnover,
  onConfirmCampusSecurityCollection,
  onRevert,
  hideDeleteButton = false,
  isDeleting = false,
  showUnclaimedMessage = true,
  isSelected = false,
  onSelectionChange,
  hideStatusDropdown = false,
  showCampusSecurityButtons = false,
}: AdminPostCardProps) {
  const [showAdminNotesModal, setShowAdminNotesModal] = useState(false);
  const [adminNotes, setAdminNotes] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [isHovered, setIsHovered] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [isMinimized, setIsMinimized] = useState(true);

  const previewUrl = useMemo(() => {
    if (post.images && post.images.length > 0) {
      const firstImage = post.images[0];
      return typeof firstImage === "string"
        ? firstImage
        : URL.createObjectURL(firstImage as File);
    }
    return null;
  }, [post.images]);

  // Process all images for the modal
  const allImageUrls = useMemo(() => {
    if (!post.images || post.images.length === 0) return [];

    return post.images.map((image) => {
      if (typeof image === "string") {
        return image;
      } else {
        // For File objects, create object URLs
        return URL.createObjectURL(image as File);
      }
    });
  }, [post.images]);

  useEffect(() => {
    const firstImage = post.images?.[0];
    if (firstImage && typeof firstImage !== "string") {
      const url = URL.createObjectURL(firstImage);
      return () => URL.revokeObjectURL(url);
    }
  }, [post.images]);

  const categoryStyles: Record<string, string> = {
    "Student Essentials": "bg-yellow-300 text-black",
    Gadgets: "bg-blue-400 text-black",
    "Personal Belongings": "bg-purple-300 text-black",
  };

  const typeStyles: Record<string, string> = {
    lost: "bg-red-100 text-red-700",
    found: "bg-green-100 text-green-700",
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete?.(post);
  };

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    e.stopPropagation();
    const newStatus = e.target.value;
    if (newStatus !== post.status) {
      setSelectedStatus(newStatus);
      setAdminNotes("");
      setShowAdminNotesModal(true);
    }
  };

  const handleAdminNotesConfirm = () => {
    onStatusChange?.(post, selectedStatus, adminNotes.trim() || undefined);
    setShowAdminNotesModal(false);
    setAdminNotes("");
    setSelectedStatus("");
  };

  const handleAdminNotesCancel = () => {
    setShowAdminNotesModal(false);
    setAdminNotes("");
    setSelectedStatus("");
  };

  const toggleMinimize = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsMinimized(!isMinimized);
  };

  return (
    <div className={`bg-white rounded shadow/2 hover:shadow-md/5 transition relative cursor-pointer ${isSelected ? "border-brand ring-2 ring-brand/20 shadow-brand/10" : post.isFlagged ? "border border-red-500" : ""}`} onClick={onClick} onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)}>
      {/* Selection Checkbox */}
      {onSelectionChange && (isHovered || isSelected) && (
        <div className={`absolute top-1 right-1 z-20 transition-opacity duration-200 ${isHovered || isSelected ? 'opacity-100' : 'opacity-0'}`}>
          <input
            type="checkbox"
            checked={isSelected}
            onChange={(e) => {
              e.stopPropagation();
              onSelectionChange(post, e.target.checked);
            }}
            onClick={(e) => e.stopPropagation()}
            className="size-5 text-brand border-2 border-gray-400 rounded focus:ring-2 focus:ring-brand focus:border-brand bg-white"
          />
        </div>
      )}

      {previewUrl ? (
        <div className="relative overflow-visible">
          <img
            src={previewUrl}
            alt="post"
            className="w-full h-85 object-cover cursor-pointer lg:h-70 hover:opacity-90 transition-opacity"
            onClick={(e) => {
              e.stopPropagation(); // Prevent card click
              if (allImageUrls.length > 0) {
                setShowImageModal(true);
                setSelectedImageIndex(0);
              }
            }}
            title={allImageUrls.length > 1 ? `Click to view ${allImageUrls.length} images` : "Click to view full size"}
          />

          {/* Red Flag Icon - Top Left */}
          {post.isFlagged && (
            <div className="absolute top-1 left-1 text-2xl drop-shadow-lg z-10">
              🚩
            </div>
          )}

          {/* Badge Container - Top Left */}
          <div className={`absolute top-2 left-2 z-10 ${(() => {
            const badges = [];
            // Check 30 days left badge
            if (post.expiryDate && (() => {
              try {
                const now = new Date();
                let expiry: Date;
                if (post.expiryDate && typeof post.expiryDate === "object" && "seconds" in post.expiryDate) {
                  expiry = new Date(post.expiryDate.seconds * 1000);
                } else if (post.expiryDate instanceof Date) {
                  expiry = post.expiryDate;
                } else if (post.expiryDate) {
                  expiry = new Date(post.expiryDate);
                } else {
                  return false;
                }
                if (isNaN(expiry.getTime())) return false;
                const daysLeft = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                return daysLeft > 0;
              } catch (error) {
                return false;
              }
            })()) badges.push('daysLeft');

            // Check unclaimed badge
            if (post.status === "unclaimed" || post.movedToUnclaimed) badges.push('unclaimed');

            // Check resolved badge
            if (post.status === "resolved" || post.status === "completed") badges.push('resolved');

            return badges.length > 1 ? 'flex gap-2' : 'flex';
          })()}`}>
            {/* 30 Days Left Badge */}
            {post.expiryDate && (() => {
              try {
                const now = new Date();
                let expiry: Date;

                if (
                  post.expiryDate &&
                  typeof post.expiryDate === "object" &&
                  "seconds" in post.expiryDate
                ) {
                  expiry = new Date(post.expiryDate.seconds * 1000);
                } else if (post.expiryDate instanceof Date) {
                  expiry = post.expiryDate;
                } else if (post.expiryDate) {
                  expiry = new Date(post.expiryDate);
                } else {
                  return null;
                }

                if (isNaN(expiry.getTime())) return null;

                const daysLeft = Math.ceil(
                  (expiry.getTime() - now.getTime()) /
                    (1000 * 60 * 60 * 24)
                );

                if (daysLeft <= 0) {
                  return null;
                } else if (daysLeft <= 3) {
                  return (
                    <span className="capitalize px-2 py-1 rounded-[3px] font-medium bg-red-100 text-red-700 text-xs">
                      ⚠️ {daysLeft} day{daysLeft !== 1 ? "s" : ""} left
                    </span>
                  );
                } else if (daysLeft <= 7) {
                  return (
                    <span className="capitalize px-2 py-1 rounded-[3px] font-medium bg-orange-100 text-orange-700 text-xs">
                      ⚠️ {daysLeft} day{daysLeft !== 1 ? "s" : ""} left
                    </span>
                  );
                } else {
                  return (
                    <span className="capitalize px-2 py-1 rounded-[3px] font-medium bg-green-100 text-green-700 text-xs">
                      {daysLeft} day{daysLeft !== 1 ? "s" : ""} left
                    </span>
                  );
                }
              } catch (error) {
                console.error("Error calculating days left:", error);
                return null;
              }
            })()}

            {/* Unclaimed Badge */}
            {(post.status === "unclaimed" || post.movedToUnclaimed) && (
              <div className="relative group">
                <div className="px-2 py-1 bg-orange-100 text-orange-700 text-xs font-medium rounded drop-shadow-lg flex items-center gap-1">
                  UNCLAIMED
                  <div className="w-3 h-3 rounded-full bg-orange-600 text-white text-[8px] flex items-center justify-center cursor-help hover:bg-orange-700 transition-colors">
                    i
                  </div>
                </div>
                <div className="absolute top-full left-0 mt-1 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-[60] whitespace-nowrap shadow-lg">
                  {post.movedToUnclaimed
                    ? "This post expired after 30 days and was automatically moved to unclaimed status"
                    : "This post was manually marked as unclaimed by an administrator"}
                  <div className="absolute -top-1 left-4 w-0 h-0 border-l-2 border-r-2 border-b-2 border-transparent border-b-gray-900"></div>
                </div>
              </div>
            )}

            {/* Resolved Badge - Aligned with other badges in same container */}
            {(post.status === "resolved" || post.status === "completed") && (
              <span className="capitalize px-2 py-1 rounded-[3px] font-medium bg-green-100 text-green-700 text-xs">
                RESOLVED
              </span>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-gray-300 h-60 w-full" />
      )}

      <div className="p-3">
        <div className="flex flex-row items-start">
          <div className="">
            <div className="flex items-center gap-2 text-gray-500 text-[11px] mb-2.5">
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
            </div>

            <div className="flex items-center gap-2 text-[11px]">
              {/* Found Action Badge */}
              {post.type === "found" && post.foundAction && (
                <span className="px-2 py-1 rounded-[3px] font-medium bg-blue-100 text-blue-700">
                  {post.foundAction === "keep"
                    ? "Keep"
                    : post.foundAction === "turnover to OSA"
                    ? "OSA"
                    : "Campus Security"}
                </span>
              )}

              {/* Status Badge */}
            </div>
          </div>
        </div>

        <h1 className="text-lg font-semibold my-2">
          {post.title}
        </h1>

        {/* Display the user who created the post */}
        <div
          className={`bg-sky-100 rounded-lg border border-sky-200 relative cursor-pointer select-none hover:bg-sky-200 transition-colors ${isMinimized ? 'p-2 mb-2' : 'p-3 mb-3'}`}
          onClick={(e) => {
            e.stopPropagation();
            toggleMinimize(e);
          }}
        >
          <div className={`flex items-center gap-2 ${isMinimized ? 'mb-0' : 'mb-1'}`}>
            <ProfilePicture
              src={post.user?.profilePicture}
              alt="user profile"
              className="size-5"
              priority={false}
            />
            <div className="flex items-center gap-2 flex-1">
              {isMinimized ? (
                <p className="text-xs text-blue-800 font-medium">
                  Posted by{" "}
                  {post.user?.firstName && post.user?.lastName
                    ? `${post.user.firstName} ${post.user.lastName}`
                    : post.user?.email
                    ? post.user.email.split("@")[0]
                    : "Unknown User"}
                </p>
              ) : (
                <p className="text-xs text-blue-800 font-medium">
                  Posted by{" "}
                  {post.user?.firstName && post.user?.lastName
                    ? `${post.user.firstName} ${post.user.lastName}`
                    : post.user?.email
                    ? post.user.email.split("@")[0]
                    : "Unknown User"}
                </p>
              )}
              {/* Admin Badge */}
              {post.user?.role === "admin" && (
                <span className="bg-amber-500 text-white text-xs px-2 py-1 rounded-full font-semibold">
                  ADMIN
                </span>
              )}
            </div>
          </div>
          {!isMinimized && (
            <div className="mt-2 text-xs text-gray-600">
              <p>ID: {post.user?.studentId || "N/A"}</p>
              <p>Contact: {post.user?.contactNum || "N/A"}</p>
              
              {/* Restore and Permanently Delete buttons for deleted posts */}
              {onRestore && onPermanentDelete && (
                <div className="flex gap-1 mt-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRestore(post);
                    }}
                    className="px-3 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600 transition whitespace-nowrap"
                    title="Restore Post"
                  >
                    Restore
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onPermanentDelete(post);
                    }}
                    className="px-3 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 transition whitespace-nowrap"
                    title="Permanently Delete"
                  >
                    Delete
                  </button>
                </div>
              )}
              
              {/* Action buttons */}
              <div className="flex gap-1 mt-2">
                {/* Turnover confirmation button - for turnover management */}
                {onConfirmTurnover &&
                  post.turnoverDetails?.turnoverStatus === "declared" && (
                    <>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onConfirmTurnover(post, "confirmed");
                        }}
                        className="px-2 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600 transition flex items-center gap-1"
                        title="Confirm Received - Mark as successfully received"
                      >
                        ✓ Confirm Received
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onConfirmTurnover(post, "not_received");
                        }}
                        className="px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600 transition flex items-center gap-1"
                        title="Mark as Not Received - Item was not turned over"
                      >
                        ✗ Not Received
                      </button>
                    </>
                  )}

                {/* Approve button - for flagged posts */}
                {onApprove && post.isFlagged && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onApprove(post);
                    }}
                    className="px-2 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600 transition"
                    title="Approve Post - Remove flag and make visible"
                  >
                    Approve
                  </button>
                )}

                {post.isFlagged && !post.isHidden && onHidePost && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onHidePost(post);
                    }}
                    className="px-2 py-1 text-xs bg-orange-500 text-white rounded hover:bg-orange-600 transition"
                    title="Hide Post - Hide from public view"
                  >
                    Hide
                  </button>
                )}

                {post.isHidden && onUnhidePost && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onUnhidePost(post);
                    }}
                    className="px-2 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600 transition"
                    title="Unhide Post - Make visible to public"
                  >
                    Unhide
                  </button>
                )}

                {/* Campus Security Collection buttons */}
                {showCampusSecurityButtons &&
                  onConfirmCampusSecurityCollection &&
                  post.turnoverDetails?.turnoverAction ===
                    "turnover to Campus Security" && (
                    <>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onConfirmCampusSecurityCollection(post, "collected");
                        }}
                        className="px-2 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600 transition flex items-center gap-1"
                        title="Mark as Collected - Item has been collected by owner"
                      >
                        ✓ Collected
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onConfirmCampusSecurityCollection(post, "not_available");
                        }}
                        className="px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600 transition flex items-center gap-1"
                        title="Mark as Not Available - Item was not collected"
                      >
                        ✗ Not Available
                      </button>
                    </>
                  )}

                {/* Show revert button for completed posts */}
                {onRevert && (post.status === "resolved" || post.status === "completed") && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRevert(post);
                    }}
                    className="px-2 py-1 text-xs bg-orange-500 text-white rounded hover:bg-orange-600 transition"
                    title="Revert Post - Move back to pending status"
                  >
                    Revert
                  </button>
                )}

                {/* Show activate button for any post that can be reactivated */}
                {(post.status === "unclaimed" || post.movedToUnclaimed) &&
                  onActivateTicket && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onActivateTicket(post);
                      }}
                      className="px-2 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600 transition"
                      title="Activate - Move back to active status"
                    >
                      Activate
                    </button>
                  )}

                {!onPermanentDelete && !onRestore && !hideDeleteButton && (
                  <button
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className={`px-2 py-1 text-xs rounded transition ${
                      isDeleting
                        ? "bg-gray-400 cursor-not-allowed"
                        : "bg-red-500 hover:bg-red-600 text-white"
                    }`}
                    title={isDeleting ? "Deleting..." : "Delete Post"}
                  >
                    {isDeleting ? (
                      <span className="flex items-center gap-1">
                        <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
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
                        Deleting...
                      </span>
                    ) : (
                      "Delete"
                    )}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Status dropdown moved here */}
        {!hideStatusDropdown && (
          <div className="mb-3">
            <label className="text-xs text-gray-600 block mb-1">
              Status: {post.status}
            </label>
            <select
              value={post.status || "pending"}
              onChange={handleStatusChange}
              className="text-xs p-1 border rounded bg-white"
              onClick={(e) => e.stopPropagation()}
            >
              <option value="pending" disabled={post.status === "pending"}>
                Pending
              </option>
              <option value="unclaimed" disabled={post.status === "unclaimed"}>
                Unclaimed
              </option>
              <option value="resolved" disabled={post.status === "resolved"}>
                Resolved
              </option>
            </select>
          </div>
        )}

        {/* Unclaimed message moved here */}
        {(post.status === "unclaimed" || post.movedToUnclaimed) &&
          showUnclaimedMessage && (
            <div className="mb-3 p-2 bg-orange-50 border border-orange-200 rounded">
              <div className="text-xs text-orange-800 font-medium mb-1">
                {post.movedToUnclaimed ? "Expired & Unclaimed" : "Marked as Unclaimed"}
              </div>
              <div className="text-xs text-orange-600">
                {post.movedToUnclaimed
                  ? "This post expired and was automatically moved to unclaimed. Click Activate to restore it."
                  : "This post was manually marked as unclaimed. Click Activate to restore it."}
              </div>
            </div>
          )}

        <div className="text-xs lg:text-xs flex flex-col gap-2">
          {post.location && (
            <p className="font-medium text-black">
              <span className="font-medium">Last seen at </span>
              {post.location}
            </p>
          )}
          {post.createdAt && (
            <p className="text-gray-500 font-inter">
              {formatPostTime(post.createdAt)}
            </p>
          )}
        </div>

        <p
          className="text-xs text-gray-700 mt-2.5"
          dangerouslySetInnerHTML={{
            __html: highlightAndTruncate(post.description, highlightText),
          }}
        />

      </div>

      {/* Image Modal */}
      {showImageModal && allImageUrls.length > 0 && (
        <ImageModal
          images={allImageUrls}
          initialIndex={selectedImageIndex}
          altText={post.title}
          onClose={() => setShowImageModal(false)}
        />
      )}

      {/* Admin Notes Modal */}
      {showAdminNotesModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={(e) => e.stopPropagation()}>
          <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">Admin Notes</h3>
            <p className="text-sm text-gray-600 mb-4">
              Adding notes for changing status from "{post.status}" to "
              {selectedStatus}":
            </p>
            <textarea
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              placeholder="Optional notes for this status change..."
              className="w-full p-3 border rounded-lg resize-none h-24 text-sm"
              maxLength={500}
            />
            <div className="flex justify-end gap-3 mt-4">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleAdminNotesCancel();
                }}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded"
              >
                Cancel
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleAdminNotesConfirm();
                }}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Confirm Status Change
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default memo(AdminPostCard);
