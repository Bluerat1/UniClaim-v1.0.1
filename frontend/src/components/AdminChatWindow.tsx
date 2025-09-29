import React, { useState, useEffect, useRef } from "react";
import { useMessage } from "../context/MessageContext";
import type { Conversation, Message } from "@/types/Post";
import MessageBubble from "./MessageBubble";
import LoadingSpinner from "./LoadingSpinner";
import { useAuth } from "../context/AuthContext";
import ProfilePicture from "./ProfilePicture";
import { messageService } from "../utils/firebase";
import { useToast } from "../context/ToastContext";
import NoChat from "../assets/no_chat.png";
import { db } from "../utils/firebase";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";

// Define valid toast types
type ToastType = 'success' | 'error' | 'info' | 'warning';

interface AdminChatWindowProps {
  conversation: Conversation | null;
  onClearConversation?: () => void;
}

const AdminChatWindow: React.FC<AdminChatWindowProps> = ({
  conversation,
  onClearConversation,
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  // Removed unused state
  const [deletingMessageId, setDeletingMessageId] = useState<string | null>(
    null
  );

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const { sendMessage, getConversationMessages, markConversationAsRead } =
    useMessage();
  const { userData } = useAuth();
  const { showToast } = useToast() as { showToast: (message: string, type: ToastType) => void };

  // Auto-scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop =
        messagesContainerRef.current.scrollHeight;
    } else if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "auto" });
    }
  };

  // Load messages when conversation changes
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
        scrollToBottom();
      }
    );

    return unsubscribe;
  }, [conversation, getConversationMessages]);

  // Mark conversation as read when admin views it
  useEffect(() => {
    if (conversation && userData) {
      markConversationAsRead(conversation.id);
    }
  }, [conversation, userData, markConversationAsRead]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!conversation || !userData || !newMessage.trim()) return;

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
      showToast('Failed to send message', 'error');
    } finally {
      setIsSending(false);
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!conversation || !userData) return;

    setDeletingMessageId(messageId);
    try {
      await messageService.deleteMessage(conversation.id, messageId, userData.uid);
      showToast('Message deleted successfully', 'success');

      setMessages((prev) => prev.filter((msg) => msg.id !== messageId));
    } catch (error) {
      console.error("Error deleting message:", error);
      showToast('Failed to delete message', 'error');
    } finally {
      setDeletingMessageId(null);
    }
  };

  // Handle claim response
  const handleClaimResponse = async (
    messageId: string,
    status: "accepted" | "rejected"
  ) => {
    if (!conversation || !userData?.uid) return;

    try {
      setIsLoading(true);
      
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
        'conversations',
        conversation.id,
        'messages',
        messageId
      );
      
      await updateDoc(messageRef, {
        'claimData.status': status,
        'claimData.respondedAt': serverTimestamp(),
        'claimData.responderId': userData.uid,
      });

      showToast(`Claim ${status}`, 'success');
    } catch (error) {
      console.error("Error updating claim status:", error);
      showToast(`Failed to process claim`, 'error');
      
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
    } finally {
      setIsLoading(false);
    }
  };

  const getOtherParticipant = (conversation: Conversation) => {
    const participantIds = Object.keys(conversation.participants || {});
    const otherParticipantId = participantIds.find((id) => id !== userData?.uid);
    return conversation.participants[otherParticipantId || ""] || null;
  };

  const getOtherParticipantName = (conversation: Conversation) => {
    const participant = getOtherParticipant(conversation);
    
    if (!participant) return "Unknown User";
    
    // If we have both first and last name, combine them
    if (participant.firstName && participant.lastName) {
      return `${participant.firstName} ${participant.lastName}`.trim();
    }
    
    // If we have just first name
    if (participant.firstName) {
      return participant.firstName;
    }
    
    // If we have just last name
    if (participant.lastName) {
      return participant.lastName;
    }
    
    // If we have a uid but no name, use the ID
    if (participant.uid) {
      return `User ${participant.uid.substring(0, 6)}`;
    }
    
    // Last resort fallback
    return 'Unknown User';
  };

  const getOtherParticipantProfilePicture = (conversation: Conversation) => {
    const participant = getOtherParticipant(conversation);
    return participant?.profilePicture || participant?.profileImageUrl || null;
  };

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
              alt="participant profile"
              size="sm"
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
          </div>
        </div>
      </div>

      {/* Messages Container */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-4 w-full"
        onScroll={(e) => {
          const target = e.target as HTMLDivElement;
          const isNearBottom =
            target.scrollHeight - target.scrollTop - target.clientHeight < 100;
          if (isNearBottom) {
            scrollToBottom();
          }
        }}
      >
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <LoadingSpinner />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-32">
            <p className="text-gray-500">No messages yet</p>
          </div>
        ) : (
          messages.map((message) => (
            <div key={message.id} className="flex items-start gap-3 group">
              <ProfilePicture
                src={message.senderProfilePicture}
                alt={message.senderName}
                size="sm"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-sm text-gray-900">
                    {message.senderName}
                  </span>
                  <span className="text-xs text-gray-500">
                    {message.timestamp?.toDate?.()?.toLocaleString() ||
                      "Unknown time"}
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
                    onClearConversation={onClearConversation}
                    onClaimResponse={handleClaimResponse}
                  />

                  {/* Admin Delete Button */}
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
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Admin Message Input */}
      <div className="w-full p-4 border-t border-gray-200 bg-gray-50 flex-shrink-0">
        <form onSubmit={handleSendMessage} className="flex gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message as admin..."
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={isSending}
          />
          <button
            type="submit"
            disabled={!newMessage.trim() || isSending}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSending ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              "Send"
            )}
          </button>
        </form>
        <p className="text-xs text-gray-500 mt-2">
          Messages sent as admin will be marked with [ADMIN] prefix
        </p>
      </div>
    </div>
  );
};

export default AdminChatWindow;
