import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
} from "react";
// Context
import { useMessage } from "@/context/MessageContext";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";

// Types
import type { Conversation, Message } from "@/types/Post";

// Components
import MessageBubble from "@/components/chat/MessageBubble";
import LoadingSpinner from "@/components/layout/LoadingSpinner";
import ProfilePicture from "@/components/user/ProfilePicture";
import ClaimVerificationModal from "@/components/modals/ClaimVerification";
import HandoverVerificationModal from "@/components/modals/HandoverVerification";

// Services
import { messageService } from "@/services/firebase/messages";
import { cloudinaryService } from "@/utils/cloudinary";

// Hooks
import { useNavigate } from "react-router-dom";

// Assets
import NoChat from "@/assets/no_chat.png";
import { InformationCircleIcon } from "@heroicons/react/24/outline";

interface ChatWindowProps {
  conversation: Conversation | null;
  onClearConversation?: () => void; 
  onRefreshConversation?: () => Promise<void>; 
}

const ChatWindow: React.FC<ChatWindowProps> = ({
  conversation,
  onClearConversation,
  onRefreshConversation,
}) => {
  const { user: authUser, userData: authUserData } = useAuth();
  const [userData, setUserData] = useState<{
    uid: string;
    displayName?: string;
    email?: string;
    photoURL?: string;
    firstName?: string;
    lastName?: string;
    profilePicture?: string;
    profileImageUrl?: string;
  } | null>(null);

  // Combine auth user and userData
  useEffect(() => {
    if (authUser) {
      setUserData({
        uid: authUser.uid,
        displayName: authUser.displayName || '',
        email: authUser.email || '',
        photoURL: authUser.photoURL || '',
        firstName: authUserData?.firstName || '',
        lastName: authUserData?.lastName || '',
        profilePicture: authUser.photoURL || '',
        profileImageUrl: authUser.photoURL || ''
      });
    } else {
      setUserData(null);
    }
  }, [authUser, authUserData]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [isClaimSubmitting, setIsClaimSubmitting] = useState(false);
  const [showHandoverModal, setShowHandoverModal] = useState(false);
  const [isHandoverSubmitting, setIsHandoverSubmitting] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [infoPage, setInfoPage] = useState(1);
  const [forceRerender, setForceRerender] = useState(0); 
  const [isUserTyping, setIsUserTyping] = useState(false);

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

  const navigate = useNavigate();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { sendMessage, getConversationMessages, markConversationAsRead, markMessageAsRead, markAllUnreadMessagesAsRead, sendClaimRequest } = useMessage();
  const { showToast } = useToast();

  const scrollToBottom = () => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop =
        messagesContainerRef.current.scrollHeight;
    } else if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "auto", block: "end" });
    }
  };

  const scrollToBottomWithAnimation = () => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTo({
        top: messagesContainerRef.current.scrollHeight,
        behavior: "smooth",
      });
    } else if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement;
    const scrollTop = target.scrollTop;
    const scrollHeight = target.scrollHeight;
    const clientHeight = target.clientHeight;

    const isScrolledUp = scrollTop < scrollHeight - clientHeight - 100;
    setShowScrollToBottom(isScrolledUp);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!conversation || !newMessage.trim() || !userData) return;

    const messageToSend = newMessage.trim();

    setNewMessage("");

    try {
      await sendMessage(
        conversation.id,
        userData.uid,
        `${userData.firstName || ''} ${userData.lastName || ''}`.trim() || 'User',
        messageToSend,
        userData.profilePicture || userData.profileImageUrl || ''
      );
    } catch (error) {
      console.error("Failed to send message:", error);
      setNewMessage(messageToSend);
      showToast('error', 'Message Failed', 'Failed to send message. Please try again.');
    }
  };

  useEffect(() => {
    if (!conversation) {
      setMessages([]);
      return;
    }

    setIsLoading(true);
    const unsubscribe = getConversationMessages(
      conversation.id,
      (loadedMessages) => {
        setMessages(loadedMessages);
        setIsLoading(false);

        if (
          userData &&
          conversation?.unreadCounts?.[userData.uid] > 0 &&
          conversation?.id
        ) {
          markConversationAsRead(conversation.id);
        }

        if (
          userData &&
          conversation?.unreadCounts?.[userData.uid] > 0 &&
          conversation?.id
        ) {
          markAllUnreadMessagesAsRead(conversation.id);
        }

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

  const shouldAutoReadMessage = (): boolean => {
    return true;
  };

  useEffect(() => {
    if (!conversation?.id || !userData?.uid || !messages.length) return;

    if (conversation?.unreadCounts?.[userData.uid] > 0) {
      if (shouldAutoReadMessage()) {
        markConversationAsRead(conversation.id);
        markAllUnreadMessagesAsRead(conversation.id);
      }
    }
  }, [
    messages,
    conversation,
    userData,
    markConversationAsRead,
    markAllUnreadMessagesAsRead,
    shouldAutoReadMessage,
  ]);

  useEffect(() => {
    if (!conversation?.id) return;


    let unsubscribe: (() => void) | undefined;

    const setupListener = async () => {
      try {
        const { doc, onSnapshot } = await import("firebase/firestore");
        const { db } = await import("@/services/firebase/config");

        const conversationRef = doc(db, 'conversations', conversation.id);
        unsubscribe = onSnapshot(conversationRef, (docSnapshot: any) => {
          if (!docSnapshot.exists()) {
            console.log(`Conversation ${conversation.id} was deleted - clearing chat window`);

            setMessages([]);
            setNewMessage("");
            setShowClaimModal(false);
            setShowHandoverModal(false);
            setShowInfoModal(false);
            setIsLoading(false);

            if (onClearConversation) {
              onClearConversation();
            } else {
              navigate("/messages");
            }
            return;
          }
        }, (error: any) => {
          console.error(`❌ ChatWindow: Error listening to conversation ${conversation.id}:`, error);
        });
      } catch (error) {
        console.error(`❌ ChatWindow: Failed to setup conversation listener for ${conversation.id}:`, error);
      }
    };

    setupListener();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [conversation?.id, navigate, onClearConversation]);

  const handleMessageSeen = async (messageId: string) => {
    if (!conversation?.id || !userData?.uid) return;

    try {
      await markMessageAsRead(conversation.id, messageId);

      if (conversation?.unreadCounts?.[userData.uid] > 0) {
        await markConversationAsRead(conversation.id);
      }
    } catch (error) {
      console.warn("Failed to mark message/conversation as read:", error);
    }
  };

  useEffect(() => {
    if (!conversation?.id) return;

    const checkConversationExists = async () => {
      try {
        const { doc, getDoc } = await import("@firebase/firestore");
        const { db } = await import("@/services/firebase/config");

        const conversationRef = doc(db, "conversations", conversation.id);
        const conversationSnap = await getDoc(conversationRef);

        if (!conversationSnap.exists()) {
          console.log(`🚪 ChatWindow: Conversation ${conversation.id} was deleted (backup check) - clearing chat window`);

          setMessages([]);
          setNewMessage("");
          setShowClaimModal(false);
          setShowHandoverModal(false);
          setShowInfoModal(false);
          setIsLoading(false);

          if (onClearConversation) {
            onClearConversation();
          } else {
            navigate("/messages");
          }
        }
      } catch (error: any) {
        if (
          error.message?.includes("permission") ||
          error.message?.includes("not-found")
        ) {
          console.log(`🚪 ChatWindow: Conversation ${conversation.id} access denied (likely deleted) - clearing chat window`);

          setMessages([]);
          setNewMessage("");
          setShowClaimModal(false);
          setShowHandoverModal(false);
          setShowInfoModal(false);
          setIsLoading(false);

          if (onClearConversation) {
            onClearConversation();
          } else {
            navigate("/messages");
          }
        }
      }
    };

    const interval = setInterval(checkConversationExists, 10000);

    return () => clearInterval(interval);
  }, [conversation, navigate, onClearConversation]);

  useEffect(() => {
    if (!conversation || !userData) return;

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
  }, [conversation]);

  const handleHandoverResponse = async (
    messageId: string,
    status: "accepted" | "rejected"
  ) => {
    setMessages((prevMessages) =>
      prevMessages.map((msg) => {
        if (msg.id === messageId && msg.handoverData) {
          return {
            ...msg,
            handoverData: {
              ...msg.handoverData,
              status: status === "accepted" ? "pending_confirmation" : status,
              respondedAt: new Date(),
              respondedBy: userData?.uid || "",
            } as any,
          };
        }
        return msg;
      })
    );

    if (status === "accepted") {
      setTimeout(() => {
        if (conversation?.id) {
          getConversationMessages(conversation.id, (updatedMessages) => {
            setMessages(updatedMessages);
            setForceRerender((prev) => prev + 1);
          });
        }
      }, 1000);
    }
  };

  const handleClaimResponse = (
    messageId: string,
    status: "accepted" | "rejected"
  ) => {
    setMessages((prevMessages) =>
      prevMessages.map((msg) => {
        if (msg.id === messageId && msg.claimData) {
          return {
            ...msg,
            claimData: {
              ...msg.claimData,
              status: status === "accepted" ? "pending_confirmation" : status,
              respondedAt: new Date(),
              respondedBy: userData?.uid || "",
            } as any,
          };
        }
        return msg;
      })
    );

    if (status === "accepted") {
      setTimeout(() => {
        if (conversation?.id) {
          getConversationMessages(conversation.id, (updatedMessages) => {
            setMessages(updatedMessages);
            setForceRerender((prev) => prev + 1);
          });
        }
      }, 1000);
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
      const idPhotoUrl = await cloudinaryService.uploadImage(
        idPhotoFile,
        "id_photos"
      );

      if (
        !idPhotoUrl ||
        typeof idPhotoUrl !== "string" ||
        !idPhotoUrl.includes("cloudinary.com")
      ) {
        console.error("❌ Invalid ID photo URL returned:", idPhotoUrl);
        throw new Error("Invalid ID photo URL returned from upload");
      }

      const itemPhotoUploadPromises = itemPhotoFiles.map(
        async (photoFile, index) => {
          try {
            const photoUrl = await cloudinaryService.uploadImage(
              photoFile,
              "item_photos"
            );

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
      });

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

      showToast('success', 'Handover Request Sent', 'Your handover request has been sent successfully!');
    } catch (error) {
      console.error("Failed to send handover request:", error);
      showToast('error', 'Handover Failed', 'Failed to send handover request. Please try again.');
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

    const isAdminPost =
      conversation.postCreatorId === "admin" ||
      (conversation.postCreatorId?.includes("admin") ?? false) ||
      conversation.postCreatorId === "campus_security";

    if (isAdminPost) {
      if (!idPhotoFile) {
        showToast('error', 'Missing ID Photo', 'Please upload your ID photo');
        return;
      }
    } else {
      if (!idPhotoFile || !evidencePhotos || evidencePhotos.length === 0) {
        showToast('error', 'Missing Evidence', 'Please upload your ID photo and at least one evidence photo');
        return;
      }
    }

    setIsClaimSubmitting(true);
    try {
      const idPhotoUrl = await cloudinaryService.uploadImage(
        idPhotoFile,
        "id_photos"
      );

      if (
        !idPhotoUrl ||
        typeof idPhotoUrl !== "string" ||
        !idPhotoUrl.includes("cloudinary.com")
      ) {
        console.error("❌ Invalid claim ID photo URL returned:", idPhotoUrl);
        throw new Error("Invalid claim ID photo URL returned from upload");
      }

      const photoUploadPromises = evidencePhotos.map(
        async (photoFile, index) => {
          try {
            const photoUrl = await cloudinaryService.uploadImage(
              photoFile,
              "evidence_photos"
            );

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
      });

      const evidenceToSend = isAdminPost ? [] : uploadedEvidencePhotos;

      await sendClaimRequest(
        conversation.id,
        userData.uid,
        `${userData.firstName} ${userData.lastName}`,
        userData.profilePicture || userData.profileImageUrl || "",
        conversation.postId,
        conversation.postTitle,
        conversation.postType || "lost",
        claimReason,
        idPhotoUrl,
        evidenceToSend
      );

      if (isAdminPost) {
        showToast('success', 'Claim Submitted', 'Your claim has been submitted. Please wait for the admin to verify your ID and confirm the handover.');
      }

      showToast('success', 'Claim Request Sent', 'Your claim request has been sent successfully!');
    } catch (error) {
      console.error("Failed to send claim request:", error);
      showToast('error', 'Claim Failed', 'Failed to send claim request. Please try again.');
    } finally {
      setIsClaimSubmitting(false);
    }
  };

  const getOtherParticipantProfilePicture = (conversation: Conversation): string | null => {
    if (!userData?.uid) {
      return null;
    }
    
    // First try to get from participantInfo (uses photoURL or photo)
    const otherParticipantId = Object.keys(conversation.participantInfo || {}).find(
      id => id !== userData.uid
    );
    
    if (otherParticipantId && conversation.participantInfo?.[otherParticipantId]) {
      const participant = conversation.participantInfo[otherParticipantId];
      return participant.photoURL || participant.photo || null;
    }
    
    // Fallback to participants object (uses profilePicture or profileImageUrl)
    const otherParticipant = Object.entries(conversation.participants || {}).find(
      ([uid]) => uid !== userData.uid
    );

    if (!otherParticipant) {
      return null;
    }
    
    const participant = otherParticipant[1];
    if (typeof participant !== 'object' || participant === null) {
      return null;
    }
    
    return participant.profilePicture || participant.profileImageUrl || null;
  };

  const getOtherParticipantName = (conversation: Conversation) => {
    if (!userData?.uid) {
      return "Unknown User";
    }

    // For admin posts, try to get the post creator's name
    if (conversation.isAdminPost && conversation.postCreatorId) {
      const creator = conversation.participantInfo?.[conversation.postCreatorId] || 
                     (typeof conversation.participants[conversation.postCreatorId] === 'object' ? 
                      conversation.participants[conversation.postCreatorId] : null);
      
      if (creator && typeof creator === 'object') {
        // Handle both participantInfo and participants object types
        if ('displayName' in creator || 'name' in creator) {
          // This is a participantInfo object
          const displayName = (creator as any).displayName || (creator as any).name || '';
          const firstName = (creator as any).firstName || '';
          const lastName = (creator as any).lastName || '';
          return displayName || (firstName || lastName ? `${firstName} ${lastName}`.trim() : "Admin");
        } else {
          // This is a participants object
          const firstName = creator.firstName || '';
          const lastName = creator.lastName || '';
          return (firstName || lastName) ? `${firstName} ${lastName}`.trim() : "Admin";
        }
      }
      return "Admin";
    }

    // First try to get from participantInfo (uses displayName, name, or firstName/lastName)
    const otherParticipantId = Object.keys(conversation.participantInfo || {}).find(
      id => id !== userData.uid
    );
    
    if (otherParticipantId && conversation.participantInfo?.[otherParticipantId]) {
      const participant = conversation.participantInfo[otherParticipantId];
      const firstName = participant.firstName || '';
      const lastName = participant.lastName || '';
      const displayName = participant.displayName || (participant as any).name || '';
      
      return displayName || (firstName || lastName ? `${firstName} ${lastName}`.trim() : "Unknown User");
    }
    
    // Fallback to old participants object
    const otherParticipant = Object.entries(conversation.participants || {}).find(
      ([uid]) => uid !== userData.uid
    );

    if (!otherParticipant) {
      return "Unknown User";
    }

    const [, participant] = otherParticipant;

    // Handle case where participant might be a boolean (from the participants map)
    if (typeof participant === 'boolean') {
      return "Unknown User";
    }

    if (typeof participant === 'object' && participant !== null) {
      const firstName = participant.firstName || "";
      const lastName = participant.lastName || "";

      // If this is an admin post, try to get the post creator's name
      if (conversation.isAdminPost && conversation.postCreatorId) {
        const creator = conversation.participants[conversation.postCreatorId];
        if (creator && typeof creator === 'object') {
          return `${creator.firstName || ''} ${creator.lastName || ''}`.trim() || "Admin";
        }
      }

      return (firstName || lastName) 
        ? `${firstName} ${lastName}`.trim() 
        : "Unknown User";
    }

    return "Unknown User";
  };

  const shouldShowHandoverButton = useMemo(() => {
    if (!conversation || !userData) return false;

    if (conversation.postType !== "lost") return false;

    if (conversation.postStatus !== "pending") return false;

    if (conversation.postCreatorId === userData.uid) return false;

    return true;
  }, [conversation, userData]);

  const shouldShowClaimItemButton = useMemo(() => {
    if (!conversation || !userData) {
      return false;
    }

    if (conversation.postType !== "found") {
      return false;
    }

    if (conversation.postStatus !== "pending") {
      return false;
    }

    const creatorData = conversation.participants[conversation.postCreatorId];

    const isAdminPost = (() => {
      if (!creatorData || typeof creatorData === 'boolean') {
        return conversation.isAdminPost === true;
      }

      return (
        conversation.isAdminPost === true ||
        creatorData.role === "admin" ||
        creatorData.role === "campus_security" ||
        (creatorData.firstName === "System" && creatorData.lastName === "Administrator") ||
        (creatorData.firstName === "Campus" && creatorData.lastName === "Security")
      );
    })();

    if (isAdminPost) {
      return true;
    }

    if (conversation.foundAction && conversation.foundAction !== "keep") {
      return false;
    }

    if (conversation.postCreatorId === userData.uid) {
      return false;
    }

    return true;
  }, [conversation, userData]);

  const handleConfirmIdPhotoSuccess = (messageId: string): void => {
    console.log(
      `ID photo confirmed for message: ${messageId} - refreshing conversation data before closing`
    );

    if (onRefreshConversation) {
      onRefreshConversation().then(() => {
        console.log("✅ ChatWindow: Conversation refreshed after ID photo confirmation");

        setTimeout(() => {
          if (onClearConversation) {
            onClearConversation();
          } else {
            navigate("/messages");
          }
        }, 300);
      }).catch((error: any) => {
        console.error("❌ ChatWindow: Failed to refresh conversation:", error);

        if (onClearConversation) {
          onClearConversation();
        } else {
          navigate("/messages");
        }
      });
    } else {
      if (onClearConversation) {
        onClearConversation();
      } else {
        navigate("/messages");
      }
    }
  };

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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(e);
    }
    
    // Set typing indicator
    if (!isUserTyping) {
      setIsUserTyping(true);
      // Reset typing indicator after 3 seconds of inactivity
      setTimeout(() => {
        setIsUserTyping(false);
      }, 3000);
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
                src={getOtherParticipantProfilePicture(conversation)}
                alt="other participant profile"
                className="size-8"
              />
              <p className="text-sm text-gray-500">
                {getOtherParticipantName(conversation)}
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
            {(() => {
              // Find the most recent sent message that has been seen by other users
              let lastSeenMessageIndex = -1;
              for (let i = messages.length - 1; i >= 0; i--) {
                const message = messages[i];
                if (message.senderId === userData?.uid && message.readBy && Array.isArray(message.readBy) && message.readBy.some(uid => uid !== userData?.uid)) {
                  lastSeenMessageIndex = i;
                  break;
                }
              }

              return messages.map((message, index) => (
                <MessageBubble
                  key={`${message.id}-${forceRerender}`}
                  message={message}
                  isOwnMessage={message.senderId === userData?.uid}
                  showSenderName={true}
                  conversationId={conversation.id}
                  currentUserId={userData?.uid || ""}
                  postOwnerId={conversation.postCreatorId}
                  isLastSeenMessage={index === lastSeenMessageIndex}
                  onHandoverResponse={handleHandoverResponse}
                  onClaimResponse={handleClaimResponse}
                  onConfirmIdPhotoSuccess={handleConfirmIdPhotoSuccess}
                  onMessageSeen={() => handleMessageSeen(message.id)}
                  conversationParticipants={conversation.participants}
                />
              ));
            })()}
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
                onKeyDown={handleKeyDown}
                onFocus={() => setIsUserTyping(true)}
                onBlur={() => setIsUserTyping(false)}
                placeholder="Type your message..."
                maxLength={200}
                rows={1}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-1 focus:ring-navyblue focus:border-transparent resize-none transition-all duration-200 min-h-[40px] max-h-[200px] overflow-y-auto [&::-webkit-scrollbar]:hidden ${
                  newMessage.length > 180
                    ? newMessage.length >= 200
                      ? "border-red-300 focus:ring-red-500"
                      : "border-yellow-300 focus:ring-yellow-500"
                    : "border-gray-300"
                }`}
                disabled={false}
              />
              <div className="absolute bottom-1 right-2 text-xs text-gray-400">
                {newMessage.length}/200
              </div>
            </div>

            <button
              type="submit"
              disabled={
                !newMessage.trim() || newMessage.length > 200
              }
              className="h-10 px-4 bg-navyblue text-white rounded-lg hover:bg-blue-900 focus:outline-none focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Send
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
                      ([uid, user]) => {
                        if (!user) return null;
                        return (
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
                        );
                      }
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
