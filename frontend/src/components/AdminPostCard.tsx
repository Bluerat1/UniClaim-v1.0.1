import { useEffect, useMemo, memo, useState } from "react";
import type { Post } from "@/types/Post";
import ProfilePicture from "./ProfilePicture";

interface AdminPostCardProps {
  post: Post;
  onClick: () => void;
  highlightText: string;
  onDelete?: (post: Post) => void;
  onEdit?: (post: Post) => void;
  onStatusChange?: (post: Post, status: string) => void;
  onActivateTicket?: (post: Post) => void;
  onRevertResolution?: (post: Post) => void;
  onConfirmTurnover?: (
    post: Post,
    status: "confirmed" | "not_received"
  ) => void;
  onConfirmCampusSecurityCollection?: (
    post: Post,
    status: "collected" | "not_available"
  ) => void;
  onHidePost?: (post: Post) => void;
  onUnhidePost?: (post: Post) => void;
  onRestore?: (post: Post) => void;
  onPermanentDelete?: (post: Post) => void;
  onApprove?: (post: Post) => void; // Added for flagged posts approve action
  hideDeleteButton?: boolean;
  isDeleting?: boolean;
  showUnclaimedMessage?: boolean;
  showCampusSecurityButtons?: boolean;
  isSelected?: boolean; // Added for selection styling
  onSelectionChange?: (post: Post, selected: boolean) => void; // Added for selection functionality
}

import { formatDateTime } from "@/utils/dateUtils";

// Format function for post creation time
const formatPostTime = (date: Date | string | { seconds: number; nanoseconds: number }) => {
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
  onEdit,
  onStatusChange,
  onActivateTicket,
  onRevertResolution,
  onHidePost,
  onUnhidePost,
  onRestore,
  onPermanentDelete,
  onApprove, // Added for flagged posts approve action
  hideDeleteButton = false,
  isDeleting = false,
  onConfirmTurnover,
  onConfirmCampusSecurityCollection,
  showUnclaimedMessage = true,
  showCampusSecurityButtons = false,
  isSelected = false, // Added for selection styling
  onSelectionChange, // Added for selection functionality
}: AdminPostCardProps) {
  const [isTurnoverMinimized, setIsTurnoverMinimized] = useState(true);
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
    onStatusChange?.(post, e.target.value);
  };

  return (
    <div
      className={`bg-white rounded shadow/2 cursor-pointer overflow-hidden hover:shadow-md/5 transition relative ${
        isSelected
          ? "border-brand ring-2 ring-brand/20 shadow-brand/10"
          : post.isFlagged
          ? "ring-2 ring-red-500 border-red-500"
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
            className="w-6 h-6 text-brand border-gray-300 rounded focus:ring-brand"
          />
        </div>
      )}

      {previewUrl ? (
        <img
          src={previewUrl}
          alt="post"
          className="w-full h-85 object-cover lg:h-70"
          onClick={onClick}
        />
      ) : (
        <div className="bg-gray-300 h-60 w-full" onClick={onClick} />
      )}

      {/* Red Flag Icon - Top Right */}
      {post.isFlagged && (
        <div className="absolute top-2 right-2 text-2xl drop-shadow-lg">🚩</div>
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
            {(post.status === "resolved" || post.status === "completed") && onRevertResolution && (
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

            {/* Edit button - only show for confirmed turnover items */}
            {post.turnoverDetails?.turnoverStatus === "confirmed" && onEdit && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(post);
                }}
                className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 transition"
                title="Edit Post - Modify title, description, or images"
              >
                Edit
              </button>
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
              size="xs"
              priority={false}
            />
            <div>
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
        </div>

        {/* Turnover Information for Admin */}
        {post.turnoverDetails && (
          <div
            className="bg-blue-50 p-2 rounded mb-3 border border-blue-200 cursor-pointer hover:bg-blue-100 transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              setIsTurnoverMinimized(!isTurnoverMinimized);
            }}
            title={isTurnoverMinimized ? "Click to expand turnover details" : "Click to minimize turnover details"}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-blue-600 text-sm">🔄</span>
                <h4 className="text-xs font-semibold text-blue-800">
                  Turnover Details
                </h4>
              </div>
              <span className="text-blue-600 text-xs">
                {isTurnoverMinimized ? "▼" : "▲"}
              </span>
            </div>
            {!isTurnoverMinimized && (
              <div className="text-xs text-blue-700 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">Original Finder:</span>
                  <ProfilePicture
                    src={post.turnoverDetails.originalFinder.profilePicture}
                    alt={`${post.turnoverDetails.originalFinder.firstName} ${post.turnoverDetails.originalFinder.lastName}`}
                    size="xs"
                    className="border-blue-300"
                  />
                  <span>
                    {post.turnoverDetails.originalFinder.firstName}{" "}
                    {post.turnoverDetails.originalFinder.lastName}
                  </span>
                </div>
                <p>
                  <span className="font-medium">Student ID:</span>{" "}
                  {post.turnoverDetails.originalFinder.studentId || "N/A"}
                </p>
                <p>
                  <span className="font-medium">Email:</span>{" "}
                  {post.turnoverDetails.originalFinder.email}
                </p>
                <p>
                  <span className="font-medium">Contact:</span>{" "}
                  {post.turnoverDetails.originalFinder.contactNum || "N/A"}
                </p>
                <p>
                  <span className="font-medium">Turned over to:</span>{" "}
                  {post.turnoverDetails.turnoverAction === "turnover to OSA"
                    ? "OSA"
                    : "Campus Security"}
                </p>
                <p>
                  <span className="font-medium">Status:</span>{" "}
                  <span
                    className={`px-2 py-1 rounded text-xs font-medium ${
                      post.turnoverDetails.turnoverStatus === "declared"
                        ? "bg-yellow-100 text-yellow-800"
                        : post.turnoverDetails.turnoverStatus === "confirmed"
                        ? "bg-green-100 text-green-800"
                        : post.turnoverDetails.turnoverStatus === "transferred"
                        ? "bg-blue-100 text-blue-800"
                        : "bg-red-100 text-red-800"
                    }`}
                  >
                    {post.turnoverDetails.turnoverStatus === "declared"
                      ? "Awaiting Confirmation"
                      : post.turnoverDetails.turnoverStatus === "confirmed"
                      ? "Confirmed Received"
                      : post.turnoverDetails.turnoverStatus === "transferred"
                      ? "Transferred"
                      : "Not Received"}
                  </span>
                </p>
                {post.turnoverDetails.confirmedAt && (
                  <p>
                    <span className="font-medium">Confirmed:</span>{" "}
                    {new Date(
                      post.turnoverDetails.confirmedAt.seconds * 1000
                    ).toLocaleDateString()}
                  </p>
                )}
                {post.turnoverDetails.confirmationNotes && (
                  <p>
                    <span className="font-medium">Notes:</span>{" "}
                    {post.turnoverDetails.confirmationNotes}
                  </p>
                )}
              </div>
            )}
            {isTurnoverMinimized && (
              <div className="text-xs text-blue-600 italic">
                Click to view turnover details
              </div>
            )}

            {/* Turnover Confirmation Buttons - Only for OSA items awaiting confirmation */}
            {!isTurnoverMinimized &&
              post.turnoverDetails.turnoverStatus === "declared" &&
              post.turnoverDetails.turnoverAction === "turnover to OSA" && (
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onConfirmTurnover?.(post, "confirmed");
                    }}
                    className="px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 transition-colors"
                  >
                    ✓ Confirm Received
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onConfirmTurnover?.(post, "not_received");
                    }}
                    className="px-3 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 transition-colors"
                  >
                    ✗ Not Received
                  </button>
                </div>
              )}

              {/* Campus Security Collection Buttons - Show only when explicitly enabled */}
              {!isTurnoverMinimized &&
                showCampusSecurityButtons &&
                post.turnoverDetails.turnoverAction === "turnover to Campus Security" && (
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onConfirmCampusSecurityCollection?.(post, "collected");
                      }}
                      className="px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 transition-colors"
                    >
                      ✓ Item Collected
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onConfirmCampusSecurityCollection?.(post, "not_available");
                      }}
                      className="px-3 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 transition-colors"
                    >
                      ✗ Not Available
                    </button>
                  </div>
                )}
          </div>
        )}
        {post.status === "pending" &&
          !(
            post.turnoverDetails &&
            post.turnoverDetails.turnoverStatus === "declared"
          ) && (
            <div className="mb-3">
              <label className="text-xs text-gray-600 block mb-1">
                Status:
              </label>
              <select
                value={post.status || "pending"}
                onChange={handleStatusChange}
                className="text-xs p-1 border rounded bg-white"
                onClick={(e) => e.stopPropagation()}
              >
                <option value="pending">Pending</option>
                <option value="unclaimed">Unclaimed</option>
                <option value="resolved">Resolved</option>
              </select>
            </div>
          )}

        {/* Show activation status for posts that can be activated */}
        {(post.status === "unclaimed" || post.movedToUnclaimed) && showUnclaimedMessage && (
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

        <div className="text-sm lg:text-xs flex gap-2">
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
    </div>
  );
}

export default memo(AdminPostCard);
