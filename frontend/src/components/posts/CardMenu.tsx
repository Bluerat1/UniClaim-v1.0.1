import { useState, useRef, useEffect } from "react";
import {
  IoEllipsisVertical,
  IoFlagOutline,
  IoChatbubbleOutline,
} from "react-icons/io5";
import { useNavigate } from "react-router-dom";
import FlagModal from "@/components/modals/Flag";
import { postService } from "@/services/firebase/posts";
import { messageService } from "@/services/firebase/messages";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";

interface PostCardMenuProps {
  postId: string;
  postTitle: string;
  postOwnerId: string;
  postOwnerUserData: any;
  isFlagged?: boolean;
  flaggedBy?: string;
  onFlagSuccess?: () => void;
  className?: string;
  onFlag?: (post: any) => void;
  postStatus?: string;
}

export default function PostCardMenu({
  postId,
  postTitle,
  postOwnerId,
  postOwnerUserData,
  isFlagged = false,
  flaggedBy,
  onFlagSuccess,
  className = "",
  onFlag,
  postStatus,
}: PostCardMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreatingConversation, setIsCreatingConversation] = useState(false);
  const [showFlagModal, setShowFlagModal] = useState(false);
  const { user, userData } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  // Get the user ID from the auth user object (not userData)
  const currentUserId = user?.uid;
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const handleMenuClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering the post card click
    e.preventDefault();
    setIsOpen(!isOpen);
  };

  const handleFlagClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!user) {
      showToast("error", "Please log in to flag posts");
      return;
    }
    setIsOpen(false);

    // Use the external flag handler if provided
    if (onFlag) {
      onFlag({
        id: postId,
        title: postTitle,
        creatorId: postOwnerId,
        user: postOwnerUserData,
      });
    } else {
      // Fallback to internal modal if no external handler
      setShowFlagModal(true);
    }
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
      showToast("error", error.message || "Failed to flag post");
    } finally {
      setIsLoading(false);
    }
  };

  // Generate a friendly greeting based on post type
  const generateGreeting = (postType: string, title: string) => {
    const greetings: Record<string, string> = {
      lost: `Hi! I found your ${title} and I think it matches the one you lost.`,
      found: `Hello! I believe I might be the owner of the ${title} you found.`,
    };
    return greetings[postType] || `Hi! I'm reaching out about your ${postType} item: ${title}`;
  };

  const handleSendMessage = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    // Validate user authentication and data
    if (!currentUserId) {
      showToast("error", "Please log in to send messages");
      return;
    }

    if (!userData) {
      console.error("User data is missing");
      showToast("error", "User information is not available. Please refresh the page and try again.");
      return;
    }

    // Validate post owner ID
    if (!postOwnerId) {
      console.error("Post owner ID is missing");
      showToast("error", "Cannot send message: Post owner information is missing");
      return;
    }

    // Check if user is trying to message themselves
    if (postOwnerId === currentUserId) {
      showToast("info", "You cannot send a message to yourself");
      return;
    }

    try {
      setIsCreatingConversation(true);
      setIsOpen(false);

      console.log("Starting conversation between:", {
        currentUser: currentUserId,
        postOwner: postOwnerId,
        postId,
      });

      // First, check if a conversation already exists for this post and users
      const existingConversationId = await messageService.findConversationByPostAndUsers(
        postId,
        currentUserId,
        postOwnerId
      );

      let conversationId = existingConversationId;
      console.log("Existing conversation ID:", conversationId);

      // If no existing conversation, create a new one and send greeting
      if (!conversationId) {
        console.log("Creating new conversation...");
        // Create the conversation
        conversationId = await messageService.createConversation(
          postId,
          postTitle,
          postOwnerId,
          currentUserId,
          userData,
          postOwnerUserData || {}
        );
        console.log("New conversation created with ID:", conversationId);

        // Send greeting message for new conversations
        try {
          const greeting = generateGreeting("found", postTitle);
          await messageService.sendMessage(
            conversationId,
            currentUserId,
            userData.displayName || "User",
            greeting,
            userData.profilePicture
          );
          console.log("Greeting message sent successfully");
        } catch (greetingError) {
          console.error("Failed to send greeting message:", greetingError);
          // Don't fail the whole operation if greeting fails
        }
      }

      // Navigate to messages page with the specific conversation
      navigate(`/messages?conversation=${conversationId}`, {
        replace: true, // Replace current entry in history stack
        state: { fromPost: true }, // Indicate we're coming from a post
      });
    } catch (error: any) {
      console.error("Error handling conversation:", error);
      showToast("error", error.message || "Failed to start conversation");
    } finally {
      setIsCreatingConversation(false);
    }
  };

  // Check if current user has already flagged this post
  const isAlreadyFlaggedByUser = isFlagged && flaggedBy === user?.uid;

  return (
    <>
      <div className={`relative z-10 ${className}`} ref={menuRef}>
        {/* Triple dot button */}
        <button
          onClick={handleMenuClick}
          className="p-1 mt-2 mr-2 bg-black/25 hover:bg-black/40 rounded-full cursor-pointer transition duration-300 relative z-[102]"
          title="More options"
        >
          <IoEllipsisVertical className="size-5 text-white" />
        </button>

        {/* Dropdown menu */}
        {isOpen && (
          <div className="absolute right-2 top-12 w-48 bg-white rounded-md shadow-lg border border-gray-200 z-[101]">
            <div className="py-1">
              {/* Send Message Button */}
              <button
                onClick={handleSendMessage}
                disabled={
                  isCreatingConversation || postOwnerId === userData?.uid || postStatus === "resolved"
                }
                className={`
                  w-full px-4 py-2 text-left text-sm flex items-center gap-2
                  transition-colors duration-200
                  ${
                    isCreatingConversation || postOwnerId === userData?.uid || postStatus === "resolved"
                      ? "text-gray-400 cursor-not-allowed"
                      : "text-gray-700 hover:bg-blue-50 hover:text-blue-700"
                  }
                `}
              >
                <IoChatbubbleOutline className="w-4 h-4" />
                {isCreatingConversation ? "Starting Chat..." : "Send Message"}
              </button>

              {/* Flag Post Button */}
              <button
                onClick={handleFlagClick}
                disabled={
                  isAlreadyFlaggedByUser ||
                  isLoading ||
                  postOwnerId === user?.uid ||
                  postStatus === "resolved"
                }
                className={`
                  w-full px-4 py-2 text-left text-sm flex items-center gap-2
                  transition-colors duration-200
                  ${
                    isAlreadyFlaggedByUser ||
                    isLoading ||
                    postOwnerId === user?.uid ||
                    postStatus === "resolved"
                      ? "text-gray-400 cursor-not-allowed"
                      : "text-gray-700 hover:bg-red-50 hover:text-red-700"
                  }
                `}
                title={
                  postOwnerId === user?.uid
                    ? "You cannot flag your own post"
                    : isAlreadyFlaggedByUser
                    ? "You've already flagged this post"
                    : postStatus === "resolved"
                    ? "Cannot flag resolved posts"
                    : "Flag this post"
                }
              >
                <IoFlagOutline className="w-4 h-4" />
                {isAlreadyFlaggedByUser
                  ? "Already Flagged"
                  : postOwnerId === user?.uid
                  ? "Can't Flag Own Post"
                  : postStatus === "resolved"
                  ? "Post Resolved"
                  : "Flag this post"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Flag Modal - only render if no external handler */}
      {!onFlag && showFlagModal && (
        <FlagModal
          onClose={() => setShowFlagModal(false)}
          onSubmit={handleFlagSubmit}
          isLoading={isLoading}
        />
      )}
    </>
  );
}
