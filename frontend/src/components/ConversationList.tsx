import React, { useEffect, useMemo, useState } from "react";
import { useMessage } from "../context/MessageContext";
import { useAuth } from "../context/AuthContext";
import type { Conversation } from "../types/Post";
import LoadingSpinner from "./LoadingSpinner";
import ProfilePicture from "./ProfilePicture";
import { useSearchParams } from "react-router-dom";

interface ConversationListProps {
  onSelectConversation: (conversation: Conversation | null) => void;
  selectedConversationId?: string;
}

const ConversationList: React.FC<ConversationListProps> = ({
  onSelectConversation,
  selectedConversationId,
}) => {
  const { conversations, loading } = useMessage();
  const { userData } = useAuth();
  const [searchParams] = useSearchParams();
  const conversationIdFromUrl = searchParams.get("conversation");

  // Auto-select conversation from URL on initial load only
  useEffect(() => {
    // Only auto-select if we have a URL parameter, conversations are loaded,
    // and no conversation is currently selected
    if (
      conversationIdFromUrl &&
      conversations.length > 0 &&
      !selectedConversationId
    ) {
      console.log(
        "Auto-selecting conversation from URL:",
        conversationIdFromUrl
      );
      const conversation = conversations.find(
        (c) => c.id === conversationIdFromUrl
      );
      if (conversation) {
        onSelectConversation(conversation);
      }
    }
  }, [
    conversationIdFromUrl,
    conversations,
    selectedConversationId,
    onSelectConversation,
  ]);

  // Prevent auto-selection when conversation is explicitly cleared
  const [isUserClearing, setIsUserClearing] = useState(false);

  useEffect(() => {
    if (!selectedConversationId && !conversationIdFromUrl) {
      setIsUserClearing(true);
      // Reset the flag after a short delay
      setTimeout(() => setIsUserClearing(false), 100);
    }
  }, [selectedConversationId, conversationIdFromUrl]);

  // Modified auto-selection that respects user clearing
  useEffect(() => {
    if (
      conversationIdFromUrl &&
      conversations.length > 0 &&
      !selectedConversationId &&
      !isUserClearing
    ) {
      console.log(
        "Auto-selecting conversation from URL:",
        conversationIdFromUrl
      );
      const conversation = conversations.find(
        (c) => c.id === conversationIdFromUrl
      );
      if (conversation) {
        onSelectConversation(conversation);
      }
    }
  }, [
    conversationIdFromUrl,
    conversations,
    selectedConversationId,
    isUserClearing,
    onSelectConversation,
  ]);

  // Handle conversation selection
  const handleConversationClick = (conversation: Conversation) => {
    onSelectConversation(conversation);
  };

  // Sort conversations by most recent message timestamp, with fallback to createdAt (newest first)
  const sortedConversations = useMemo(() => {
    return [...conversations].sort((a, b) => {
      // Helper function to get a comparable timestamp
      const getComparableTimestamp = (conversation: any) => {
        // First try to get timestamp from last message
        if (conversation.lastMessage?.timestamp) {
          const lastMessageTime = conversation.lastMessage.timestamp;
          // Handle Firestore Timestamp objects
          if (
            lastMessageTime.toDate &&
            typeof lastMessageTime.toDate === "function"
          ) {
            return lastMessageTime.toDate().getTime();
          }
          // Handle regular Date objects
          if (lastMessageTime instanceof Date) {
            return lastMessageTime.getTime();
          }
          // Handle numeric timestamps
          if (typeof lastMessageTime === "number") {
            return lastMessageTime;
          }
        }

        // Fallback to conversation creation time
        if (conversation.createdAt) {
          const createdAt = conversation.createdAt;
          if (createdAt.toDate && typeof createdAt.toDate === "function") {
            return createdAt.toDate().getTime();
          }
          if (createdAt instanceof Date) {
            return createdAt.getTime();
          }
          if (typeof createdAt === "number") {
            return createdAt;
          }
        }

        // Final fallback to 0 (oldest)
        return 0;
      };

      const aTimestamp = getComparableTimestamp(a);
      const bTimestamp = getComparableTimestamp(b);

      // Sort newest first (descending order)
      return bTimestamp - aTimestamp;
    });
  }, [conversations]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  if (sortedConversations.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center text-gray-500 text-center">
          <div className="text-6xl mb-4">💬</div>
          <p className="text-lg font-medium">No conversations yet</p>
          <p className="text-sm text-gray-400">
            Start chatting about lost and found items!
          </p>
        </div>
      </div>
    );
  }

  const formatTimestamp = (timestamp: any) => {
    if (!timestamp) return "";

    const date = timestamp instanceof Date ? timestamp : timestamp.toDate();
    const now = new Date();
    const diffInMinutes = (now.getTime() - date.getTime()) / (1000 * 60);
    const diffInHours = diffInMinutes / 60;

    if (diffInMinutes < 1) return "Just now";
    if (diffInMinutes < 60) return `${Math.floor(diffInMinutes)}m`;
    if (diffInHours < 24) return `${Math.floor(diffInHours)}h ago`;
    if (diffInHours < 48) return "Yesterday";
    return date.toLocaleDateString();
  };

  // Get the other participant's name (exclude current user)
  const getOtherParticipantName = (
    conversation: Conversation,
    currentUserId: string
  ) => {
    const otherParticipants = Object.entries(conversation.participants)
      .filter(([uid]) => uid !== currentUserId) // Exclude current user
      .map(([, participant]) =>
        `${participant.firstName} ${participant.lastName}`.trim()
      )
      .filter((name) => name.length > 0);

    return otherParticipants.length > 0
      ? otherParticipants.join(", ")
      : "Unknown User";
  };

  // Get the other participant's profile picture (exclude current user)
  const getOtherParticipantProfilePicture = (
    conversation: Conversation,
    currentUserId: string
  ) => {
    const otherParticipant = Object.entries(conversation.participants).find(
      ([uid]) => uid !== currentUserId
    );

    return otherParticipant
      ? otherParticipant[1].profilePicture ||
          otherParticipant[1].profileImageUrl
      : null;
  };

  // Get the name of the user who sent the last message
  const getLastMessageSenderName = (
    conversation: Conversation,
    currentUserId: string
  ) => {
    if (!conversation.lastMessage?.senderId) return "Unknown User";

    // If the sender is the current user
    if (conversation.lastMessage.senderId === currentUserId) {
      return "You";
    }

    // Find the sender in participants
    const sender = Object.entries(conversation.participants).find(
      ([uid]) => uid === conversation.lastMessage?.senderId
    );

    if (sender) {
      const firstName = sender[1].firstName || "";
      const lastName = sender[1].lastName || "";
      return `${firstName} ${lastName}`.trim() || "Unknown User";
    }

    return "Unknown User";
  };

  return (
    <div className="bg-gray-50 border-r border-gray-200 h-full flex flex-col">
      <div className="pl-7 pr-4 py-3 border-b border-gray-200 flex-shrink-0">
        <h1 className="text-xl font-semibold">Contacts</h1>
        <p className="text-sm text-gray-500">
          {sortedConversations.length} conversation
          {sortedConversations.length !== 1 ? "s" : ""}
        </p>
      </div>

      <div className="overflow-y-auto flex-1">
        {sortedConversations.map((conversation) => {
          const isSelected = selectedConversationId === conversation.id;
          // Get the current user's unread count from this conversation
          const hasUnread =
            conversation.unreadCounts?.[userData?.uid || ""] > 0;

          return (
            <div
              key={conversation.id}
              onClick={() => handleConversationClick(conversation)}
              className={`p-4 border-b border-gray-100 cursor-pointer transition-colors hover:bg-zinc-100 ${
                isSelected
                  ? "bg-brand/10 border-l-3 border-l-brand"
                  : "hover:bg-brand/10"
              }`}
            >
              <div className="flex items-start justify-between mb-2 pl-3">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="relative flex-shrink-0">
                    <ProfilePicture
                      src={
                        userData
                          ? getOtherParticipantProfilePicture(
                              conversation,
                              userData.uid
                            )
                          : null
                      }
                      alt="participant profile"
                      className="flex-shrink-0 size-9"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-gray-900 truncate">
                        {conversation.postTitle}
                      </h3>
                      {/* Post Type Badge */}
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold flex-shrink-0 ml-1 ${
                          conversation.postType === "found"
                            ? "bg-green-200 text-green-800"
                            : "bg-orange-300 text-orange-800"
                        }`}
                      >
                        {conversation.postType === "found" ? "FOUND" : "LOST"}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 truncate">
                      {userData
                        ? getOtherParticipantName(conversation, userData.uid)
                        : "Unknown User"}
                    </p>
                  </div>
                </div>
                {hasUnread && (
                  <div className=" mr-5 mt-7 w-2 h-2 bg-blue-500 rounded-full" />
                )}
              </div>

              {conversation.lastMessage ? (
                <div className="flex items-center justify-between pl-3">
                  <div className="flex-1 min-w-0 mr-2">
                    <p
                      className={`text-sm truncate ${
                        hasUnread
                          ? "font-semibold text-gray-800"
                          : "text-gray-600"
                      }`}
                    >
                      <span className="font-medium">
                        {userData
                          ? getLastMessageSenderName(conversation, userData.uid)
                          : "Unknown User"}
                      </span>
                      {conversation.lastMessage?.text &&
                        `: ${conversation.lastMessage.text}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-gray-400 whitespace-nowrap">
                      {formatTimestamp(conversation.lastMessage.timestamp)}
                    </span>
                    {conversation.lastMessage.senderId !== userData?.uid && (
                      <span className="text-xs">
                        {conversation.lastMessage.readBy &&
                        conversation.lastMessage.readBy.includes(
                          userData?.uid || ""
                        ) ? (
                          <span className="text-blue-500" title="Seen">
                            <svg
                              className="w-3 h-3"
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                              <path
                                fillRule="evenodd"
                                d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z"
                                clipRule="evenodd"
                              />
                            </svg>
                          </span>
                        ) : (
                          <span className="text-gray-400" title="Not seen">
                            <svg
                              className="w-3 h-3"
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path
                                fillRule="evenodd"
                                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                clipRule="evenodd"
                              />
                            </svg>
                          </span>
                        )}
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between pl-3">
                  <p className="text-sm text-gray-400 italic">
                    No messages yet
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ConversationList;
