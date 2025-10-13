import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { useMessage } from "../context/MessageContext";
import type { Conversation, Message } from "@/types/Post";
import MessageBubble from "./MessageBubble";
import LoadingSpinner from "./LoadingSpinner";
import { useAuth } from "../context/AuthContext";
import ProfilePicture from "./ProfilePicture";
import { messageService } from "../utils/firebase";
import ClaimVerificationModal from "./ClaimVerificationModal";
import HandoverVerificationModal from "./HandoverVerificationModal";
import { cloudinaryService } from "../utils/cloudinary";
import { useNavigate } from "react-router-dom";
import NoChat from "../assets/no_chat.png";
import { InformationCircleIcon } from "@heroicons/react/24/outline";

interface ChatWindowProps {
  conversation: Conversation | null;
  onClearConversation?: () => void; // New prop to clear selected conversation
  onRefreshConversation?: () => Promise<void>; // New prop to refresh conversation data
}

const ChatWindow: React.FC<ChatWindowProps> = ({
  conversation,
  onClearConversation,
  onRefreshConversation,
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [isClaimSubmitting, setIsClaimSubmitting] = useState(false);
  const [showHandoverModal, setShowHandoverModal] = useState(false);
  const [isHandoverSubmitting, setIsHandoverSubmitting] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [infoPage, setInfoPage] = useState(1);
  const [forceRerender, setForceRerender] = useState(0); // Force re-render of MessageBubble components

  const infoPages = [
    {
      title: "Conversation Information",
      content: (
        <div className="space-y-4">
          <div className="border border-gray-300 rounded-md p-2.5">
            <p className="text-sm font-medium text-gray-500">Post Title</p>
            <p className="text-gray-900">{conversation?.postTitle}</p>
          </div>
          <div className="border border-gray-300 rounded-md p-2.5">
            <p className="text-sm font-medium text-gray-500">Post Type</p>
            <p className="capitalize">{conversation?.postType}</p>
          </div>
          <div className="border border-gray-300 rounded-md p-2.5">
            <p className="text-sm font-medium text-gray-500">Status</p>
            <p className="capitalize">{conversation?.postStatus || "Active"}</p>
          </div>
          <div className="border border-gray-300 rounded-md p-2.5">
            <p className="text-sm font-medium text-gray-500">Created</p>
            <p>
              {conversation?.createdAt
                ? (() => {
                    try {
                      const date =
                        conversation.createdAt instanceof Date
                          ? conversation.createdAt
                          : conversation.createdAt.toDate
                          ? conversation.createdAt.toDate()
                          : new Date(conversation.createdAt);
                      return date.toLocaleString();
                    } catch (error) {
                      console.error("Error formatting created date:", error);
                      return "Invalid Date";
                    }
                  })()
                : "N/A"}
            </p>
          </div>
        </div>
      ),
    },
    {
      title: "Message Limit",
      content: (
        <div className="space-y-4">
          <div className="border border-gray-300 rounded-md p-3">
            <p className="text-sm text-black">
              To ensure fair usage for all users, conversations are limited to
              the 50 most recent messages. This helps us maintain system
              performance while keeping the service free for everyone.
            </p>
          </div>
          <div className="mt-4">
            <p className="bg-blue-50 text-blue-700 text-sm p-3 rounded-md">
              <span className="font-bold">Tip:</span> For important information,
              consider exchanging contact details or moving to a different
              platform once you've established contact.
            </p>
          </div>
        </div>
      ),
    },
    {
      title: "Chat Tips",
      content: (
        <div className="space-y-4">
          <div className="space-y-2 border border-gray-300 rounded-md p-3">
            <p className="font-semibold text-sm text-gray-900">
              Best Practices:
            </p>
            <ul className="list-disc pl-5 space-y-1 text-sm text-gray-700">
              <li>Be clear and specific about the item details</li>
              <li>Share only necessary personal information</li>
              <li>Arrange safe, public meetings for handovers</li>
              <li>Report any suspicious activity</li>
            </ul>
          </div>
        </div>
      ),
    },
  ];

  const handleNextPage = () => {
    if (infoPage < infoPages.length) {
      setInfoPage((prev) => prev + 1);
    } else {
      setInfoPage(1);
    }
  };

  const handlePrevPage = () => {
    if (infoPage > 1) {
      setInfoPage((prev) => prev - 1);
    } else {
      setInfoPage(infoPages.length);
    }
  };

  const resetInfoModal = () => {
    setInfoPage(1);
    setShowInfoModal(false);
  };

  // New engagement tracking state variables
  const [isUserTyping, setIsUserTyping] = useState(false);
  const [isNearBottom, setIsNearBottom] = useState(true);

  const navigate = useNavigate();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const {
    sendMessage,
    getConversationMessages,
    markConversationAsRead,
    markMessageAsRead,
    markAllUnreadMessagesAsRead, // Add the new function
    sendClaimRequest,
    conversations,
  } = useMessage();
  const { userData } = useAuth();

  // Auto-adjust textarea height based on content
  const adjustTextareaHeight = useCallback(() => {
    if (textareaRef.current) {
      // Reset height to get the correct scrollHeight
      textareaRef.current.style.height = "auto";
      // Set the height to scrollHeight, but limit to 8 rows max
      const maxHeight = 200; // ~8 lines of text (25px per line * 8)
      const newHeight = Math.min(textareaRef.current.scrollHeight, maxHeight);
      textareaRef.current.style.height = `${newHeight}px`;
    }
  }, []);

  // Auto-scroll to bottom when new messages arrive (no animation for instant scroll to bottom on conversation open)
  const scrollToBottom = () => {
    if (messagesContainerRef.current) {
      // Direct scroll to bottom - most reliable method
      messagesContainerRef.current.scrollTop =
        messagesContainerRef.current.scrollHeight;
    } else if (messagesEndRef.current) {
      // Fallback method using scrollIntoView with block: "end"
      messagesEndRef.current.scrollIntoView({ behavior: "auto", block: "end" });
    }
  };

  // Scroll to bottom with animation (for button click)
  const scrollToBottomWithAnimation = () => {
    if (messagesContainerRef.current) {
      // For smooth animation, we need to use scrollIntoView
      messagesContainerRef.current.scrollTo({
        top: messagesContainerRef.current.scrollHeight,
        behavior: "smooth",
      });
    } else if (messagesEndRef.current) {
      // Fallback method
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  };

  // Handle scroll events to show/hide scroll to bottom button and track engagement
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement;
    const scrollTop = target.scrollTop;
    const scrollHeight = target.scrollHeight;
    const clientHeight = target.clientHeight;

    // Check if user is near bottom (within 200px)
    const isNearBottomNow = scrollTop >= scrollHeight - clientHeight - 200;
    setIsNearBottom(isNearBottomNow);

    // Show/hide scroll to bottom button
    const isScrolledUp = scrollTop < scrollHeight - clientHeight - 100;
    setShowScrollToBottom(isScrolledUp);
  };

  // Scroll to bottom when messages change (for new messages)
  useEffect(() => {
    if (messages.length > 0) {
    }
  }, [messages]);

  // Note: 2-second timer logic removed as requested

  // Adjust textarea height when newMessage changes
  useEffect(() => {
    adjustTextareaHeight();
  }, [newMessage, adjustTextareaHeight]);

  // Update messages when conversation changes
  useEffect(() => {
    if (!conversation) {
      setMessages([]);
      return;
    }

    setIsLoading(true);
    const unsubscribe = getConversationMessages(
      conversation.id,
      (loadedMessages) => {
        // Check if these are new messages (not just initial load)
        const previousMessageCount = messages.length;
        const hasNewMessages = loadedMessages.length > previousMessageCount;

        setMessages(loadedMessages);
        setIsLoading(false);

        // Mark conversation as read when messages are loaded
        if (
          userData &&
          conversation?.unreadCounts?.[userData.uid] > 0 &&
          conversation?.id
        ) {
          markConversationAsRead(conversation.id);
        }

        // Mark all unread messages as read when conversation is opened and messages are loaded
        if (
          userData &&
          conversation?.unreadCounts?.[userData.uid] > 0 &&
          conversation?.id
        ) {
          markAllUnreadMessagesAsRead(conversation.id);
        }

        // Auto-read new messages if user is engaged
        if (hasNewMessages && previousMessageCount > 0) {
          const newMessages = loadedMessages.slice(previousMessageCount);
          // Only auto-read if there are actually new messages and user is engaged
          if (newMessages.length > 0) {
            autoReadNewMessages(newMessages);
          }
        }

        // Scroll to bottom when conversation is opened and messages are loaded
        // Use multiple requestAnimationFrame calls for more reliable scrolling
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            scrollToBottom();
          });
        });
      }
    );

    return () => unsubscribe();
  }, [
    conversation,
    getConversationMessages,
    markConversationAsRead,
    userData,
    markAllUnreadMessagesAsRead,
  ]);

  // Function to check if new messages should be auto-read based on user engagement
  const shouldAutoReadMessage = (): boolean => {
    // Auto-read if user is typing
    if (isUserTyping) return true;

    // Auto-read if user is near bottom (within 200px)
    if (isNearBottom) return true;

    return false;
  };

  // Mark conversation as read when new messages arrive while user is viewing
  useEffect(() => {
    if (!conversation?.id || !userData?.uid || !messages.length) return;

    // Check if there are unread messages in this conversation
    if (conversation?.unreadCounts?.[userData.uid] > 0) {
      // Check if user is engaged enough to auto-read new messages
      if (shouldAutoReadMessage()) {
        // User is engaged - mark conversation as read
        markConversationAsRead(conversation.id);

        // Also mark all unread messages as read for better UX
        markAllUnreadMessagesAsRead(conversation.id);
      }
      // If user is not engaged, don't mark as read - let them do it manually
    }
  }, [
    messages,
    conversation,
    userData,
    markConversationAsRead,
    markAllUnreadMessagesAsRead,
    shouldAutoReadMessage,
  ]);

  // Check if conversation still exists (wasn't deleted)
  useEffect(() => {
    if (!conversation) return;

    // Immediate check using local conversations state
    const conversationStillExists = conversations.some(
      (conv) => conv.id === conversation.id
    );
    if (!conversationStillExists) {
      navigate("/messages"); // Redirect to messages page
      return;
    }
  }, [conversation, conversations, navigate]);

  // Function to auto-read new messages based on user engagement
  const autoReadNewMessages = async (newMessages: Message[]) => {
    if (!conversation?.id || !userData?.uid || !shouldAutoReadMessage()) {
      return; // Don't auto-read if user is not engaged
    }

    try {
      // Mark conversation as read
      await markConversationAsRead(conversation.id);

      // Mark all new messages as read
      for (const message of newMessages) {
        // Only mark messages that haven't been read by this user
        if (!message.readBy?.includes(userData.uid)) {
          await markMessageAsRead(conversation.id, message.id);
        }
      }

      console.log(
        `✅ Auto-read ${newMessages.length} new messages due to user engagement`
      );
    } catch (error) {
      console.warn("Failed to auto-read new messages:", error);
    }
  };

  // Function to mark message as read when it comes into view
  const handleMessageSeen = async (messageId: string) => {
    if (!conversation?.id || !userData?.uid) return;

    try {
      // Mark the individual message as read
      await markMessageAsRead(conversation.id, messageId);

      // Also mark the conversation as read if it has unread messages
      if (conversation?.unreadCounts?.[userData.uid] > 0) {
        await markConversationAsRead(conversation.id);
      }
    } catch (error) {
      console.warn("Failed to mark message/conversation as read:", error);
    }
  };

  // Additional check for conversation existence in database (less frequent)
  useEffect(() => {
    if (!conversation) return;

    const checkConversationExists = async () => {
      try {
        // Try to access the conversation to see if it still exists
        const { doc, getDoc } = await import("firebase/firestore");
        const { db } = await import("../utils/firebase");

        const conversationRef = doc(db, "conversations", conversation.id);
        const conversationSnap = await getDoc(conversationRef);

        // If conversation doesn't exist, it was deleted
        if (!conversationSnap.exists()) {
          navigate("/messages"); // Redirect to messages page
        }
      } catch (error: any) {
        // If we get a permission error, the conversation was likely deleted
        if (
          error.message?.includes("permission") ||
          error.message?.includes("not-found")
        ) {
          navigate("/messages"); // Redirect to messages page
        }
      }
    };

    // Check every 10 seconds if the conversation still exists (reduced frequency)
    const interval = setInterval(checkConversationExists, 10000);

    return () => clearInterval(interval);
  }, [conversation, navigate]);

  // Update existing conversations with missing post data
  useEffect(() => {
    if (!conversation || !userData) return;

    // Check if conversation has the new fields, if not, update it
    if (
      !conversation.postType ||
      !conversation.postStatus ||
      !conversation.postCreatorId
    ) {
      messageService
        .updateConversationPostData(conversation.id)
        .catch((error) => {
          console.error("Failed to update conversation post data:", error);
        });
    }
  }, [conversation, userData]);

  const handleSendMessage = async (e: React.FormEvent) => {
    // Reset textarea height when sending a message
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
    e.preventDefault();

    if (!conversation || !userData || !newMessage.trim()) return;

    setIsSending(true);
    try {
      await sendMessage(
        conversation.id,
        userData.uid,
        `${userData.firstName} ${userData.lastName}`,
        newMessage.trim(),
        userData.profilePicture || userData.profileImageUrl
      );
      setNewMessage("");
    } catch (error) {
      console.error("Failed to send message:", error);
      // You could add a toast notification here
    } finally {
      setIsSending(false);
    }
  };

  const handleHandoverResponse = (
    messageId: string,
    status: "accepted" | "rejected"
  ) => {
    console.log("🔄 ChatWindow: handleHandoverResponse called", {
      messageId,
      status,
    });

    // Update the local messages state to reflect the new handover response
    setMessages((prevMessages) =>
      prevMessages.map((msg) => {
        if (msg.id === messageId && msg.handoverData) {
          console.log("📝 ChatWindow: Updating message handover data", msg.id);

          return {
            ...msg,
            handoverData: {
              ...msg.handoverData,
              status: status === "accepted" ? "pending_confirmation" : status,
              respondedAt: new Date(),
              respondedBy: userData?.uid || "",
            } as any, // Type assertion to handle optional properties
          };
        }
        return msg;
      })
    );

    // Refresh message data from Firebase after upload to get complete updated data with ownerIdPhoto
    if (status === "accepted") {
      setTimeout(() => {
        console.log(
          "🔄 ChatWindow: Refreshing message data from Firebase after upload"
        );
        if (conversation?.id) {
          getConversationMessages(conversation.id, (updatedMessages) => {
            console.log(
              "✅ ChatWindow: Refreshed messages from Firebase",
              updatedMessages.length
            );

            // Force re-render of MessageBubble components by updating a key or state
            setMessages(updatedMessages);

            // Additional force re-render by updating a dummy state
            setForceRerender((prev) => prev + 1);
          });
        }
      }, 1000); // Longer delay to allow Firebase to fully update
    }
  };

  const handleClaimResponse = (
    messageId: string,
    status: "accepted" | "rejected"
  ) => {
    console.log("🔄 ChatWindow: handleClaimResponse called", {
      messageId,
      status,
    });

    // Update the local messages state to reflect the new claim response
    setMessages((prevMessages) =>
      prevMessages.map((msg) => {
        if (msg.id === messageId && msg.claimData) {
          console.log("📝 ChatWindow: Updating message claim data", msg.id);

          return {
            ...msg,
            claimData: {
              ...msg.claimData,
              status: status === "accepted" ? "pending_confirmation" : status,
              respondedAt: new Date(),
              respondedBy: userData?.uid || "",
            } as any, // Type assertion to handle optional properties
          };
        }
        return msg;
      })
    );

    // Refresh message data from Firebase after upload to get complete updated data
    if (status === "accepted") {
      setTimeout(() => {
        console.log(
          "🔄 ChatWindow: Refreshing message data from Firebase after claim upload"
        );
        if (conversation?.id) {
          getConversationMessages(conversation.id, (updatedMessages) => {
            console.log(
              "✅ ChatWindow: Refreshed messages from Firebase",
              updatedMessages.length
            );

            // Force re-render of MessageBubble components by updating a key or state
            setMessages(updatedMessages);

            // Additional force re-render by updating a dummy state
            setForceRerender((prev) => prev + 1);
          });
        }
      }, 1000); // Longer delay to allow Firebase to fully update
    }
  };

  const handleOpenHandoverModal = () => {
    setShowHandoverModal(true);
  };

  const handleCloseHandoverModal = () => {
    setShowHandoverModal(false);
  };

  const handleSubmitHandover = async (
    handoverReason: string,
    idPhotoFile: File | null,
    itemPhotoFiles: File[]
  ) => {
    console.log("🔄 ChatWindow: handleSubmitHandover called", {
      handoverReason,
      hasIdPhoto: !!idPhotoFile,
      itemPhotoCount: itemPhotoFiles.length,
      conversationId: conversation?.id,
      postTitle: conversation?.postTitle,
    });

    if (
      !conversation ||
      !userData ||
      !idPhotoFile ||
      itemPhotoFiles.length === 0
    ) {
      console.error(
        "❌ ChatWindow: Missing required data for handover request",
        {
          hasConversation: !!conversation,
          hasUserData: !!userData,
          hasIdPhoto: !!idPhotoFile,
          itemPhotoCount: itemPhotoFiles.length,
        }
      );
      return;
    }

    setIsHandoverSubmitting(true);
    try {
      // Upload ID photo to Cloudinary with validation
      console.log("📤 Uploading ID photo...");
      const idPhotoUrl = await cloudinaryService.uploadImage(
        idPhotoFile,
        "id_photos"
      );

      // Validate the uploaded ID photo URL
      if (
        !idPhotoUrl ||
        typeof idPhotoUrl !== "string" ||
        !idPhotoUrl.includes("cloudinary.com")
      ) {
        console.error("❌ Invalid ID photo URL returned:", idPhotoUrl);
        throw new Error("Invalid ID photo URL returned from upload");
      }

      console.log(
        "✅ ID photo uploaded and validated successfully:",
        idPhotoUrl.split("/").pop()
      );

      // Upload all item photos to Cloudinary with validation
      console.log(
        "📤 Starting item photo uploads...",
        itemPhotoFiles.length,
        "files"
      );

      const itemPhotoUploadPromises = itemPhotoFiles.map(
        async (photoFile, index) => {
          try {
            console.log(
              `📤 Uploading item photo ${index + 1}:`,
              photoFile.name
            );
            const photoUrl = await cloudinaryService.uploadImage(
              photoFile,
              "item_photos"
            );

            // Validate the uploaded URL
            if (
              !photoUrl ||
              typeof photoUrl !== "string" ||
              !photoUrl.includes("cloudinary.com")
            ) {
              console.error(
                `❌ Invalid photo URL returned for item photo ${index + 1}:`,
                photoUrl
              );
              throw new Error(`Invalid photo URL for item photo ${index + 1}`);
            }

            const photoObject = {
              url: photoUrl,
              uploadedAt: new Date(),
              description: "Item photo",
            };

            console.log(
              `✅ Item photo ${index + 1} uploaded successfully:`,
              photoUrl.split("/").pop()
            );
            return photoObject;
          } catch (error: any) {
            console.error(
              `❌ Failed to upload item photo ${index + 1}:`,
              error.message
            );
            throw new Error(
              `Failed to upload item photo ${index + 1}: ${error.message}`
            );
          }
        }
      );

      const uploadedItemPhotos = await Promise.all(itemPhotoUploadPromises);

      // Validate the final array
      console.log("🔍 Validating uploaded item photos array...");
      uploadedItemPhotos.forEach((photo, index) => {
        if (
          !photo?.url ||
          typeof photo.url !== "string" ||
          !photo.url.includes("cloudinary.com")
        ) {
          console.error(
            `❌ Invalid photo object in uploadedItemPhotos[${index}]:`,
            photo
          );
          throw new Error(`Invalid photo object at index ${index}`);
        }
        console.log(
          `✅ Photo ${index + 1} validation passed:`,
          photo.url.split("/").pop()
        );
      });

      console.log(
        "🎉 All item photos uploaded and validated successfully:",
        uploadedItemPhotos.length,
        "photos"
      );

      // Final validation before sending to Firestore
      console.log("🔍 Final validation before sending handover request...");
      console.log("🔍 ID photo URL:", idPhotoUrl ? "valid" : "invalid");
      console.log("🔍 Item photos array:", uploadedItemPhotos.length, "photos");

      // Validate all data before sending
      if (
        !idPhotoUrl ||
        typeof idPhotoUrl !== "string" ||
        !idPhotoUrl.includes("cloudinary.com")
      ) {
        throw new Error(
          "ID photo URL is invalid before sending handover request"
        );
      }

      if (
        !Array.isArray(uploadedItemPhotos) ||
        uploadedItemPhotos.length === 0
      ) {
        throw new Error(
          "Item photos array is invalid before sending handover request"
        );
      }

      uploadedItemPhotos.forEach((photo, index) => {
        if (
          !photo?.url ||
          typeof photo.url !== "string" ||
          !photo.url.includes("cloudinary.com")
        ) {
          throw new Error(
            `Item photo ${index + 1} is invalid before sending handover request`
          );
        }
      });

      console.log("✅ All data validated, sending handover request...");

      // Send handover request (modal will be closed by onSuccess callback)
      await messageService.sendHandoverRequest(
        conversation.id,
        userData.uid,
        `${userData.firstName} ${userData.lastName}`,
        userData.profilePicture || userData.profileImageUrl || "",
        conversation.postId,
        conversation.postTitle,
        handoverReason,
        idPhotoUrl,
        uploadedItemPhotos
      );

      // Show success message
      alert("Handover request sent successfully!");
    } catch (error) {
      console.error("Failed to send handover request:", error);
      alert("Failed to send handover request. Please try again.");
    } finally {
      setIsHandoverSubmitting(false);
    }
  };

  const handleOpenClaimModal = () => {
    setShowClaimModal(true);
  };

  const handleCloseClaimModal = () => {
    setShowClaimModal(false);
  };

  const handleSubmitClaim = async (
    claimReason: string,
    idPhotoFile: File | null,
    evidencePhotos: File[]
  ) => {
    if (!conversation || !userData) {
      return;
    }

    // Check if the post creator is an admin by checking the post creator's ID
    const isAdminPost =
      conversation.postCreatorId === "admin" ||
      (conversation.postCreatorId?.includes("admin") ?? false) ||
      conversation.postCreatorId === "campus_security";

    // For admin posts, only require ID photo, not evidence photos
    if (isAdminPost) {
      if (!idPhotoFile) {
        alert("Please upload your ID photo");
        return;
      }
    } else {
      // For non-admin posts, require both ID photo and evidence photos
      if (!idPhotoFile || !evidencePhotos || evidencePhotos.length === 0) {
        alert("Please upload your ID photo and at least one evidence photo");
        return;
      }
    }

    setIsClaimSubmitting(true);
    try {
      // Upload ID photo to Cloudinary with validation
      console.log("📤 Uploading claim ID photo...");
      const idPhotoUrl = await cloudinaryService.uploadImage(
        idPhotoFile,
        "id_photos"
      );

      // Validate the uploaded ID photo URL
      if (
        !idPhotoUrl ||
        typeof idPhotoUrl !== "string" ||
        !idPhotoUrl.includes("cloudinary.com")
      ) {
        console.error("❌ Invalid claim ID photo URL returned:", idPhotoUrl);
        throw new Error("Invalid claim ID photo URL returned from upload");
      }

      console.log(
        "✅ Claim ID photo uploaded and validated successfully:",
        idPhotoUrl.split("/").pop()
      );

      // Upload all evidence photos to Cloudinary with validation
      console.log(
        "📤 Starting evidence photo uploads...",
        evidencePhotos.length,
        "files"
      );

      const photoUploadPromises = evidencePhotos.map(
        async (photoFile, index) => {
          try {
            console.log(
              `📤 Uploading evidence photo ${index + 1}:`,
              photoFile.name
            );
            const photoUrl = await cloudinaryService.uploadImage(
              photoFile,
              "evidence_photos"
            );

            // Validate the uploaded URL
            if (
              !photoUrl ||
              typeof photoUrl !== "string" ||
              !photoUrl.includes("cloudinary.com")
            ) {
              console.error(
                `❌ Invalid photo URL returned for evidence photo ${
                  index + 1
                }:`,
                photoUrl
              );
              throw new Error(
                `Invalid photo URL for evidence photo ${index + 1}`
              );
            }

            const photoObject = {
              url: photoUrl,
              uploadedAt: new Date(),
              description: "Evidence photo",
            };

            console.log(
              `✅ Evidence photo ${index + 1} uploaded successfully:`,
              photoUrl.split("/").pop()
            );
            return photoObject;
          } catch (error: any) {
            console.error(
              `❌ Failed to upload evidence photo ${index + 1}:`,
              error.message
            );
            throw new Error(
              `Failed to upload evidence photo ${index + 1}: ${error.message}`
            );
          }
        }
      );

      const uploadedEvidencePhotos = await Promise.all(photoUploadPromises);

      // Validate the final array
      console.log("🔍 Validating uploaded evidence photos array...");
      uploadedEvidencePhotos.forEach((photo, index) => {
        if (
          !photo?.url ||
          typeof photo.url !== "string" ||
          !photo.url.includes("cloudinary.com")
        ) {
          console.error(
            `❌ Invalid photo object in uploadedEvidencePhotos[${index}]:`,
            photo
          );
          throw new Error(`Invalid photo object at index ${index}`);
        }
        console.log(
          `✅ Evidence photo ${index + 1} validation passed:`,
          photo.url.split("/").pop()
        );
      });

      console.log(
        "🎉 All evidence photos uploaded and validated successfully:",
        uploadedEvidencePhotos.length,
        "photos"
      );
      console.log("📝 Claim reason provided:", claimReason);

      // Final validation before sending to Firestore
      console.log("🔍 Final validation before sending claim request...");
      console.log("🔍 ID photo URL:", idPhotoUrl ? "valid" : "invalid");
      console.log(
        "🔍 Evidence photos array:",
        uploadedEvidencePhotos.length,
        "photos"
      );

      // Validate all data before sending
      if (
        !idPhotoUrl ||
        typeof idPhotoUrl !== "string" ||
        !idPhotoUrl.includes("cloudinary.com")
      ) {
        throw new Error("ID photo URL is invalid before sending claim request");
      }

      if (
        !Array.isArray(uploadedEvidencePhotos) ||
        uploadedEvidencePhotos.length === 0
      ) {
        throw new Error(
          "Evidence photos array is invalid before sending claim request"
        );
      }

      uploadedEvidencePhotos.forEach((photo, index) => {
        if (
          !photo?.url ||
          typeof photo.url !== "string" ||
          !photo.url.includes("cloudinary.com")
        ) {
          throw new Error(
            `Evidence photo ${
              index + 1
            } is invalid before sending claim request`
          );
        }
      });

      console.log("✅ All claim data validated, sending claim request...");

      // For admin posts, only require ID photo, not evidence photos
      const evidenceToSend = isAdminPost ? [] : uploadedEvidencePhotos;

      // Now send the claim request with the appropriate data
      await sendClaimRequest(
        conversation.id,
        userData.uid,
        `${userData.firstName} ${userData.lastName}`,
        userData.profilePicture || userData.profileImageUrl || "",
        conversation.postId,
        conversation.postTitle,
        conversation.postType || "lost", // Add postType with a fallback
        claimReason,
        idPhotoUrl,
        evidenceToSend
      );

      // For admin posts, show a success message with next steps
      if (isAdminPost) {
        alert(
          "Your claim has been submitted. Please wait for the admin to verify your ID and confirm the handover."
        );
      }

      // Show success message - modal will be closed by onSuccess callback
      alert("Claim request sent successfully!");
    } catch (error) {
      console.error("Failed to send claim request:", error);
      alert("Failed to send claim request. Please try again.");
    } finally {
      setIsClaimSubmitting(false);
    }
  };

  const getPostCreatorName = (conversation: Conversation) => {
    if (!conversation.postCreatorId) {
      console.log("❌ No postCreatorId in conversation");
      return "Unknown User";
    }

    if (!conversation.participants[conversation.postCreatorId]) {
      console.log("❌ No participant data for postCreatorId:", conversation.postCreatorId);
      return "Unknown User";
    }

    const creator = conversation.participants[conversation.postCreatorId];
    console.log("🔍 Post creator participant data:", creator);

    const firstName = creator.firstName || "";
    const lastName = creator.lastName || "";

    if (!firstName && !lastName) {
      console.log("❌ Empty firstName and lastName for admin:", conversation.postCreatorId);
      return "Unknown User";
    }

    const fullName = `${firstName} ${lastName}`.trim();
    console.log("✅ Post creator name:", fullName);
    return fullName || "Unknown User";
  };

  const getPostCreatorProfilePicture = (conversation: Conversation) => {
    if (!conversation.postCreatorId || !conversation.participants[conversation.postCreatorId]) {
      return null;
    }

    const creator = conversation.participants[conversation.postCreatorId];
    return creator.profilePicture || creator.profileImageUrl || null;
  };

  // Check if handover button should be shown (memoized)
  const shouldShowHandoverButton = useMemo(() => {
    if (!conversation || !userData) return false;

    // Only show for lost items
    if (conversation.postType !== "lost") return false;

    // Only show if post is still pending
    if (conversation.postStatus !== "pending") return false;

    // Don't show if current user is the post creator
    if (conversation.postCreatorId === userData.uid) return false;

    return true;
  }, [conversation, userData]);

  const shouldShowClaimItemButton = useMemo(() => {
    if (!conversation || !userData) {
      console.log("Missing conversation or userData");
      return false;
    }

    // Only show for found items
    console.log("postType:", conversation.postType);
    if (conversation.postType !== "found") {
      console.log("Not a found item");
      return false;
    }

    // Only show if post is still pending
    console.log("postStatus:", conversation.postStatus);
    if (conversation.postStatus !== "pending") {
      console.log("Post is not pending");
      return false;
    }

    // Check if the post is from an admin (using isAdminPost flag or checking creator's role)
    const creatorData = conversation.participants[conversation.postCreatorId];
    const isAdminPost =
      conversation.isAdminPost === true ||
      creatorData?.role === "admin" ||
      creatorData?.role === "campus_security" ||
      // Check if creator is admin/campus security by name (fallback)
      (creatorData?.firstName === "System" &&
        creatorData?.lastName === "Administrator") ||
      (creatorData?.firstName === "Campus" &&
        creatorData?.lastName === "Security");

    console.log("=== Admin Post Detection ===");
    console.log("isAdminPost flag:", conversation.isAdminPost);
    console.log("creatorData:", creatorData);
    console.log("creator role:", creatorData?.role);
    console.log("isAdminPost result:", isAdminPost);
    console.log("postCreatorId:", conversation.postCreatorId);
    console.log("current user id:", userData.uid);
    console.log("participants:", conversation.participants);

    if (isAdminPost) {
      console.log("Admin post detected, ignoring foundAction");
      // For admin posts, don't hide the button just because current user is the post creator
      // The admin who confirmed the handover/claim should still be able to see the claim button
      console.log("Showing claim button for admin post");
      return true;
    }

    // For non-admin posts, check if the item is turned over
    if (conversation.foundAction && conversation.foundAction !== "keep") {
      console.log("Item has been turned over, hiding claim button");
      return false;
    }

    // Don't show if current user is the post creator
    if (conversation.postCreatorId === userData.uid) {
      console.log("Current user is the post creator, hiding claim button");
      return false;
    }

    console.log("All conditions met, showing claim button");

    return true;
  }, [conversation, userData]);

  if (!conversation) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center text-center text-gray-500">
          <img src={NoChat} alt="no_message" className="size-60" />
          <p className="text-lg font-medium mb-3">Select a conversation</p>
          <p className="text-sm">
            Choose a conversation from the list to start chatting
          </p>
        </div>
      </div>
    );
  }

  const handleConfirmIdPhotoSuccess = (messageId: string): void => {
    // The ID photo confirmation was successful - refresh conversation data first, then close the chat window
    console.log(
      `ID photo confirmed for message: ${messageId} - refreshing conversation data before closing`
    );

    // Refresh conversation data using the callback from parent
    if (onRefreshConversation) {
      onRefreshConversation().then(() => {
        console.log("✅ ChatWindow: Conversation refreshed after ID photo confirmation");

        // Small delay to ensure data is fully loaded, then clear conversation
        setTimeout(() => {
          if (onClearConversation) {
            onClearConversation();
          } else {
            navigate("/messages");
          }
        }, 300);
      }).catch((error: any) => {
        console.error("❌ ChatWindow: Failed to refresh conversation:", error);
        // Fallback: just clear immediately if refresh fails
        if (onClearConversation) {
          onClearConversation();
        } else {
          navigate("/messages");
        }
      });
    } else {
      // If no refresh callback, just clear immediately
      if (onClearConversation) {
        onClearConversation();
      } else {
        navigate("/messages");
      }
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-white h-full">
      {/* Chat Header */}
      <div className="p-4 border-b border-gray-200 bg-gray-50 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-gray-900">
                {conversation.postTitle}
              </h3>
              {/* Post Type Badge */}
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-medium flex-shrink-0 ${
                  conversation.postType === "found"
                    ? "bg-green-200 text-green-800"
                    : "bg-orange-200 text-orange-800"
                }`}
              >
                {conversation.postType === "found" ? "FOUND" : "LOST"}
              </span>
            </div>
            <div className="flex items-center gap-3 mt-1">
              <ProfilePicture
                src={getPostCreatorProfilePicture(conversation)}
                alt="post creator profile"
                className="size-8"
              />
              <p className="text-sm text-gray-500">
                {getPostCreatorName(conversation)}
                {conversation.isAdminPost && " (Admin)"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Info Button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowInfoModal(true);
              }}
              className="text-blue-400 hover:text-blue-800 focus:outline-none p-1"
              aria-label="Show conversation information"
            >
              <InformationCircleIcon className="size-6" />
            </button>

            {/* Handover Item Button */}
            {shouldShowHandoverButton && (
              <button
                onClick={handleOpenHandoverModal}
                className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
              >
                Handover Item
              </button>
            )}

            {/* Claim Item Button */}
            {shouldShowClaimItemButton && (
              <button
                onClick={handleOpenClaimModal}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                Claim Item
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div
        ref={messagesContainerRef}
        className="overflow-y-auto p-4 bg-white hover:scrollbar-thin hover:scrollbar-thumb-gray-300 hover:scrollbar-track-gray-100 relative"
        style={{
          scrollBehavior: "auto",
        }}
        onScroll={handleScroll}
        onClick={() => {
          // User clicked in chat area - this indicates engagement
          // No timer needed - just track the interaction
        }}
      >
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <LoadingSpinner />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center text-gray-500 mt-8">
            <p>No messages yet</p>
            <p className="text-sm">Start the conversation!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((message) => (
              <MessageBubble
                key={`${message.id}-${forceRerender}`}
                message={message}
                isOwnMessage={message.senderId === userData?.uid}
                showSenderName={
                  Object.keys(conversation.participants).length > 2
                }
                conversationId={conversation.id}
                currentUserId={userData?.uid || ""}
                postOwnerId={conversation.postCreatorId}
                onHandoverResponse={handleHandoverResponse}
                onClaimResponse={handleClaimResponse}
                onConfirmIdPhotoSuccess={handleConfirmIdPhotoSuccess}
                onMessageSeen={() => handleMessageSeen(message.id)}
              />
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Message Input - Sticky at bottom */}
      <div className="border-t border-gray-200 bg-white mt-auto relative">
        {/* Message Counter - Sticky above input */}
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600 font-medium">
              Messages in conversation
            </span>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <div
                  className={`w-3 h-3 rounded-full ${
                    messages.length >= 45
                      ? "bg-red-400"
                      : messages.length >= 40
                      ? "bg-yellow-400"
                      : "bg-green-400"
                  }`}
                />
                <span
                  className={`text-sm font-semibold ${
                    messages.length >= 45
                      ? "text-red-600"
                      : messages.length >= 40
                      ? "text-yellow-600"
                      : "text-green-600"
                  }`}
                >
                  {messages.length}/50
                </span>
              </div>
              {messages.length >= 45 && (
                <span className="text-xs text-red-500 font-medium">
                  {50 - messages.length} left
                </span>
              )}
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
            <div
              className={`h-2 rounded-full transition-all duration-300 ${
                messages.length >= 45
                  ? "bg-red-400"
                  : messages.length >= 40
                  ? "bg-yellow-400"
                  : "bg-green-400"
              }`}
              style={{ width: `${(messages.length / 50) * 100}%` }}
            />
          </div>

          {/* Status Message */}
          {messages.length >= 45 && (
            <div className="text-xs text-red-500 text-center">
              ⚠️ Oldest messages will be automatically removed when limit is
              reached
            </div>
          )}
        </div>

        {/* Input Form */}
        <div className="p-4 relative">
          {/* Scroll to Bottom Button - Above Input */}
          <button
            onClick={scrollToBottomWithAnimation}
            className={`absolute -top-30 left-1/2 transform -translate-x-1/2 p-2 border border-gray-300 rounded-full shadow-sm hover:bg-gray-50 transition-all duration-300 bg-white z-10 ${
              showScrollToBottom
                ? "animate-slide-up opacity-100"
                : "animate-slide-down opacity-0"
            }`}
            title="Scroll to bottom"
            style={{
              visibility: showScrollToBottom ? "visible" : "hidden",
              pointerEvents: showScrollToBottom ? "auto" : "none",
            }}
          >
            <svg
              className="w-4 h-4 text-gray-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 14l-7 7m0 0l-7-7m7 7V3"
              />
            </svg>
          </button>

          <form
            onSubmit={handleSendMessage}
            className="flex items-center gap-2"
          >
            <div className="flex-1 relative">
              <textarea
                ref={textareaRef}
                value={newMessage}
                onChange={(e) => {
                  setNewMessage(e.target.value);
                }}
                onFocus={() => setIsUserTyping(true)}
                onBlur={() => setIsUserTyping(false)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    if (
                      newMessage.trim() &&
                      !isSending &&
                      newMessage.length <= 200
                    ) {
                      handleSendMessage(e as any);
                    }
                  }
                }}
                placeholder="Type your message..."
                maxLength={200}
                rows={1}
                style={{
                  minHeight: "40px",
                  maxHeight: "200px",
                  overflowY: "auto",
                  scrollbarWidth: "none" /* Firefox */,
                  msOverflowStyle: "none" /* IE and Edge */,
                }}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-1 focus:ring-navyblue focus:border-transparent resize-none transition-all duration-200 [&::-webkit-scrollbar]:hidden ${
                  newMessage.length > 180
                    ? newMessage.length >= 200
                      ? "border-red-300 focus:ring-red-500"
                      : "border-yellow-300 focus:ring-yellow-500"
                    : "border-gray-300"
                }`}
                disabled={isSending}
              />
              <div className="absolute bottom-1 right-2 text-xs text-gray-400">
                {newMessage.length}/200
              </div>
            </div>

            <button
              type="submit"
              disabled={
                !newMessage.trim() || isSending || newMessage.length > 200
              }
              className="h-10 px-4 bg-navyblue text-white rounded-lg hover:bg-blue-900 focus:outline-none focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSending ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                "Send"
              )}
            </button>
          </form>
        </div>
      </div>

      {/* Claim Verification Modal */}
      <ClaimVerificationModal
        isOpen={showClaimModal}
        onClose={handleCloseClaimModal}
        onSubmit={handleSubmitClaim}
        itemTitle={conversation?.postTitle || ""}
        isLoading={isClaimSubmitting}
        onSuccess={() => {
          // Close modal and ensure it's properly reset
          setShowClaimModal(false);
          console.log("Claim form submitted and modal closed successfully");
        }}
      />

      {/* Handover Verification Modal */}
      <HandoverVerificationModal
        isOpen={showHandoverModal}
        onClose={handleCloseHandoverModal}
        onSubmit={handleSubmitHandover}
        itemTitle={conversation?.postTitle || ""}
        isLoading={isHandoverSubmitting}
        onSuccess={() => {
          setShowHandoverModal(false);
          console.log("Handover form submitted and modal closed successfully");
        }}
      />

      {/* Info Modal */}
      {showInfoModal && conversation && (
        <div className="fixed inset-0 bg-black/50  flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-md max-w-md w-full p-6 relative">
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={handlePrevPage}
                className="p-1 text-gray-500 hover:text-gray-700"
                aria-label="Previous page"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>

              <h3 className="text-lg font-semibold">
                {infoPages[infoPage - 1].title}
              </h3>

              <button
                onClick={handleNextPage}
                className="p-1 text-gray-500 hover:text-gray-700"
                aria-label="Next page"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              {infoPages[infoPage - 1].content}

              {infoPage === 1 && (
                <div>
                  <p className="text-sm text-gray-500">Participants</p>
                  <div className="mt-3 space-y-1">
                    {Object.entries(conversation?.participants || {}).map(
                      ([uid, user]) => (
                        <div key={uid} className="flex items-center gap-3">
                          <ProfilePicture
                            src={user.profilePicture || user.profileImageUrl}
                            alt={`${user.firstName} ${user.lastName}`}
                            className="size-9"
                          />
                          <span className="text-sm font-inter font-regular">
                            {`${user.firstName} ${user.lastName}`}
                            {conversation?.postCreatorId === uid &&
                              " (Post Creator)"}
                          </span>
                        </div>
                      )
                    )}
                  </div>
                </div>
              )}

              <div className="flex justify-center gap-2 mt-4">
                {infoPages.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setInfoPage(index + 1)}
                    className={`h-2 w-2 rounded-full ${
                      infoPage === index + 1 ? "bg-yellow-500" : "bg-gray-300"
                    }`}
                    aria-label={`Go to page ${index + 1}`}
                  />
                ))}
              </div>
            </div>
            <div className="mt-6 flex justify-end">
              <button
                onClick={resetInfoModal}
                className="px-4 py-2 bg-navyblue w-full text-white rounded-md hover:bg-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatWindow;
