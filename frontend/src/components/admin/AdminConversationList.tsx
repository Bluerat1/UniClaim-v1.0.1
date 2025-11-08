import React, { useMemo, useState, useCallback } from "react";
import { useMessage } from "@/context/MessageContext";
import { useAuth } from "@/context/AuthContext";
import type { Conversation } from "@/types/Post";
import LoadingSpinner from "@/components/layout/LoadingSpinner";
import { messageService } from "@/services/firebase/messages";
import { useToast } from "@/context/ToastContext";

// Simple button component for the mark all as read functionality

interface AdminConversationListProps {
  onSelectConversation: (conversation: Conversation) => void;
  selectedConversationId?: string;
  searchQuery?: string;
  filterType?: "all" | "unread" | "claim";
}

const AdminConversationList: React.FC<AdminConversationListProps> = ({
  onSelectConversation,
  selectedConversationId,
  searchQuery = "",
  filterType = "all",
}) => {
  const { conversations, loading } = useMessage();
  const { userData } = useAuth();
  const { showToast } = useToast();
  const [deletingConversationId, setDeletingConversationId] = useState<
    string | null
  >(null);

  const getTotalUnreadCount = useCallback(
    (conversation: Conversation) => {
      if (!conversation.unreadCounts || !userData?.uid) return 0;
      return conversation.unreadCounts[userData.uid] || 0;
    },
    [userData?.uid]
  );

  // Filter and sort conversations
  const filteredAndSortedConversations = useMemo(() => {
    let filtered = [...conversations];

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (conversation) =>
          conversation.postTitle?.toLowerCase().includes(query) ||
          Object.entries(conversation.participants || {}).some(([id, participant]) => {
            // Handle boolean case
            if (typeof participant === 'boolean') {
              return id.toLowerCase().includes(query);
            }
            // Handle object case
            return (
              participant.firstName?.toLowerCase().includes(query) ||
              participant.lastName?.toLowerCase().includes(query) ||
              id.toLowerCase().includes(query)
            );
          }) ||
          conversation.lastMessage?.text?.toLowerCase().includes(query)
      );
    }

    // Apply type filter
    if (filterType !== "all") {
      filtered = filtered.filter((conversation) => {
        switch (filterType) {
          case "unread":
            return getTotalUnreadCount(conversation) > 0;
          case "claim":
            // Check if conversation has a claim request
            return conversation.hasClaimRequest === true;
          default:
            return true;
        }
      });
    }

    // Sort by most recent message timestamp, with fallback to createdAt (newest first)
    return filtered.sort((a, b) => {
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
  }, [conversations, filterType, searchQuery]);

  const handleDeleteConversation = async (
    conversationId: string,
    event: React.MouseEvent
  ) => {
    event.stopPropagation(); // Prevent conversation selection

    if (
      !window.confirm(
        "Are you sure you want to delete this conversation? This action cannot be undone."
      )
    ) {
      return;
    }

    setDeletingConversationId(conversationId);
    try {
      await messageService.adminDeleteConversation(conversationId);
      showToast("success", "Conversation deleted successfully");
    } catch (error: any) {
      console.error("Failed to delete conversation:", error);
      showToast("error", "Failed to delete conversation: " + error.message);
    } finally {
      setDeletingConversationId(null);
    }
  };

  const getParticipantNames = (conversation: Conversation) => {
    try {
      // First try to use participantInfo if it exists
      if (conversation.participantInfo) {
        const otherParticipants = Object.entries(conversation.participantInfo)
          .filter(([id]) => id !== userData?.uid) // Filter out current admin user
          .map(([_, info]) => {
            if (!info) return null;
            
            // Handle the info object which should have displayName/photoURL or name/photo
            if (info.displayName) return info.displayName;
            if (info.name) return info.name;
            if (info.firstName || info.lastName) {
              return `${info.firstName || ''} ${info.lastName || ''}`.trim();
            }
            return 'User';
          })
          .filter(Boolean) as string[];
          
        if (otherParticipants.length > 0) {
          return otherParticipants.join(', ');
        }
      }

      // Fallback to participants object (boolean map or object with user data)
      const participantIds = Object.entries(conversation.participants || {})
        .filter(([id]) => id !== userData?.uid) // Filter out current admin user
        .map(([id, participant]) => {
          // If participant is just a boolean, return the user ID
          if (typeof participant === 'boolean') {
            return `User ${id.substring(0, 6)}`;
          }
          
          // If participant is an object with user data
          if (participant.firstName || participant.lastName) {
            return `${participant.firstName || ''} ${participant.lastName || ''}`.trim();
          }
          
          return `User ${id.substring(0, 6)}`;
        })
        .filter(name => name !== 'User System');
        
      return participantIds.join(', ') || 'Unknown User';
    } catch (error) {
      console.error('Error getting participant names:', error);
      return 'Unknown User';
    }
  };

  const getProfilePictureUrl = (participant: any, conversation: Conversation, participantId: string): string => {
    // First try to get from participantInfo
    if (conversation.participantInfo?.[participantId]) {
      const info = conversation.participantInfo[participantId];
      // Only use properties that exist in the participantInfo type
      const infoPhoto = info.photoURL || info.photo || '';
      if (infoPhoto) {
        return infoPhoto;
      }
    }
    
    // Fallback to participants object
    if (!participant || typeof participant === 'boolean') return '';
    return (
      participant.profilePicture ||
      participant.profileImageUrl ||
      participant.photoURL ||
      participant.photo ||
      participant.avatar ||
      participant.picture ||
      participant.image ||
      ''
    );
  };

  const getSenderName = (
    conversation: Conversation,
    senderId: string
  ): string => {
    // First check participantInfo
    if (conversation.participantInfo?.[senderId]) {
      const info = conversation.participantInfo[senderId];
      if (info.displayName) return info.displayName;
      if (info.name) return info.name;
      if (info.firstName || info.lastName) {
        return `${info.firstName || ''} ${info.lastName || ''}`.trim();
      }
    }

    // Then check participants
    const participant = conversation.participants?.[senderId];
    if (!participant) return `User ${senderId.substring(0, 6)}`;

    // Handle boolean case
    if (typeof participant === 'boolean') {
      return `User ${senderId.substring(0, 6)}`;
    }

    // Handle object case
    if (participant.firstName || participant.lastName) {
      return `${participant.firstName || ''} ${participant.lastName || ''}`.trim();
    }

    // Fallback to user ID
    return `User ${senderId.substring(0, 6)}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  if (filteredAndSortedConversations.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center text-gray-500 text-center">
          <div className="text-6xl mb-4">💬</div>
          <p className="text-lg font-medium">No conversations found</p>
          <p className="text-sm text-gray-400">
            Admin view - no user conversations to monitor
          </p>
        </div>
      </div>
    );
  }

  const formatTimestamp = (timestamp: any) => {
    if (!timestamp) return "";

    const date = timestamp instanceof Date ? timestamp : timestamp.toDate();
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInMinutes = diffInMs / (1000 * 60);
    const diffInHours = diffInMinutes / 60;
    const diffInDays = diffInHours / 24;
    const diffInWeeks = diffInDays / 7;
    const diffInMonths = diffInDays / 30;
    const diffInYears = diffInDays / 365;

    if (diffInMinutes < 1) {
      return "Just now";
    } else if (diffInMinutes < 60) {
      const minutes = Math.floor(diffInMinutes);
      return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
    } else if (diffInHours < 24) {
      const hours = Math.floor(diffInHours);
      return `${hours} hour${hours === 1 ? "" : "s"} ago`;
    } else if (diffInDays < 7) {
      const days = Math.floor(diffInDays);
      return `${days} day${days === 1 ? "" : "s"} ago`;
    } else if (diffInWeeks < 4.5) {
      const weeks = Math.floor(diffInWeeks);
      return `${weeks} week${weeks === 1 ? "" : "s"} ago`;
    } else if (diffInMonths < 12) {
      const months = Math.floor(diffInMonths);
      return `${months} month${months === 1 ? "" : "s"} ago`;
    } else {
      const years = Math.floor(diffInYears);
      return `${years} year${years === 1 ? "" : "s"} ago`;
    }
  };

  return (
    <div className="h-full overflow-y-auto">
      {filteredAndSortedConversations.map((conversation) => {
        const isSelected = selectedConversationId === conversation.id;
        const totalUnread = getTotalUnreadCount(conversation);
        const participantNames = getParticipantNames(conversation);

        return (
          <div
            key={conversation.id}
            className={`p-4 border-b border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors ${
              isSelected ? "bg-yellow-50 border-blue-200" : ""
            }`}
            onClick={() => onSelectConversation(conversation)}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                {/* Post Title and Type */}
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-medium text-gray-900 truncate">
                    {conversation.postTitle}
                  </h3>
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${
                      conversation.postType === "found"
                        ? "bg-green-100 text-green-800"
                        : "bg-orange-100 text-orange-800"
                    }`}
                  >
                    {conversation.postType?.toUpperCase() || "UNKNOWN"}
                  </span>
                </div>

                {/* Participants */}
                <div className="flex items-center gap-2 mb-1">
                  <div className="flex -space-x-2">
                    {Object.entries(conversation.participants || {})
                      .filter(([id]) => id !== userData?.uid) // Filter out current admin user
                      .slice(0, 3) // Show max 3 profile pictures
                      .map(([id, participant]) => {
                        const profilePictureUrl = getProfilePictureUrl(participant, conversation, id);
                        const name = getSenderName(conversation, id);
                        
                        // Skip if this is the admin user or system
                        if (name.toLowerCase().includes('admin') || name === 'User System') {
                          return null;
                        }

                        return (
                          <div
                            key={id}
                            className="w-6 h-6 rounded-full bg-gray-300 border-2 border-white overflow-hidden flex-shrink-0"
                          >
                            {profilePictureUrl ? (
                              <img
                                src={profilePictureUrl}
                                alt={`${name}'s profile`}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  // Fallback to initials if image fails to load
                                  const target = e.target as HTMLImageElement;
                                  target.style.display = 'none';
                                  const fallback = document.createElement('div');
                                  fallback.className = 'w-full h-full bg-gray-400 flex items-center justify-center text-xs text-white font-medium';
                                  fallback.textContent = (name.charAt(0) || 'U').toUpperCase();
                                  target.parentNode?.insertBefore(fallback, target.nextSibling);
                                }}
                              />
                            ) : (
                              <div className="w-full h-full bg-gray-400 flex items-center justify-center text-xs text-white font-medium">
                                {(name.charAt(0) || 'U').toUpperCase()}
                              </div>
                            )}
                          </div>
                        );
                      })}
                  </div>
                  <p className="text-sm text-gray-600 truncate">
                    {participantNames.split(',')
                      .filter(name => !name.toLowerCase().includes('admin') && name.trim() !== 'User System')
                      .join(', ')}
                  </p>
                </div>

                {/* Last Message */}
                {conversation.lastMessage && (
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-gray-500 truncate flex-1">
                      <span className="font-medium">
                        {getSenderName(
                          conversation,
                          conversation.lastMessage.senderId
                        ) || "Unknown User"}
                        :
                      </span>{" "}
                      {conversation.lastMessage.text}
                    </p>
                    <span className="text-xs text-gray-400 flex-shrink-0">
                      {formatTimestamp(conversation.lastMessage.timestamp)}
                    </span>
                  </div>
                )}

                {/* Admin Info */}
                <div className="flex items-center gap-2 mt-2">
                  {totalUnread > 0 && (
                    <span className="bg-red-100 text-red-800 text-xs px-2 py-0.5 rounded-full">
                      {totalUnread} unread
                    </span>
                  )}
                </div>
              </div>

              {/* Admin Actions */}
              <div className="flex items-center gap-2 ml-2">
                {totalUnread > 0 && (
                  <div className="w-3 h-3 bg-red-500 rounded-full flex-shrink-0"></div>
                )}
                <button
                  onClick={(e) => handleDeleteConversation(conversation.id, e)}
                  disabled={deletingConversationId === conversation.id}
                  className="p-1 text-gray-400 hover:text-red-600 transition-colors disabled:opacity-50"
                  title="Delete conversation (Admin only)"
                >
                  {deletingConversationId === conversation.id ? (
                    <div className="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default AdminConversationList;
