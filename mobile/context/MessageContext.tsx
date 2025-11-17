import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
  type ReactNode,
} from "react";
import { messageService } from "../utils/firebase";
import type { Conversation, Message } from "../types/type";

interface MessageContextType {
  conversations: Conversation[];
  loading: boolean;
  totalUnreadCount: number; // Add total unread count like web version
  sendMessage: (
    conversationId: string,
    senderId: string,
    senderName: string,
    text: string,
    senderProfilePicture?: string
  ) => Promise<void>;
  createConversation: (
    postId: string,
    postTitle: string,
    postOwnerId: string,
    currentUserId: string,
    currentUserData: any,
    postOwnerUserData: any,
    postType: "lost" | "found",
    postStatus: "pending" | "resolved" | "unclaimed",
    foundAction: "keep" | "turnover to OSA" | "turnover to Campus Security" | null,
    greetingText: string
  ) => Promise<string>;
  getConversationMessages: (
    conversationId: string,
    callback: (messages: Message[]) => void,
    limit?: number
  ) => () => void;
  getOlderMessages: (
    conversationId: string,
    lastMessageTimestamp: any,
    limit?: number
  ) => Promise<Message[]>;
  getConversation: (conversationId: string) => Promise<any>;
  deleteMessage: (conversationId: string, messageId: string, userId: string) => Promise<void>;
  markMessageAsRead: (
    conversationId: string,
    messageId: string,
    userId: string
  ) => Promise<void>;
  hasUnreadMessages: (conversationId: string, userId: string) => Promise<boolean>;
  markAllUnreadMessagesAsRead: (
    conversationId: string,
    userId: string
  ) => Promise<boolean>;
  sendHandoverRequest: (
    conversationId: string,
    senderId: string,
    senderName: string,
    senderProfilePicture: string,
    postId: string,
    postTitle: string,
    handoverReason?: string,
    idPhotoUrl?: string,
    itemPhotos?: { url: string; uploadedAt: any; description?: string }[]
  ) => Promise<void>;
  updateHandoverResponse: (
    conversationId: string,
    messageId: string,
    status: "accepted" | "rejected",
    idPhotoUrl?: string
  ) => Promise<void>;
  confirmHandoverIdPhoto: (
    conversationId: string,
    messageId: string,
    userId: string
  ) => Promise<void>;
  sendClaimRequest: (
    conversationId: string,
    senderId: string,
    senderName: string,
    senderProfilePicture: string,
    postId: string,
    postTitle: string,
    claimReason?: string,
    idPhotoUrl?: string,
    evidencePhotos?: { url: string; uploadedAt: any; description?: string }[]
  ) => Promise<void>;
  updateClaimResponse: (
    conversationId: string,
    messageId: string,
    status: "accepted" | "rejected",
    userId: string,
    idPhotoUrl?: string
  ) => Promise<void>;
  confirmClaimIdPhoto: (
    conversationId: string,
    messageId: string,
    userId: string
  ) => Promise<void>;
  listenToParticipantProfile: (
    participantId: string,
    onUpdate: (participant: any) => void
  ) => () => void;
  updateParticipantProfileInConversation: (
    conversationId: string,
    participantId: string,
    data: any
  ) => Promise<void>;
  refreshConversations: () => Promise<void>;
  markConversationAsRead: (
    conversationId: string,
    userId: string
  ) => Promise<void>;
  getUnreadConversationCount: (userId: string) => number;
  getTotalUnreadMessageCount: (userId: string) => number;
  getConversationUnreadCount: (
    conversationId: string,
    userId: string
  ) => number;
  getUnreadConversationsSummary: (userId: string) => {
    count: number;
    conversations: Array<{
      id: string;
      postTitle: string;
      unreadCount: number;
      lastMessage?: any;
    }>;
  };
  deleteConversation: (conversationId: string, userId: string) => Promise<{ success: boolean; error?: string }>;
}

const MessageContext = createContext<MessageContextType | undefined>(undefined);

export const MessageProvider = ({
  children,
  userId,
  isAuthenticated,
}: {
  children: ReactNode;
  userId: string | null;
  isAuthenticated: boolean;
}) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalUnreadCount, setTotalUnreadCount] = useState(0);
  const profileListeners = useRef<Record<string, () => void>>({});
  const userDataCache = useRef<Record<string, any>>({});
  const unsubscribeRef = useRef<() => void>(() => {});

  // Message service methods
  const sendMessage = useCallback(
    async (conversationId: string, senderId: string, senderName: string, text: string, senderProfilePicture?: string) => {
      return messageService.sendMessage(conversationId, senderId, senderName, text, senderProfilePicture);
    },
    []
  );

  const createConversation = useCallback(
    async (
      postId: string,
      postTitle: string,
      postOwnerId: string,
      currentUserId: string,
      currentUserData: any,
      postOwnerUserData: any,
      postType: "lost" | "found",
      postStatus: "pending" | "resolved" | "unclaimed",
      foundAction: "keep" | "turnover to OSA" | "turnover to Campus Security" | null,
      greetingText: string
    ) => {
      return messageService.createConversation(
        postId,
        postTitle,
        postOwnerId,
        currentUserId,
        currentUserData,
        postOwnerUserData,
        postType,
        postStatus,
        foundAction,
        greetingText
      );
    },
    []
  );

  const getConversationMessages = useCallback(
    (conversationId: string, callback: (messages: any[]) => void, messageLimit?: number) => {
      return messageService.getConversationMessages(conversationId, callback, messageLimit);
    },
    []
  );

  const getOlderMessages = useCallback(
    (conversationId: string, lastMessageTimestamp: any, messageLimit?: number) => {
      return messageService.getOlderMessages(conversationId, lastMessageTimestamp, messageLimit);
    },
    []
  );

  const getConversation = useCallback(
    (conversationId: string) => {
      return messageService.getConversation(conversationId);
    },
    []
  );

  const deleteMessage = useCallback(
    (conversationId: string, messageId: string, userId: string) => {
      return messageService.deleteMessage(conversationId, messageId, userId);
    },
    []
  );

  const markMessageAsRead = useCallback(
    async (conversationId: string, messageId: string, userId: string) => {
      try {
        await messageService.markMessageAsRead(conversationId, messageId, userId);
      } catch (error) {
        console.error('Error marking message as read:', error);
        throw error;
      }
    },
    []
  );

  const hasUnreadMessages = useCallback(
    (conversationId: string, userId: string) => {
      return messageService.hasUnreadMessages(conversationId, userId);
    },
    []
  );

  const markAllUnreadMessagesAsRead = useCallback(
    async (conversationId: string, userId: string) => {
      return messageService.markAllUnreadMessagesAsRead(conversationId, userId);
    },
    []
  );

  useEffect(() => {
    if (!userId || !isAuthenticated) {
      setConversations([]);
      setLoading(false);
      return;
    }

    let isSubscribed = true;
    setLoading(true);

    const loadConversations = async () => {
      try {
        // First, get the current conversations
        const initialConversations =
          await messageService.getCurrentConversations(userId);

        if (!isSubscribed) return;

        // Process initial conversations to update cache
        initialConversations.forEach((conv) => {
          Object.entries(conv.participants || {}).forEach(([uid, data]) => {
            if (data && typeof data === "object" && uid !== userId) {
              userDataCache.current[uid] = data;
            }
          });
        });

        // Set initial conversations
        setConversations(initialConversations);

        // Clear any existing unsubscribe function
        if (typeof unsubscribeRef.current === "function") {
          unsubscribeRef.current();
          unsubscribeRef.current = () => {};
        }

        // Set up real-time listener
        const unsubscribe = messageService.getUserConversations(
          userId,
          (updatedConversations) => {
            if (!isSubscribed) return;

            // Process conversations and update cache
            const processed = updatedConversations.map((conv) => {
              const participants = conv.participants || {};
              Object.entries(participants).forEach(([uid, data]) => {
                if (uid === userId || !data || typeof data !== "object") {
                  return;
                }

                const cached = userDataCache.current[uid] || {};
                const merged = { ...cached, ...data };
                const hasPhotoChanged = cached.photoURL !== merged.photoURL;

                userDataCache.current[uid] = merged;

                if (hasPhotoChanged && profileListeners.current[uid]) {
                  // Trigger listener update so consumers get the new avatar
                  profileListeners.current[uid]!();
                  delete profileListeners.current[uid];
                }
              });
              return { ...conv, participants };
            });

            // Only update if conversations actually changed (shallow comparison)
            setConversations((prevConversations) => {
              // Check if the new data is meaningfully different
              if (prevConversations.length !== processed.length) {
                return processed;
              }

              // Quick check: compare IDs and update times
              const hasChanges = processed.some((newConv, idx) => {
                const prevConv = prevConversations[idx];
                return (
                  !prevConv ||
                  newConv.id !== prevConv.id ||
                  newConv.updatedAt !== prevConv.updatedAt ||
                  newConv.lastMessage?.text !== prevConv.lastMessage?.text
                );
              });

              return hasChanges ? processed : prevConversations;
            });
          }
        );

        // Store the unsubscribe function
        unsubscribeRef.current = unsubscribe;
      } catch (error) {
        console.error("Error loading conversations:", error);
      } finally {
        if (isSubscribed) {
          setLoading(false);
        }
      }
    };

    loadConversations();

    // Cleanup function
    return () => {
      isSubscribed = false;
      if (typeof unsubscribeRef.current === "function") {
        try {
          unsubscribeRef.current();
        } catch (error) {
          console.warn("Error unsubscribing from conversations:", error);
        }
        unsubscribeRef.current = () => {};
      }
    };
  }, [userId, isAuthenticated]);

  const listenToParticipantProfile = useCallback(
    (participantId: string, onUpdate: (participant: any) => void): (() => void) => {
      if (!participantId) return () => {};

      // Reuse existing listener if already active
      if (profileListeners.current[participantId]) {
        const cachedData = userDataCache.current[participantId];
        if (cachedData) {
          onUpdate(cachedData);
        }
        return profileListeners.current[participantId] || (() => {});
      }

      let unsubscribe: (() => void) | null = null;

      const startListener = async () => {
        try {
          const { doc, onSnapshot } = await import("firebase/firestore");
          const { db } = await import("../utils/firebase/config");
          const userRef = doc(db, "users", participantId);

          unsubscribe = onSnapshot(
            userRef,
            (snapshot) => {
              if (!snapshot.exists()) return;
              const userData = snapshot.data();
              userDataCache.current[participantId] = {
                ...userDataCache.current[participantId],
                ...userData,
              };
              onUpdate(userDataCache.current[participantId]);
            },
            (error) => {
              console.error("Participant listener error:", error);
            }
          );

          if (unsubscribe) {
            profileListeners.current[participantId] = () => {
              unsubscribe?.();
              delete profileListeners.current[participantId];
            };
          }
        } catch (error) {
          console.error("Failed to start participant listener:", error);
        }
      };

      startListener();

      return () => {
        profileListeners.current[participantId]?.();
      };
    },
    []
  );

  const confirmHandoverIdPhoto = useCallback(
    async (
      conversationId: string,
      messageId: string,
      userId: string
    ): Promise<void> => {
      try {
        const result = await messageService.confirmHandoverIdPhoto(
          conversationId,
          messageId,
          userId
        );
        if (!result.success) {
          throw new Error(
            result.error || "Failed to confirm handover ID photo"
          );
        }
      } catch (error: any) {
        throw new Error(error.message || "Failed to confirm handover ID photo");
      }
    },
    []
  );

  const updateHandoverResponse = useCallback(
    async (
      conversationId: string,
      messageId: string,
      status: "accepted" | "rejected",
      idPhotoUrl?: string
    ): Promise<void> => {
      try {
        await messageService.updateHandoverResponse(
          conversationId,
          messageId,
          status,
          userId!,
          idPhotoUrl
        );
      } catch (error: any) {
        throw new Error(error.message || "Failed to update handover response");
      }
    },
    [userId]
  );

  const sendHandoverRequest = useCallback(
    async (
      conversationId: string,
      senderId: string,
      senderName: string,
      senderProfilePicture: string,
      postId: string,
      postTitle: string,
      handoverReason?: string,
      idPhotoUrl?: string,
      itemPhotos?: { url: string; uploadedAt: any; description?: string }[]
    ): Promise<void> => {
      try {
        await messageService.sendHandoverRequest(
          conversationId,
          senderId,
          senderName,
          senderProfilePicture,
          postId,
          postTitle,
          handoverReason,
          idPhotoUrl,
          itemPhotos
        );
      } catch (error: any) {
        throw new Error(error.message || "Failed to send handover request");
      }
    },
    []
  );

  const sendClaimRequest = useCallback(
    async (
      conversationId: string,
      senderId: string,
      senderName: string,
      senderProfilePicture: string,
      postId: string,
      postTitle: string,
      claimReason?: string,
      idPhotoUrl?: string,
      evidencePhotos?: { url: string; uploadedAt: any; description?: string }[]
    ): Promise<void> => {
      try {
        await messageService.sendClaimRequest(
          conversationId,
          senderId,
          senderName,
          senderProfilePicture,
          postId,
          postTitle,
          claimReason,
          idPhotoUrl,
          evidencePhotos
        );
      } catch (error: any) {
        throw new Error(error.message || "Failed to send claim request");
      }
    },
    []
  );

  const updateParticipantProfileInConversation = useCallback(
    async (conversationId: string, participantId: string, data: any) => {
      if (!conversationId || !participantId) return;
      try {
        const participant = {
          ...(typeof data === "object" ? data : {}),
        };

        await messageService.updateConversationParticipant(
          conversationId,
          participantId,
          participant
        );

        userDataCache.current[participantId] = {
          ...userDataCache.current[participantId],
          ...participant,
        };
      } catch (error) {
        console.error(
          "Failed to update participant profile in conversation:",
          error
        );
      }
    },
    []
  );

  const updateClaimResponse = useCallback(
    async (
      conversationId: string,
      messageId: string,
      status: "accepted" | "rejected",
      userId: string,
      idPhotoUrl?: string
    ): Promise<void> => {
      try {
        await messageService.updateClaimResponse(
          conversationId,
          messageId,
          status,
          userId,
          idPhotoUrl
        );
      } catch (error: any) {
        throw new Error(error.message || "Failed to update claim response");
      }
    },
    []
  );

  const confirmClaimIdPhoto = useCallback(
    async (
      conversationId: string,
      messageId: string,
      userId: string
    ): Promise<void> => {
      try {
        const result = await messageService.confirmClaimIdPhoto(
          conversationId,
          messageId,
          userId
        );
        if (!result.success) {
          console.error(
            "❌ Mobile MessageContext: confirmClaimIdPhoto failed:",
            result.error
          );
          throw new Error(result.error || "Failed to confirm claim ID photo");
        }
      } catch (error: any) {
        console.error(
          "❌ Mobile MessageContext: confirmClaimIdPhoto failed:",
          error
        );
        throw new Error(error.message || "Failed to confirm claim ID photo");
      }
    },
    []
  );

  // Mark a conversation as read
  const markConversationAsRead = useCallback(
    async (conversationId: string, userId: string): Promise<void> => {
      if (!userId || !conversationId) return;

      try {
        // Update the conversation's unread count for this user
        await messageService.markConversationAsRead(conversationId, userId);

        // Update local state to reflect the change
        setConversations((prevConversations) =>
          prevConversations.map((conv) =>
            conv.id === conversationId
              ? { 
                  ...conv, 
                  unreadCounts: { ...conv.unreadCounts, [userId]: 0 },
                  updatedAt: new Date().toISOString() // Add updatedAt timestamp
                }
              : conv
          )
        );
      } catch (error: any) {
        console.error("Failed to mark conversation as read:", error);
        // Don't throw error - just log it
      }
    },
    []
  );

  // Refresh function that fetches current conversations
  const refreshConversations = useCallback(async (): Promise<void> => {
    if (!userId || !isAuthenticated) {
      setConversations([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const conversations = await messageService.getCurrentConversations(
        userId
      );
      setConversations(conversations);
    } catch (error: any) {
      console.error("Failed to refresh conversations:", error);
    } finally {
      setLoading(false);
    }
  }, [userId, isAuthenticated]);

  // Get count of conversations with unread messages for a specific user
  const getUnreadConversationCount = (userId: string): number => {
    if (!userId) return 0;

    return conversations.filter((conv) => conv.unreadCounts?.[userId] > 0)
      .length;
  };

  // Get total count of unread messages for a specific user (optional - for future use)
  const getTotalUnreadMessageCount = (userId: string): number => {
    if (!userId) return 0;

    return conversations.reduce(
      (total, conv) => total + (conv.unreadCounts?.[userId] || 0),
      0
    );
  };

  // Get unread count for a specific conversation (useful for chat headers)
  const getConversationUnreadCount = (
    conversationId: string,
    userId: string
  ): number => {
    if (!userId) return 0;

    const conversation = conversations.find(
      (conv) => conv.id === conversationId
    );
    return conversation?.unreadCounts?.[userId] || 0;
  };

  // Get unread conversations summary (useful for notifications or other UI elements)
  const getUnreadConversationsSummary = (userId: string) => {
    if (!userId) return { count: 0, conversations: [] };

    const unreadConversations = conversations.filter(
      (conv) => conv.unreadCounts?.[userId] > 0
    );

    return {
      count: unreadConversations.length,
      conversations: unreadConversations.map((conv) => ({
        id: conv.id,
        postTitle: conv.postTitle,
        unreadCount: conv.unreadCounts?.[userId] || 0,
        lastMessage: conv.lastMessage,
      })),
    };
  };

  // Delete conversation implementation with debug logging
  const deleteConversation = useCallback(async (conversationId: string, userId: string) => {
    const debugLog = (message: string, data?: any) => {
      console.log(`[deleteConversation] ${message}`, data || '');
    };

    debugLog('Starting deletion', { conversationId, userId });
    
    if (!conversationId || !userId) {
      const error = 'Missing conversation ID or user ID';
      debugLog('Validation failed', { error });
      return { success: false, error };
    }

    try {
      // Log current state before optimistic update
      debugLog('Current conversations before deletion', {
        conversationIds: conversations.map(c => c.id),
        targetConversation: conversations.find(c => c.id === conversationId)
      });

      // Optimistically update the UI
      debugLog('Performing optimistic UI update');
      setConversations(prev => {
        const updated = prev.filter(c => c.id !== conversationId);
        debugLog('Updated conversations after optimistic update', {
          previousCount: prev.length,
          newCount: updated.length,
          removed: prev.length - updated.length
        });
        return updated;
      });
      
      // Call the message service to handle the deletion in Firestore
      debugLog('Calling messageService.deleteConversation');
      const result = await messageService.deleteConversation(conversationId, userId);
      
      if (!result.success) {
        debugLog('Deletion failed, refreshing conversations', { result });
        // If the deletion failed, refresh the conversations to restore the previous state
        await refreshConversations();
        debugLog('Conversations refreshed after failed deletion');
        return result;
      }
      
      debugLog('Deletion completed successfully');
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      debugLog('Error in deleteConversation', { error: errorMessage });
      console.error('Error in deleteConversation:', error);
      
      // If there was an error, refresh the conversations to restore the previous state
      debugLog('Refreshing conversations after error');
      try {
        await refreshConversations();
        debugLog('Conversations refreshed after error');
      } catch (refreshError) {
        debugLog('Error refreshing conversations', { error: refreshError });
        console.error('Error refreshing conversations:', refreshError);
      }
      
      return { 
        success: false, 
        error: errorMessage
      };
    }
  }, [markConversationAsRead, refreshConversations]);


  return (
    <MessageContext.Provider
      value={{
        conversations,
        loading,
        totalUnreadCount,
        sendMessage,
        createConversation,
        getConversationMessages,
        getOlderMessages,
        getConversation,
        deleteMessage,
        markMessageAsRead,
        hasUnreadMessages,
        markAllUnreadMessagesAsRead,
        deleteConversation,
        sendHandoverRequest,
        updateHandoverResponse,
        confirmHandoverIdPhoto,
        sendClaimRequest,
        updateClaimResponse,
        confirmClaimIdPhoto,
        refreshConversations,
        markConversationAsRead,
        getUnreadConversationCount,
        getTotalUnreadMessageCount,
        getConversationUnreadCount,
        getUnreadConversationsSummary,
        listenToParticipantProfile,
        updateParticipantProfileInConversation,
      }}
    >
      {children}
    </MessageContext.Provider>
  );
};

export const useMessage = () => {
  const context = useContext(MessageContext);
  if (!context) {
    throw new Error("useMessage must be used within MessageProvider");
  }
  return context;
};
