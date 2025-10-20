import { useEffect, useMemo, memo, useState } from "react";
import type { Post } from "@/types/Post";
import ProfilePicture from "./ProfilePicture";

interface AdminPostCardProps {
  post: Post;
  onClick: () => void;
  highlightText: string;
  onDelete?: (post: Post) => void;
  onStatusChange?: (post: Post, status: string, adminNotes?: string) => void;
  onActivateTicket?: (post: Post) => void;
  onRevertResolution?: (post: Post) => void;
  onHidePost?: (post: Post) => void;
  onUnhidePost?: (post: Post) => void;
  onRestore?: (post: Post) => void;
  onPermanentDelete?: (post: Post) => void;
  onApprove?: (post: Post) => void; // Added for flagged posts approve action
  onConfirmTurnover?: (post: Post, status: "confirmed" | "not_received") => void; // Added for turnover management
  onConfirmCampusSecurityCollection?: (post: Post, status: "collected" | "not_available") => void; // Added for campus security collection
  hideDeleteButton?: boolean;
  isDeleting?: boolean;
  showUnclaimedMessage?: boolean;
  isSelected?: boolean; // Added for selection styling
  onSelectionChange?: (post: Post, selected: boolean) => void; // Added for selection functionality
  hideStatusDropdown?: boolean; // Added to hide status dropdown for unclaimed posts
  showCampusSecurityButtons?: boolean; // Added to show campus security specific buttons
}

import { formatDateTime } from "@/utils/dateUtils";

// Format function for post creation time
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
  onRevertResolution,
  onHidePost,
  onUnhidePost,
  onRestore,
  onPermanentDelete,
  onApprove, // Added for flagged posts approve action
  onConfirmTurnover, // Added for turnover management
  onConfirmCampusSecurityCollection, // Added for campus security collection
  hideDeleteButton = false,
  isDeleting = false,
  showUnclaimedMessage = true,
  isSelected = false, // Added for selection styling
  onSelectionChange, // Added for selection functionality
  hideStatusDropdown = false, // Added to hide status dropdown for unclaimed posts
  showCampusSecurityButtons = false, // Added to show campus security specific buttons
}: AdminPostCardProps) {
  const [showAdminNotesModal, setShowAdminNotesModal] = useState(false);
  const [adminNotes, setAdminNotes] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const previewUrl = useMemo(() => {
    if (post.images && post.images.length > 0) {
      const firstImage = post.images[0];
      return typeof firstImage === "string"
        ? firstImage
        : URL.createObjectURL(firstImage as File);
    }
    return null;
  }, [post.images]);

  useEffect(() => {
    const firstImage = post.images?.[0];
    if (firstImage && typeof firstImage !== "string") {
      const url = URL.createObjectURL(firstImage);
      return () => URL.revokeObjectURL(url); // cleanup when component unmounts
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

  return (
    <div
      className={`bg-white rounded shadow/2 overflow-hidden hover:shadow-md/5 transition relative ${
        isSelected
          ? "border-brand ring-2 ring-brand/20 shadow-brand/10"
          : post.isFlagged
          ? "border border-red-500"
          : ""
      }`}
    >
      {/* Selection Checkbox - Top Left */}
      {onSelectionChange && (
        <div className="absolute top-2 left-2 z-10">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={(e) => {
              e.stopPropagation();
              onSelectionChange(post, e.target.checked);
            }}
            className="size-5 text-brand border-gray-300 rounded focus:ring-brand"
          />
        </div>
      )}

      {previewUrl ? (
        <div className="relative overflow-hidden">
          <img
            src={previewUrl}
            alt="post"
            className="w-full h-85 object-cover cursor-pointer lg:h-70"
            onClick={onClick}
          />

          {/* Red Flag Icon - Top Right */}
          {post.isFlagged && (
            <div className="absolute top-2 right-2 text-2xl drop-shadow-lg z-10">🚩</div>
          )}

          {/* Unclaimed Badge - Top Left */}
          {(post.status === "unclaimed" || post.movedToUnclaimed) && (
            <div className="absolute top-2 left-2 z-10">
              <div className="relative group">
                <div className="px-2 py-1 bg-orange-100 text-orange-700 text-xs font-medium rounded drop-shadow-lg flex items-center gap-1">
                  UNCLAIMED
                  <div className="w-3 h-3 rounded-full bg-orange-600 text-white text-[10px] flex items-center justify-center cursor-help hover:bg-orange-700 transition-colors">
                    i
                  </div>
                </div>

                {/* Tooltip */}
                <div className="absolute top-full left-0 mt-1 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50 whitespace-nowrap">
                  {post.movedToUnclaimed
                    ? "This post expired after 30 days and was automatically moved to unclaimed status"
                    : "This post was manually marked as unclaimed by an administrator"}
                  <div className="absolute -top-1 left-4 w-0 h-0 border-l-2 border-r-2 border-b-2 border-transparent border-b-gray-900"></div>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-gray-300 h-60 w-full" onClick={onClick} />
      )}

      <div className="p-3">
        {/* Admin Action Buttons */}
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center gap-2 text-[13px] lg:text-[10px] text-gray-500">
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

          {/* Admin Controls */}
          <div className="flex gap-2">
            {(post.status === "resolved" || post.status === "completed") &&
              onRevertResolution && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRevertResolution(post);
                  }}
                  className="px-2 py-1 text-xs bg-orange-500 text-white rounded hover:bg-orange-600 transition"
                  title="Revert Resolution - Change back to pending"
                >
                  Revert
                </button>
              )}

            {/* Restore and Permanently Delete buttons for deleted posts */}
            {/* {onRestore && onPermanentDelete && (
              <div className="flex gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRestore(post);
                  }}
                  className="px-2 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600 transition"
                  title="Restore Post - Move back to active status"
                >
                  Restore
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onPermanentDelete(post);
                  }}
                  className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 transition"
                  title="Permanently Delete - This cannot be undone"
                >
                  Delete Permanently
                </button>
              </div>
            )} */}
          </div>
        </div>

        <h1
          className="text-lg font-semibold my-2 truncate max-w-[12rem]"
          onClick={onClick}
        >
          {post.title}
        </h1>

        {/* Enhanced User Information */}
        <div className="bg-gray-50 p-2 rounded mb-3">
          <div className="flex items-center gap-2 mb-2">
            <ProfilePicture
              src={post.user?.profilePicture}
              alt="user profile"
              className="size-5"
              priority={false}
            />
            <div className="flex-1">
              <p className="text-xs text-blue-800 font-medium">
                {post.user?.firstName && post.user?.lastName
                  ? `${post.user.firstName} ${post.user.lastName}`
                  : post.user?.email
                  ? post.user.email.split("@")[0]
                  : "Unknown User"}
              </p>
              <p className="text-xs text-gray-600">
                ID: {post.user?.studentId || "N/A"}
              </p>
              <p className="text-xs text-gray-600">
                Contact: {post.user?.contactNum || "N/A"}
              </p>
            </div>
          </div>
          {/* Action buttons moved below contact info */}
          <div className="flex gap-1 mt-2">
            {/* Turnover confirmation button - for turnover management */}
            {onConfirmTurnover && post.turnoverDetails?.turnoverStatus === "declared" && (
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
            {showCampusSecurityButtons && onConfirmCampusSecurityCollection &&
             post.turnoverDetails?.turnoverAction === "turnover to Campus Security" && (
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

        {!hideStatusDropdown && (
          <div className="mb-3">
            <label className="text-xs text-gray-600 block mb-1">
              Status: {post.status} {/* Debug: show current status */}
            </label>
            <select
              value={post.status || "pending"}
              onChange={handleStatusChange}
              className="text-xs p-1 border rounded bg-white"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Show all available options, excluding current status */}
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

        {/* Show activation status for posts that can be activated */}
        {(post.status === "unclaimed" || post.movedToUnclaimed) &&
          showUnclaimedMessage && (
            <div className="mb-3 p-2 bg-orange-50 border border-orange-200 rounded">
              <div className="text-xs text-orange-800 font-medium mb-1">
                {post.movedToUnclaimed
                  ? "Expired & Unclaimed"
                  : "Marked as Unclaimed"}
              </div>
              <div className="text-xs text-orange-600">
                {post.movedToUnclaimed
                  ? "This post expired and was automatically moved to unclaimed. Click Activate to restore it."
                  : "This post was manually marked as unclaimed. Click Activate to restore it."}
              </div>
            </div>
          )}

        <div className="text-sm lg:text-xs flex flex-col gap-2">
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
          onClick={onClick}
        />


        {/* Restore and Permanently Delete buttons for deleted posts */}
        {onRestore && onPermanentDelete && (
          <div className="flex gap-2 mt-3">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRestore(post);
              }}
              className="px-3 py-2 w-full text-xs bg-green-500 text-white rounded hover:bg-green-600 transition"
              title="Restore Post - Move back to active status"
            >
              Restore
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onPermanentDelete(post);
              }}
              className="px-2 py-1 w-full text-xs bg-red-600 text-white rounded hover:bg-red-700 transition"
              title="Permanently Delete - This cannot be undone"
            >
              Delete Permanently
            </button>
          </div>
        )}
      </div>

      {/* Admin Notes Modal */}
      {showAdminNotesModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Admin Notes</h3>
            <p className="text-sm text-gray-600 mb-4">
              Adding notes for changing status from "{post.status}" to "
              {selectedStatus}":
            </p>
            <textarea
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              placeholder="Optional notes for this status change..."
              className="w-full p-3 border rounded-lg resize-none h-24 text-sm"
              maxLength={500}
            />
            <div className="flex justify-end gap-3 mt-4">
              <button
                onClick={handleAdminNotesCancel}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded"
              >
                Cancel
              </button>
              <button
                onClick={handleAdminNotesConfirm}
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
