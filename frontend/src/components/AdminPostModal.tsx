import { useEffect, useState, useRef } from "react";
import { FiX } from "react-icons/fi";
import type { Post } from "@/types/Post";
import { useNavigate } from "react-router-dom";
import ProfilePicture from "./ProfilePicture";
import HandoverDetailsDisplay from "./HandoverDetailsDisplay";
import ClaimDetailsDisplay from "./ClaimDetailsDisplay";
import { postService } from "@/services/firebase/posts";
import { useToast } from "@/context/ToastContext";

interface AdminPostModalProps {
  post: Post;
  onClose: () => void;
  onPostUpdate?: (updatedPost: Post) => void;
  onPostDelete?: (postId: string) => void;
}

function formatDateTime(datetime: string | Date) {
  const date = typeof datetime === "string" ? new Date(datetime) : datetime;
  return date.toLocaleString("en-PH", {
    dateStyle: "long",
    timeStyle: "short",
  });
}

export default function AdminPostModal({
  post,
  onClose,
  onPostUpdate,
  onPostDelete,
}: AdminPostModalProps) {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [showOverlay, setShowOverlay] = useState(true);
  const [hasUserInteracted, setHasUserInteracted] = useState(false);
  const [imageLoadingError, setImageLoadingError] = useState<string | null>(null);
  const inactivityIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastInteractionTimeRef = useRef<number>(Date.now());

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
    const checkInactivity = () => {
      const now = Date.now();
      const secondsSinceLastClick = (now - lastInteractionTimeRef.current) / 1000;
      if (secondsSinceLastClick >= 2) {
        setShowOverlay(true);
      }
    };

    inactivityIntervalRef.current = setInterval(checkInactivity, 1000);
    return () => {
      if (inactivityIntervalRef.current) {
        clearInterval(inactivityIntervalRef.current);
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setImageLoadingError(null);
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

  const handleImageClick = () => {
    setShowOverlay(false);
    setHasUserInteracted(true);
    lastInteractionTimeRef.current = Date.now();
    setCurrentIndex((prev) => (prev + 1) % imageUrls.length);
  };

  const handleDeletePost = async () => {
    if (!window.confirm('Are you sure you want to delete this post? This action cannot be undone.')) {
      return;
    }

    try {
      setIsDeleting(true);
      await postService.deletePost(post.id);
      showToast('success', 'Post deleted', 'The post has been successfully deleted.');
      onPostDelete?.(post.id);
      onClose();
    } catch (error) {
      console.error('Error deleting post:', error);
      showToast('error', 'Error', 'Failed to delete the post. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleToggleStatus = async () => {
    try {
      setIsUpdatingStatus(true);
      const newStatus = post.status === 'resolved' ? 'pending' : 'resolved';
      await postService.updatePostStatus(post.id, newStatus);
      showToast('success', 'Status Updated', `Post has been marked as ${newStatus}.`);
      onPostUpdate?.({ ...post, status: newStatus });
    } catch (error) {
      console.error('Error updating post status:', error);
      showToast('error', 'Error', 'Failed to update post status. Please try again.');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleViewUser = () => {
    if (post.creatorId) {
      navigate(`/admin/users/${post.creatorId}`);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white rounded p-4 shadow w-[25rem] sm:w-[26rem] md:w-[32rem] lg:w-[42rem] xl:w-[60rem] max-w-full max-h-[90vh] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ProfilePicture
              src={post.user?.profilePicture}
              alt="user profile"
              size="md"
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
              <p className="text-xs text-gray-500">
                {post.creatorId || 'Unknown User ID'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
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
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={handleToggleStatus}
            disabled={isUpdatingStatus}
            className={`px-3 py-1 text-sm rounded flex items-center gap-1 ${
              post.status === 'resolved' 
                ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200' 
                : 'bg-green-100 text-green-800 hover:bg-green-200'
            }`}
          >
            {isUpdatingStatus ? (
              <span className="animate-spin">⟳</span>
            ) : post.status === 'resolved' ? (
              'Mark as Pending'
            ) : (
              'Mark as Resolved'
            )}
          </button>
          
          <button
            onClick={handleDeletePost}
            disabled={isDeleting}
            className="px-3 py-1 text-sm bg-red-100 text-red-800 rounded hover:bg-red-200 flex items-center gap-1"
          >
            {isDeleting ? 'Deleting...' : 'Delete Post'}
          </button>

          {post.isFlagged && (
            <span className="px-3 py-1 text-sm bg-red-100 text-red-800 rounded flex items-center gap-1">
              ⚠️ Flagged
            </span>
          )}
        </div>

        {imageUrls.length > 0 && (
          <div className="mt-4 flex items-center justify-center">
            <div className="relative group w-full max-w-md">
              <img
                src={imageUrls[currentIndex]}
                alt={`Uploaded ${currentIndex + 1}`}
                className="w-full h-auto object-cover rounded cursor-pointer"
                onClick={handleImageClick}
                title="Click to view next image"
              />

              {showOverlay && imageUrls.length > 1 && !hasUserInteracted && (
                <div
                  className="absolute inset-0 flex items-center justify-center bg-black/45 text-white font-semibold text-sm rounded cursor-pointer animate-soft-blink"
                  onClick={handleImageClick}
                >
                  Click to view more images
                </div>
              )}

              <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded-full">
                {currentIndex + 1}/{imageUrls.length}
              </div>
            </div>
          </div>
        )}

        {imageLoadingError && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-md">
            <div className="flex items-center justify-between">
              <span className="text-red-600 text-sm">⚠️ {imageLoadingError}</span>
              <button
                onClick={() => {
                  setImageLoadingError(null);
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
                post.status === 'resolved' 
                  ? 'bg-green-100 text-green-700' 
                  : post.status === 'unclaimed'
                  ? 'bg-orange-100 text-orange-700'
                  : 'bg-gray-100 text-gray-700'
              }`}
            >
              {post.status?.toUpperCase() || 'PENDING'}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 lg:gap-5 lg:grid-cols-2">
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
            <div className="bg-gray-50 border border-gray-400 rounded py-2 px-2 h-52 overflow-y-auto">
              <p className="text-[13px] text-gray-600">{post.description}</p>
            </div>

            {post.type === "found" && post.foundAction && (
              <>
                <p className="text-[13px] mt-3 mb-2">Found Item Action</p>
                <div className="bg-blue-50 border border-blue-200 rounded py-2 px-2">
                  <p className="text-[13px] text-blue-700 font-medium">
                    {post.foundAction === "keep"
                      ? "The finder will keep this item and return it themselves"
                      : post.foundAction === "turnover to OSA"
                      ? "This item will be turned over to the OSA office"
                      : "This item will be turned over to Campus Security"}
                  </p>
                </div>
              </>
            )}

            {post.coordinates && (
              <>
                <p className="text-[13px] mt-3 mb-2">Pinned Coordinates</p>
                <div className="bg-gray-50 border border-gray-400 rounded py-2 px-2">
                  <p className="text-[13px] text-gray-600">
                    {post.coordinates.lat.toFixed(5)}, {post.coordinates.lng.toFixed(5)}
                  </p>
                </div>
              </>
            )}
          </div>
          
          <div>
            <p className="text-[13px] mt-2">Last seen location</p>
            <div className="bg-gray-50 border border-gray-400 rounded py-2 px-2 mb-3">
              <p className="text-sm text-gray-700">{post.location}</p>
            </div>
            
            {post.coordinates && (
              <div className="w-full h-64">
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
          </div>
        </div>

        {post.status === "resolved" && post.claimDetails && (
          <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-md">
            <h3 className="font-semibold text-green-800 mb-2">Claim Details</h3>
            <ClaimDetailsDisplay claimDetails={post.claimDetails} />
          </div>
        )}

        {post.handoverDetails && (
          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-md">
            <h3 className="font-semibold text-blue-800 mb-2">Handover Details</h3>
            <HandoverDetailsDisplay handoverDetails={post.handoverDetails} />
          </div>
        )}

        {/* Admin Notes Section */}
        <div className="mt-4 p-4 bg-gray-50 border border-gray-200 rounded-md">
          <h3 className="font-semibold text-gray-800 mb-2">Admin Notes</h3>
          <p className="text-sm text-gray-600">
            {post.description || 'No admin notes available.'}
          </p>
        </div>
      </div>
    </div>
  );
}
