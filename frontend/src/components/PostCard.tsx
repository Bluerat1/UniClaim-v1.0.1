import { useEffect, useMemo, memo } from "react";
import type { Post } from "@/types/Post";
import ProfilePicture from "./ProfilePicture";
import PostCardMenu from "./PostCardMenu";
import { useAdminStatus } from "@/hooks/useAdminStatus";
import { usePostCreatorData } from "@/hooks/usePostCreatorData";

interface PostCardProps {
  post: Post;
  onClick: () => void;
  highlightText: string;
  adminStatuses?: Map<string, boolean>;
  onFlag?: (post: Post) => void;
}

function formatDateTime(datetime: string | Date) {
  const date = typeof datetime === "string" ? new Date(datetime) : datetime;
  return date.toLocaleString("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

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

function PostCard({
  post,
  onClick,
  highlightText,
  adminStatuses,
  onFlag,
}: PostCardProps) {
  // Fallback to individual admin status fetch if not provided
  const fallbackAdminStatuses = useAdminStatus(adminStatuses ? [] : [post]);
  const effectiveAdminStatuses = adminStatuses || fallbackAdminStatuses;

  // Get real-time creator data for the current user's posts
  const creatorData = usePostCreatorData(post);

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

  return (
    <div
      className="bg-white rounded shadow/2 cursor-pointer overflow-hidden hover:shadow-md/5 transition relative"
      onClick={onClick}
    >
      {/* Triple dot menu */}
      <div className="absolute top-2 right-2 z-10">
        <PostCardMenu
          postId={post.id}
          postTitle={post.title}
          postOwnerId={post.creatorId || post.postedById || ""}
          postOwnerUserData={creatorData}
          isFlagged={post.isFlagged}
          flaggedBy={post.flaggedBy}
          onFlagSuccess={() => {
            // Optionally refresh the post data or update UI
            console.log("Post flagged successfully");
          }}
          onFlag={onFlag}
        />
      </div>

      {previewUrl ? (
        <img
          src={previewUrl}
          alt="post"
          className="w-full h-85 object-cover lg:h-70"
        />
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

              {/* Expiry Countdown Badge */}
              {post.expiryDate && (
                <>
                  {(() => {
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
                        return (
                          <span className="capitalize px-2 py-1 rounded-[3px] font-medium bg-red-100 text-red-700">
                            ⚠️ EXPIRED
                          </span>
                        );
                      } else if (daysLeft <= 3) {
                        return (
                          <span className="capitalize px-2 py-1 rounded-[3px] font-medium bg-red-100 text-red-700">
                            ⚠️ {daysLeft} day{daysLeft !== 1 ? "s" : ""} left
                          </span>
                        );
                      } else if (daysLeft <= 7) {
                        return (
                          <span className="capitalize px-2 py-1 rounded-[3px] font-medium bg-orange-100 text-orange-700">
                            ⚠️ {daysLeft} day{daysLeft !== 1 ? "s" : ""} left
                          </span>
                        );
                      } else {
                        return (
                          <span className="capitalize px-2 py-1 rounded-[3px] font-medium bg-green-100 text-green-700">
                            {daysLeft} day{daysLeft !== 1 ? "s" : ""} left
                          </span>
                        );
                      }
                    } catch (error) {
                      console.error("Error calculating days left:", error);
                      return null;
                    }
                  })()}
                </>
              )}

              {/* Status Badge */}
              {(post.status === "resolved" || post.status === "completed") && (
                <span className="capitalize px-2 py-1 rounded-[3px] font-medium bg-green-100 text-green-700 text-[11px]">
                  ✅ RESOLVED
                </span>
              )}
              {post.status === "unclaimed" && (
                <span className="capitalize px-2 py-1 rounded-[3px] font-medium bg-orange-100 text-orange-700 text-[11px]">
                  ⏰ UNCLAIMED
                </span>
              )}
            </div>
          </div>
        </div>

        <h1 className="text-lg font-semibold my-2 truncate max-w-[12rem]">
          {post.title}
        </h1>

        {/* Display the user who created the post */}
        <div className="flex items-center gap-2 mb-2">
          <ProfilePicture
            src={creatorData?.profilePicture}
            alt="user profile"
            className="size-5"
            priority={false} // Don't prioritize profile pictures
          />
          <div className="flex items-center gap-2">
            <p className="text-xs text-blue-800 font-medium">
              Posted by{" "}
              {creatorData?.firstName && creatorData?.lastName
                ? `${creatorData.firstName} ${creatorData.lastName}`
                : creatorData?.email
                ? creatorData.email.split("@")[0]
                : "Unknown User"}
            </p>
            {/* Admin Badge */}
            {(creatorData?.role === "admin" ||
              (creatorData?.email &&
                effectiveAdminStatuses.get(creatorData.email))) && (
              <span className="bg-amber-500 text-white text-xs px-2 py-1 rounded-full font-semibold">
                ADMIN
              </span>
            )}
          </div>
        </div>

        <div className="text-xs lg:text-xs flex flex-col gap-2">
          {post.location && (
            <p className="font-medium text-black">
              <span className="font-medium">Last seen at </span>
              {post.location}
            </p>
          )}
          {post.createdAt && (
            <p className="text-gray-500 font-inter">
              {formatDateTime(post.createdAt)}
            </p>
          )}
        </div>

        <p
          className="text-xs text-gray-700 mt-2.5"
          dangerouslySetInnerHTML={{
            __html: highlightAndTruncate(post.description, highlightText),
          }}
        />

        {/* Claim Information - only show for resolved posts with claim details, and only if claim is not yet confirmed */}
        {post.status === "resolved" &&
          post.claimDetails &&
          (creatorData?.role === "admin" ||
            (creatorData?.email &&
              effectiveAdminStatuses.get(creatorData.email))) &&
          post.claimDetails.claimRequestDetails &&
          !post.claimDetails.claimConfirmedAt && (
            <div className="mt-3 p-3 bg-purple-50 border border-purple-200 rounded-lg">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-purple-600 text-lg">💬</span>
                  <h4 className="text-sm font-semibold text-purple-800">
                    Claim Request Details (Admin Only)
                  </h4>
                </div>

                {/* Show claim reason if available */}
                {post.claimDetails.claimRequestDetails.claimReason && (
                  <div className="text-purple-700 mb-2">
                    <span className="font-medium">Reason: </span>
                    <span className="italic">
                      "{post.claimDetails.claimRequestDetails.claimReason}"
                    </span>
                  </div>
                )}

                {/* Show verification status */}
                <div className="flex items-center gap-4 text-xs text-purple-600 mt-3">
                  <span>
                    Claimer ID:{" "}
                    {post.claimDetails.claimRequestDetails.idPhotoConfirmed
                      ? "✅"
                      : "⏳"}
                  </span>
                  {post.claimDetails.claimRequestDetails.evidencePhotos && (
                    <span>
                      Evidence Photos:{" "}
                      {post.claimDetails.claimRequestDetails
                        .evidencePhotosConfirmed
                        ? "✅"
                        : "⏳"}
                    </span>
                  )}
                  {post.claimDetails.claimRequestDetails.ownerIdPhoto && (
                    <span>
                      Owner ID:{" "}
                      {post.claimDetails.claimRequestDetails
                        .ownerIdPhotoConfirmed
                        ? "✅"
                        : "⏳"}
                    </span>
                  )}
                </div>

                {/* Conversation Summary */}
                {post.conversationData && (
                  <div className="mt-3 pt-2 border-t border-purple-200">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-purple-600">💬</span>
                      <span className="text-xs font-medium text-purple-700">
                        Conversation Summary
                      </span>
                    </div>
                    <div className="text-xs text-purple-600">
                      {post.conversationData.messages?.length || 0} messages
                      exchanged
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

        {/* Handover Information - only show for resolved posts with handover details (if no claim details) and only to admin users */}
        {post.status === "resolved" &&
          post.handoverDetails &&
          post.handoverDetails.handoverRequestDetails &&
          !post.claimDetails &&
          (creatorData?.role === "admin" ||
            (creatorData?.email &&
              effectiveAdminStatuses.get(creatorData.email))) && (
            <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
              {/* Show handover request details summary if available */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-green-600 text-lg">💬</span>
                  <h4 className="text-sm font-semibold text-green-800">
                    Handover Request Details
                  </h4>
                </div>

                {/* Show handover reason if available */}
                {post.handoverDetails.handoverRequestDetails.handoverReason && (
                  <div className="text-green-700 mb-2">
                    <span className="font-medium">Reason: </span>
                    <span className="italic">
                      "
                      {
                        post.handoverDetails.handoverRequestDetails
                          .handoverReason
                      }
                      "
                    </span>
                  </div>
                )}

                {/* Show verification status */}
                <div className="flex items-center gap-4 text-xs text-green-600">
                  <span>
                    ID Photo:{" "}
                    {post.handoverDetails.handoverRequestDetails
                      .idPhotoConfirmed
                      ? "✅"
                      : "⏳"}
                  </span>
                  {post.handoverDetails.handoverRequestDetails.itemPhotos && (
                    <span>
                      Item Photos:{" "}
                      {post.handoverDetails.handoverRequestDetails
                        .itemPhotosConfirmed
                        ? "✅"
                        : "⏳"}
                    </span>
                  )}
                  {post.handoverDetails.handoverRequestDetails.ownerIdPhoto && (
                    <span>
                      Owner ID:{" "}
                      {post.handoverDetails.handoverRequestDetails
                        .ownerIdPhotoConfirmed
                        ? "✅"
                        : "⏳"}
                    </span>
                  )}
                </div>
              </div>

              {/* Conversation Summary */}
              {post.conversationData && (
                <div className="mt-3 pt-2 border-t border-green-200">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-green-600">💬</span>
                    <span className="text-xs font-medium text-green-700">
                      Conversation Summary
                    </span>
                  </div>
                  <div className="text-xs text-green-600">
                    {post.conversationData.messages?.length || 0} messages
                    exchanged
                  </div>
                </div>
              )}
            </div>
          )}
      </div>
    </div>
  );
}

export default memo(PostCard); // ✅ React.memo to prevent re-render unless props change
