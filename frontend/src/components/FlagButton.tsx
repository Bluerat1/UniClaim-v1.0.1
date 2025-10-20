import { useState } from "react";
import { postService } from "@/services/firebase/posts";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import FlagModal from "./FlagModal";
import { IoFlagOutline } from "react-icons/io5";

interface FlagButtonProps {
  postId: string;
  isFlagged?: boolean;
  flaggedBy?: string;
  onFlagSuccess?: () => void;
  className?: string;
  postStatus?: string;
}

export default function FlagButton({
  postId,
  isFlagged = false,
  flaggedBy,
  onFlagSuccess,
  className = "",
  postStatus,
}: FlagButtonProps) {
  const [showFlagModal, setShowFlagModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useAuth();
  const { showToast } = useToast();

  const handleFlagClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering the post card click
    e.preventDefault(); // Prevent default button behavior
    if (!user) {
      alert("Please log in to flag posts");
      return;
    }
    setShowFlagModal(true);
  };

  const handleFlagSubmit = async (reason: string) => {
    if (!user) return;

    setIsLoading(true);
    try {
      await postService.flagPost(postId, user.uid, reason);
      setShowFlagModal(false);
      showToast("success", "Post has been flagged for review");
      onFlagSuccess?.();
    } catch (error: any) {
      alert(error.message || "Failed to flag post");
    } finally {
      setIsLoading(false);
    }
  };

  // Check if current user has already flagged this post
  const isAlreadyFlaggedByUser = isFlagged && flaggedBy === user?.uid;

  return (
    <>
      <button
        onClick={handleFlagClick}
        disabled={isAlreadyFlaggedByUser || isLoading || postStatus === "resolved"}
        className={`
          flex items-center justify-center p-2 rounded
          transition-colors duration-200
          ${
            isAlreadyFlaggedByUser || postStatus === "resolved"
              ? "bg-gray-100 text-gray-500 cursor-not-allowed"
              : "bg-red-500 text-white hover:bg-red-700"
          }
          ${className}
        `}
        title={
          isAlreadyFlaggedByUser
            ? "You have already flagged this post"
            : postStatus === "resolved"
            ? "Cannot flag resolved posts"
            : "Flag this post"
        }
      >
        {isLoading ? (
          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
        ) : (
          <IoFlagOutline className="size-5 stroke-[1px]" />
        )}
      </button>

      {showFlagModal && (
        <FlagModal
          onClose={() => setShowFlagModal(false)}
          onSubmit={handleFlagSubmit}
          isLoading={isLoading}
        />
      )}
    </>
  );
}
