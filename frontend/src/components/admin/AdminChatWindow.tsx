import React, { useState, useEffect, useRef, useLayoutEffect, useCallback } from "react";
import { useMessage } from "@/context/MessageContext";
import type { Conversation, Message } from "@/types/Post";
import MessageBubble from "@/components/chat/MessageBubble";
import { useAuth } from "@/context/AuthContext";
import ProfilePicture from "@/components/user/ProfilePicture";
import { useToast } from "@/context/ToastContext";
import { useNavigate } from "react-router-dom";
import NoChat from "@/assets/no_chat.png";
import { db } from "@/services/firebase/config";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";

// Define valid toast types
type ToastType = "success" | "error" | "info" | "warning";

interface UserInfo {
  uid: string;
  displayName?: string;
  photoURL?: string;
  email?: string;
  contactNum?: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  photo?: string;
  profilePicture?: string;
  profileImageUrl?: string;
  avatar?: string;
  picture?: string;
  image?: string;
}

interface Participant {
  uid: string;
  firstName: string;
  lastName: string;
  profilePicture?: string;
  profileImageUrl?: string;
  joinedAt: any;
  role?: 'user' | 'admin' | 'campus_security';
  photoURL?: string;
  photo?: string;
  avatar?: string;
  picture?: string;
  image?: string;
}

interface AdminChatWindowProps {
  conversation: Conversation | null;
}

const AdminChatWindow: React.FC<AdminChatWindowProps> = ({ conversation }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const lastMessageCount = useRef(0);
  const [newMessage, setNewMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const { sendMessage, getConversationMessages, markConversationAsRead } =
    useMessage();
  const { userData } = useAuth();
  const { showToast } = useToast() as {
    showToast: (message: string, type: ToastType) => void;
  };
  const navigate = useNavigate();

  // Auto-scroll to bottom when new messages arrive
  const scrollToBottom = (behavior: "auto" | "smooth" = "auto") => {
    if (messagesContainerRef.current) {
      // Use requestAnimationFrame to ensure DOM is ready
      requestAnimationFrame(() => {
        if (messagesContainerRef.current) {
          messagesContainerRef.current.scrollTo({
            top: messagesContainerRef.current.scrollHeight,
            behavior,
          });
          setShowScrollToBottom(false);
        }
      });
    } else if (messagesEndRef.current) {
      requestAnimationFrame(() => {
        if (messagesEndRef.current) {
          messagesEndRef.current.scrollIntoView({ behavior });
        }
      });
    }
  };

  // Set up MutationObserver to scroll when messages are added to DOM
  useEffect(() => {
    if (!messagesContainerRef.current || messages.length === 0) return;

    const observer = new MutationObserver(() => {
      // Scroll to bottom when DOM changes (messages added/removed)
      scrollToBottom("auto");
    });

    observer.observe(messagesContainerRef.current, {
      childList: true,
      subtree: true,
    });

    return () => observer.disconnect();
  }, [messages.length]);

  // Real-time conversation existence monitor - close chat if conversation is deleted by another user/process
  useEffect(() => {
    if (!conversation?.id) return;

    console.log(`👀 AdminChatWindow: Setting up real-time listener for conversation ${conversation.id}`);

    let unsubscribe: (() => void) | undefined;

    const setupListener = async () => {
      try {
        const { doc, onSnapshot } = await import("firebase/firestore");

        const conversationRef = doc(db, 'conversations', conversation.id);
        unsubscribe = onSnapshot(conversationRef, (docSnapshot: any) => {
          if (!docSnapshot.exists()) {
            console.log(`🚪 AdminChatWindow: Conversation ${conversation.id} was deleted - redirecting to admin messages page`);
            navigate("/admin/messages");
            return;
          }
        }, (error: any) => {
          console.error(`❌ AdminChatWindow: Error listening to conversation ${conversation.id}:`, error);
          // Don't navigate on listener errors - could be temporary network issues
        });
      } catch (error) {
        console.error(`❌ AdminChatWindow: Failed to setup conversation listener for ${conversation.id}:`, error);
      }
    };

    setupListener();

    return () => {
      if (unsubscribe) {
        console.log(`🔌 AdminChatWindow: Cleaning up conversation listener for ${conversation.id}`);
        unsubscribe();
      }
    };
  }, [conversation?.id, navigate]);

  // Handle scroll events to track position and show/hide scroll-to-bottom button
  const handleScroll = (_e: React.UIEvent<HTMLDivElement>) => {
    if (!messagesContainerRef.current) return;

    const { scrollTop, scrollHeight, clientHeight } =
      messagesContainerRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 100;

    // Only show scroll-to-bottom button if not at bottom and new messages arrive
    if (isAtBottom) {
      setShowScrollToBottom(false);
    } else if (messages.length > lastMessageCount.current) {
      setShowScrollToBottom(true);
    }
  };

  // Load messages when conversation changes
  useEffect(() => {
    if (!conversation) {
      setMessages([]);
      return;
    }

    const unsubscribe = getConversationMessages(
      conversation.id,
      (loadedMessages) => {
        setMessages(loadedMessages);

        // Mark conversation as read when messages are loaded (similar to ChatWindow)
        if (userData && conversation?.unreadCounts?.[userData.uid] > 0) {
          markConversationAsRead(conversation.id);
        }

        lastMessageCount.current = loadedMessages.length;
      }
    );

    return () => {
      unsubscribe();
      lastMessageCount.current = 0; // Reset when conversation changes
    };
  }, [conversation, getConversationMessages, userData, markConversationAsRead]);

  // Always scroll to bottom when messages change or conversation loads
  useLayoutEffect(() => {
    if (messages.length > 0) {
      // Use setTimeout to ensure DOM is fully rendered
      const scrollTimer = setTimeout(() => {
        scrollToBottom("auto");
      }, 10);

      return () => clearTimeout(scrollTimer);
    }
  }, [messages, conversation]);

  // Auto-resize textarea based on content
  const adjustTextareaHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      // Reset height to get the correct scrollHeight
      textarea.style.height = "auto";
      // Set the height to scrollHeight with a max of 200px
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  };

  // Adjust textarea height when newMessage changes
  useLayoutEffect(() => {
    adjustTextareaHeight();
  }, [newMessage]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!conversation || !userData || !newMessage.trim()) return;

    // Reset textarea height after sending
    if (textareaRef.current) {
      textareaRef.current.style.height = "40px";
    }

    setIsSending(true);
    try {
      await sendMessage(
        conversation.id,
        userData.uid,
        `[ADMIN] ${userData.firstName} ${userData.lastName}`,
        newMessage.trim(),
        userData.profilePicture || userData.profileImageUrl
      );
      setNewMessage("");
    } catch (error) {
      console.error("Failed to send message:", error);
      showToast("Failed to send message", "error");
    } finally {
      setIsSending(false);
    }
  };

  // Handle claim response
  const handleClaimResponse = async (
    messageId: string,
    status: "accepted" | "rejected"
  ) => {
    if (!conversation || !userData?.uid) return;

    try {
      // Create a Firestore-compatible timestamp
      const timestamp = new Date();

      // Update the message in the UI immediately for better UX
      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.id === messageId && msg.claimData) {
            return {
              ...msg,
              claimData: {
                ...msg.claimData,
                status,
                respondedAt: timestamp, // Store as Date object
                responderId: userData.uid,
              },
            } as Message; // Cast to Message type
          }
          return msg;
        })
      );

      // Update the message in Firestore
      const messageRef = doc(
        db,
        "conversations",
        conversation.id,
        "messages",
        messageId
      );

      await updateDoc(messageRef, {
        "claimData.status": status,
        "claimData.respondedAt": serverTimestamp(),
        "claimData.responderId": userData.uid,
      });

      showToast(`Claim ${status}`, "success");
    } catch (error) {
      console.error("Error updating claim status:", error);
      showToast(`Failed to process claim`, "error");

      // Revert the optimistic update on error
      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.id === messageId && msg.claimData) {
            return {
              ...msg,
              claimData: {
                ...msg.claimData,
              },
            } as Message; // Cast to Message type
          }
          return msg;
        })
      );
    }
  };

  const getOtherParticipantProfilePicture = (conversation: Conversation) => {
    if (!userData?.uid) {
      return null;
    }

    // First try to get from participantInfo
    if (conversation.participantInfo) {
      const otherParticipantId = Object.keys(conversation.participantInfo).find(
        (uid) => uid !== userData.uid
      );

      if (otherParticipantId && conversation.participantInfo[otherParticipantId]) {
        const info = conversation.participantInfo[otherParticipantId] as UserInfo;
        return (
          info.profilePicture ||
          info.profileImageUrl ||
          info.avatar ||
          info.photoURL ||
          info.photo ||
          info.picture ||
          info.image ||
          null
        );
      }
    }

    // Fallback to participants object
    if (!conversation.participants) {
      return null;
    }

    const otherParticipant = Object.entries(conversation.participants || {}).find(
      ([uid]) => uid !== userData.uid
    );

    if (!otherParticipant) {
      return null;
    }

    const participant = otherParticipant[1] as Participant | boolean;
    if (typeof participant === 'boolean') {
      return null;
    }
    return (
      participant.profilePicture ||
      participant.profileImageUrl ||
      participant.photoURL ||
      participant.photo ||
      participant.avatar ||
      participant.picture ||
      participant.image ||
      null
    );
  };

  const getOtherParticipantName = (conversation: Conversation) => {
    if (!userData?.uid) {
      return "Unknown User";
    }

    // First try to get from participantInfo
    const otherParticipantInfo = Object.entries(conversation.participantInfo || {}).find(
      ([uid]) => uid !== userData.uid
    );

    if (otherParticipantInfo) {
      const info = otherParticipantInfo[1] as UserInfo | undefined;
      if (info) {
        return (
          info.displayName ||
          [info.firstName, info.lastName].filter(Boolean).join(' ') ||
          info.name ||
          'Unknown User'
        );
      }
    }

    // Fall back to participants map
    const otherParticipant = Object.entries(conversation.participants || {}).find(
      ([uid]) => uid !== userData.uid
    );

    if (otherParticipant) {
      const participant = otherParticipant[1];
      if (typeof participant === 'object' && participant !== null) {
        const part = participant as Participant;
        return (
          part.firstName && part.lastName
            ? `${part.firstName} ${part.lastName}`.trim()
            : part.firstName ||
              part.lastName ||
              (part as any).displayName ||
              'Unknown User'
        );
      }
    }

    return 'Unknown User';
  };

  const getMessageProfilePicture = useCallback(
    (message: Message) => {
      // First try to get from participantInfo (most up-to-date)
      if (conversation?.participantInfo?.[message.senderId]) {
        const info = conversation.participantInfo[message.senderId] as UserInfo;
        return (
          info.profilePicture ||  // Check profilePicture first
          info.photoURL ||        // Then photoURL
          info.photo ||           // Then other possible fields
          info.profileImageUrl ||
          info.avatar ||
          info.picture ||
          info.image ||
          message.senderProfilePicture ||  // Fall back to message data
          null
        );
      }

      // Fall back to message data
      if (message.senderProfilePicture) {
        return message.senderProfilePicture;
      }

      // Fall back to participants map
      const participant = conversation?.participants?.[message.senderId] as Participant | boolean | undefined;
      if (!participant || typeof participant === 'boolean') {
        return null;
      }
      
      return (
        participant.profilePicture ||
        participant.photoURL ||
        participant.photo ||
        participant.profileImageUrl ||
        participant.avatar ||
        participant.picture ||
        participant.image ||
        null
      );
    },
    [conversation]
  );

  if (!conversation) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-50">
        <div className="text-center">
          <img
            src={NoChat}
            alt="No chat selected"
            className="mx-auto h-24 w-24 mb-4 opacity-50"
          />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No conversation selected
          </h3>
          <p className="text-gray-500">
            Choose a conversation from the list to view messages
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full bg-white">
      {/* Admin Chat Header */}
      <div className="p-4 border-b border-gray-200 bg-gray-50 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ProfilePicture
              src={getOtherParticipantProfilePicture(conversation)}
              alt="other participant profile"
              className="size-5"
            />
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-gray-900">
                  {conversation.postTitle}
                </h3>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-medium flex-shrink-0 ${
                    conversation.postType === "found"
                      ? "bg-green-300 text-green-800"
                      : "bg-orange-300 text-orange-800"
                  }`}
                >
                  {conversation.postType?.toUpperCase() || "UNKNOWN"}
                </span>
              </div>
              <p className="text-sm text-gray-500">
                {getOtherParticipantName(conversation)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
              Admin View
            </span>
            {/* Hidden close button as requested */}
            {/*
            {onClearConversation && (
              <button
                onClick={onClearConversation}
                className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                title="Close conversation"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            )}
            */}
          </div>
        </div>
      </div>

      {/* Messages Container */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-4 w-full relative"
        onScroll={handleScroll}
      >
        {/* Scroll to bottom button */}
        {showScrollToBottom && (
          <button
            onClick={() => scrollToBottom("smooth")}
            className="sticky left-full bottom-4 ml-2 p-2 bg-blue-500 text-white rounded-full shadow-lg hover:bg-blue-600 transition-colors z-10"
            title="Scroll to bottom"
          >
            <svg
              className="w-5 h-5"
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
        )}
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-32">
            <p className="text-gray-500">No messages yet</p>
          </div>
        ) : (
          messages.map((message) => (
            <div key={message.id} className="flex items-start gap-3 group">
              {!message.senderName?.startsWith('[ADMIN]') && (
                <ProfilePicture
                  src={getMessageProfilePicture(message) || undefined}
                  alt={message.senderName}
                  className="size-6"
                />
              )}
              <div className="flex-1 min-w-0">
                <div className={`flex items-center gap-2 mb-1 ${message.senderName?.startsWith('[ADMIN]') ? 'justify-end' : 'justify-start'}`}>
                  <span className="font-medium text-sm text-gray-900">
                    {message.senderName}
                  </span>
                  {message.senderId === userData?.uid && (
                    <span className="text-xs bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded">
                      You (Admin)
                    </span>
                  )}
                </div>
                <div className="relative group">
                  <MessageBubble
                    message={message}
                    isOwnMessage={message.senderId === userData?.uid}
                    showSenderName={false}
                    conversationId={conversation.id}
                    currentUserId={userData?.uid || ""}
                    onClaimResponse={handleClaimResponse}
                  />

                  {/* Hidden admin delete button as requested */}
                  {/*
                  <button
                    onClick={() => handleDeleteMessage(message.id)}
                    disabled={deletingMessageId === message.id}
                    className="absolute -top-2 -right-2 p-1 bg-red-100 text-red-600 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-200 disabled:opacity-50"
                    title="Delete message (Admin only)"
                  >
                    {deletingMessageId === message.id ? (
                      <div className="w-3 h-3 border border-red-600 border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <svg
                        className="w-3 h-3"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    )}
                  </button>
                  */}
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Admin Message Input */}
      <div className="w-full p-4 border-t border-gray-200 bg-gray-50 flex-shrink-0">
        <form onSubmit={handleSendMessage} className="flex flex-col gap-2">
          <div className="flex gap-2">
            <textarea
              ref={textareaRef}
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage(e);
                }
              }}
              placeholder="Type a message as admin..."
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none overflow-hidden min-h-[40px] max-h-[200px] transition-all duration-100 ease-in-out"
              style={{ height: "40px" }}
              rows={1}
              disabled={isSending}
            />
            <button
              type="submit"
              disabled={!newMessage.trim() || isSending}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed h-10 self-end"
            >
              {isSending ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              )}
            </button>
          </div>
        </form>
        <p className="text-xs text-gray-500 mt-2">
          Messages sent as admin will be marked with [ADMIN] prefix
        </p>
      </div>
    </div>
  );
};

export default AdminChatWindow;
