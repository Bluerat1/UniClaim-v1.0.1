import { useEffect, useMemo, memo, useState } from "react";
import type { Post } from "@/types/Post";
import ProfilePicture from "./ProfilePicture";

interface AdminPostCardListProps {
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
  onApprove?: (post: Post) => void;
  onConfirmTurnover?: (post: Post, status: "confirmed" | "not_received") => void;
  onConfirmCampusSecurityCollection?: (post: Post, status: "collected" | "not_available") => void;
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

function AdminPostCardList({
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
  onApprove,
  onConfirmTurnover,
  onConfirmCampusSecurityCollection,
  hideDeleteButton = false,
  isDeleting = false,
  showUnclaimedMessage = true,
  isSelected = false,
  onSelectionChange,
  hideStatusDropdown = false,
  showCampusSecurityButtons = false,
}: AdminPostCardListProps) {
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

  return (
    <div className="bg-white rounded shadow/2 overflow-hidden hover:shadow-md/5 transition grid grid-cols-[80px_150px_1fr_300px_1.5fr_auto] gap-4 p-4 items-start relative">
      {/* Selection Checkbox */}
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

      {/* Photo Column */}
      {previewUrl ? (
        <div className="relative overflow-hidden w-16 h-16 flex-shrink-0">
          <img
            src={previewUrl}
            alt="post"
            className="object-cover cursor-pointer w-16 h-16 rounded"
            onClick={onClick}
          />
          {post.isFlagged && (
            <div className="absolute top-1 right-1 text-sm drop-shadow-lg z-10">🚩</div>
          )}
          {(post.status === "unclaimed" || post.movedToUnclaimed) && (
            <div className="absolute top-1 left-1 z-10 scale-75">
              <div className="relative group">
                <div className="px-1 py-0.5 bg-orange-100 text-orange-700 text-[10px] font-medium rounded drop-shadow-lg flex items-center gap-1">
                  UNCLAIMED
                  <div className="w-2 h-2 rounded-full bg-orange-600 text-white text-[8px] flex items-center justify-center cursor-help hover:bg-orange-700 transition-colors">
                    i
                  </div>
                </div>
                <div className="absolute top-full left-0 mt-1 bg-gray-900 text-white text-[10px] px-1 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50 whitespace-nowrap">
                  {post.movedToUnclaimed
                    ? "This post expired after 30 days and was automatically moved to unclaimed status"
                    : "This post was manually marked as unclaimed by an administrator"}
                  <div className="absolute -top-1 left-4 w-0 h-0 border-l-1 border-r-1 border-b-1 border-transparent border-b-gray-900"></div>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-gray-300 w-16 h-16 flex-shrink-0" onClick={onClick} />
      )}

      {/* Status Column */}
      <div className="min-w-0">
        {!hideStatusDropdown && (
          <div className="mb-2">
            <label className="text-xs text-gray-600 block mb-0.5">
              Status: {post.status}
            </label>
            <select
              value={post.status || "pending"}
              onChange={handleStatusChange}
              className="text-xs p-0.5 border rounded bg-white"
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
        {(post.status === "unclaimed" || post.movedToUnclaimed) &&
          showUnclaimedMessage && (
            <div className="mb-2 p-1 text-[10px]">
              <div className="text-xs text-orange-800 font-medium mb-0.5">
                {post.movedToUnclaimed
                  ? "Expired & Unclaimed"
                  : "Marked as Unclaimed"}
              </div>
              <div className="text-[10px] text-orange-600">
                {post.movedToUnclaimed
                  ? "This post expired and was automatically moved to unclaimed. Click Activate to restore it."
                  : "This post was manually marked as unclaimed. Click Activate to restore it."}
              </div>
            </div>
          )}
      </div>

      {/* Title Column */}
      <div className="min-w-0">
        <h1 className="font-semibold text-sm mb-1 truncate" onClick={onClick}>
          {post.title}
        </h1>
        <div className="text-xs flex flex-col gap-1">
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
      </div>

      {/* Creator Column */}
      <div className="min-w-0">
        <div className="p-0 mb-0">
          <div className="flex items-start gap-3 mb-3">
            <ProfilePicture
              src={post.user?.profilePicture}
              alt="user profile"
              className="size-5"
              priority={false}
            />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm text-blue-800">
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
        </div>
      </div>

      {/* Description Column */}
      <div className="min-w-0">
        <p
          className="text-xs text-gray-700 mt-2 line-clamp-3"
          dangerouslySetInnerHTML={{
            __html: highlightAndTruncate(post.description, highlightText),
          }}
          onClick={onClick}
        />
      </div>

      {/* Actions Column */}
      <div className="flex gap-1">
        <div className="flex justify-between items-center mb-2">
          <div className="flex items-center gap-2 text-xs mr-10 text-gray-500">
            <span className={`capitalize px-2 py-1 rounded-[3px] font-medium ${categoryStyles[post.category] || "bg-gray-100 text-gray-700"}`}>
              {post.category}
            </span>
            <span className={`capitalize px-2 py-1 rounded-[3px] font-medium ${typeStyles[post.type] || "bg-gray-100 text-gray-700"}`}>
              {post.type}
            </span>
          </div>
        </div>

        <div className="flex gap-0.5 mt-1">
          {(post.status === "resolved" || post.status === "completed") &&
            onRevertResolution && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRevertResolution(post);
                }}
                className="px-1 py-0.5 text-[10px] bg-orange-500 text-white rounded hover:bg-orange-600 transition"
                title="Revert Resolution"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                </svg>
              </button>
            )}

          {onConfirmTurnover && post.turnoverDetails?.turnoverStatus === "declared" && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onConfirmTurnover(post, "confirmed");
                }}
                className="px-1 py-0.5 text-[10px] bg-green-500 text-white rounded hover:bg-green-600 transition"
                title="Confirm Received"
              >
                ✓ Confirm
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onConfirmTurnover(post, "not_received");
                }}
                className="px-1 py-0.5 text-[10px] bg-red-500 text-white rounded hover:bg-red-600 transition"
                title="Not Received"
              >
                ✗ Not
              </button>
            </>
          )}

          {onApprove && post.isFlagged && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onApprove(post);
              }}
              className="px-1 py-0.5 text-[10px] bg-green-500 text-white rounded hover:bg-green-600 transition"
              title="Approve"
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
              className="px-1 py-0.5 text-[10px] bg-orange-500 text-white rounded hover:bg-orange-600 transition"
              title="Hide"
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
              className="px-1 py-0.5 text-[10px] bg-green-500 text-white rounded hover:bg-green-600 transition"
              title="Unhide"
            >
              Unhide
            </button>
          )}

          {showCampusSecurityButtons && onConfirmCampusSecurityCollection &&
           post.turnoverDetails?.turnoverAction === "turnover to Campus Security" && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onConfirmCampusSecurityCollection(post, "collected");
                }}
                className="px-1 py-0.5 text-[10px] bg-green-500 text-white rounded hover:bg-green-600 transition"
                title="Collected"
              >
                ✓ Collected
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onConfirmCampusSecurityCollection(post, "not_available");
                }}
                className="px-1 py-0.5 text-[10px] bg-red-500 text-white rounded hover:bg-red-600 transition"
                title="Not Available"
              >
                ✗ Not Available
              </button>
            </>
          )}

          {(post.status === "unclaimed" || post.movedToUnclaimed) &&
            onActivateTicket && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onActivateTicket(post);
              }}
              className="px-1 py-0.5 text-[10px] bg-green-500 text-white rounded hover:bg-green-600 transition"
              title="Activate"
            >
              Activate
            </button>
          )}

          {!onPermanentDelete && !onRestore && !hideDeleteButton && (
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className={`px-1 py-0.5 text-[10px] rounded transition ${
                isDeleting
                  ? "bg-gray-400 cursor-not-allowed"
                  : "bg-red-500 hover:bg-red-600 text-white"
              }`}
              title={isDeleting ? "Deleting..." : "Delete"}
            >
              {isDeleting ? (
                <span className="flex items-center gap-1">
                  <svg className="animate-spin h-2 w-2" viewBox="0 0 24 24">
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

        {onRestore && onPermanentDelete && (
          <div className="flex gap-1 mt-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRestore(post);
              }}
              className="px-2 py-1 text-[10px] bg-green-500 text-white rounded hover:bg-green-600 transition"
              title="Restore"
            >
              Restore
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onPermanentDelete(post);
              }}
              className="px-1 py-0.5 text-[10px] bg-red-600 text-white rounded hover:bg-red-700 transition"
              title="Delete Permanently"
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

export default memo(AdminPostCardList);
