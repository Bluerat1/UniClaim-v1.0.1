import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { messageService } from "../utils/firebase";
import type { Conversation, Message } from "@/types/Post";

interface MessageContextType {
  conversations: Conversation[];
  loading: boolean;
  totalUnreadCount: number;
  sendMessage: (conversationId: string, senderId: string, senderName: string, text: string, senderProfilePicture?: string) => Promise<void>;
  createConversation: (postId: string, postTitle: string, postOwnerId: string, currentUserId: string, currentUserData: any, postOwnerUserData?: any) => Promise<string>;
  getConversationMessages: (conversationId: string, callback: (messages: Message[]) => void) => () => void;
  getUserConversations: (userId: string, callback: (conversations: any[]) => void) => () => void;
  markConversationAsRead: (conversationId: string) => Promise<void>;
  markMessageAsRead: (conversationId: string, messageId: string) => Promise<void>;
  markAllUnreadMessagesAsRead: (conversationId: string) => Promise<void>;
  deleteMessage: (conversationId: string, messageId: string) => Promise<void>;
  updateHandoverResponse: (conversationId: string, messageId: string, status: 'accepted' | 'rejected') => Promise<void>;
  confirmHandoverIdPhoto: (conversationId: string, messageId: string) => Promise<{ success: boolean; conversationDeleted: boolean; postId?: string; error?: string }>;
  sendClaimRequest: (conversationId: string, senderId: string, senderName: string, senderProfilePicture: string, postId: string, postTitle: string, postType: 'lost' | 'found', claimReason?: string, idPhotoUrl?: string, evidencePhotos?: { url: string; uploadedAt: any; description?: string }[]) => Promise<void>;
  updateClaimResponse: (conversationId: string, messageId: string, status: 'accepted' | 'rejected') => Promise<void>;
  confirmClaimIdPhoto: (conversationId: string, messageId: string) => Promise<void>;
  refreshConversations: () => Promise<void>;
}

const MessageContext = createContext<MessageContextType | undefined>(undefined);

export const MessageProvider = ({ children, userId }: { children: ReactNode; userId: string | null }) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  // Calculate total unread count for the current user
  const totalUnreadCount = conversations.reduce((total, conv) => {
    const userUnreadCount = conv.unreadCounts?.[userId || ''] || 0;
    return total + userUnreadCount;
  }, 0);

  // Load user conversations
  useEffect(() => {
    if (!userId) {
      setConversations([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const unsubscribe = messageService.getUserConversations(userId, (loadedConversations) => {
      setConversations(loadedConversations);
      setLoading(false);
    }, (error) => {
      console.error('MessageContext: Listener error:', error);
      setLoading(false);

      if (error?.code === 'permission-denied' || error?.code === 'not-found') {
        refreshConversations();
      }
    });

    return () => {
      unsubscribe();
    };
  }, [userId]);

  const sendMessage = async (conversationId: string, senderId: string, senderName: string, text: string, senderProfilePicture?: string): Promise<void> => {
    try {
      await messageService.sendMessage(conversationId, senderId, senderName, text, senderProfilePicture);
    } catch (error: any) {
      throw new Error(error.message || 'Failed to send message');
    }
  };

  const createConversation = async (postId: string, postTitle: string, postOwnerId: string, currentUserId: string, currentUserData: any, postOwnerUserData?: any): Promise<string> => {
    try {
      return await messageService.createConversation(postId, postTitle, postOwnerId, currentUserId, currentUserData, postOwnerUserData);
    } catch (error: any) {
      throw new Error(error.message || 'Failed to create conversation');
    }
  };

  const getConversationMessages = (conversationId: string, callback: (messages: Message[]) => void) => {
    return messageService.getConversationMessages(conversationId, callback);
  };

  const getUserConversations = (userId: string, callback: (conversations: any[]) => void) => {
    return messageService.getUserConversations(userId, callback);
  };

  const markConversationAsRead = async (conversationId: string): Promise<void> => {
    if (!conversationId || conversationId.trim() === '') {
      console.log('🛡️ markConversationAsRead: Skipping - conversationId is empty or null');
      return;
    }

    try {
      await messageService.markConversationAsRead(conversationId, userId!);
    } catch (error: any) {
      if (error.message?.includes('No document to update') ||
          error.message?.includes('not-found') ||
          error.code === 'not-found') {
        console.log('🛡️ markConversationAsRead: Conversation no longer exists, skipping silently');
        return;
      }

      console.error('❌ Failed to mark conversation as read:', error);
      throw new Error(error.message || 'Failed to mark conversation as read');
    }
  };

  const markMessageAsRead = async (conversationId: string, messageId: string): Promise<void> => {
    if (!conversationId || conversationId.trim() === '' || !messageId || messageId.trim() === '') {
      console.log('🛡️ markMessageAsRead: Skipping - conversationId or messageId is empty or null');
      return;
    }

    try {
      await messageService.markMessageAsRead(conversationId, messageId, userId!);
    } catch (error: any) {
      if (error.message?.includes('No document to update') ||
          error.message?.includes('not-found') ||
          error.code === 'not-found') {
        console.log('🛡️ markMessageAsRead: Conversation or message no longer exists, skipping silently');
        return;
      }

      console.error('❌ Failed to mark message as read:', error);
      throw new Error(error.message || 'Failed to mark message as read');
    }
  };

  const markAllUnreadMessagesAsRead = async (conversationId: string): Promise<void> => {
    if (!userId || !conversationId || conversationId.trim() === '') {
      console.log('🛡️ markAllUnreadMessagesAsRead: Skipping - userId or conversationId is empty');
      return;
    }

    try {
      await messageService.markAllUnreadMessagesAsRead(conversationId, userId);
    } catch (error: any) {
      if (error.message?.includes('No document to update') ||
          error.message?.includes('not-found') ||
          error.code === 'not-found') {
        console.log('🛡️ markAllUnreadMessagesAsRead: Conversation no longer exists, skipping silently');
        return;
      }

      console.error('❌ Failed to mark all unread messages as read:', error);
      throw new Error(error.message || 'Failed to mark all unread messages as read');
    }
  };

  const deleteMessage = async (conversationId: string, messageId: string): Promise<void> => {
    if (!userId || !conversationId || !messageId) {
      throw new Error('Invalid parameters for deleteMessage');
    }

    try {
      await messageService.deleteMessage(conversationId, messageId, userId);
    } catch (error: any) {
      throw new Error(error.message || 'Failed to delete message');
    }
  };

  const updateHandoverResponse = async (conversationId: string, messageId: string, status: 'accepted' | 'rejected'): Promise<void> => {
    if (!userId || !conversationId || !messageId) {
      throw new Error('Invalid parameters for updateHandoverResponse');
    }

    try {
      await messageService.updateHandoverResponse(conversationId, messageId, status, userId);
    } catch (error: any) {
      throw new Error(error.message || 'Failed to update handover response');
    }
  };

  const confirmHandoverIdPhoto = async (conversationId: string, messageId: string): Promise<{ success: boolean; conversationDeleted: boolean; postId?: string; error?: string }> => {
    if (!userId || !conversationId || !messageId) {
      throw new Error('Invalid parameters for confirmHandoverIdPhoto');
    }

    try {
      return await messageService.confirmHandoverIdPhoto(conversationId, messageId, userId);
    } catch (error: any) {
      throw new Error(error.message || 'Failed to confirm handover ID photo');
    }
  };

  const sendClaimRequest = async (conversationId: string, senderId: string, senderName: string, senderProfilePicture: string, postId: string, postTitle: string, postType: 'lost' | 'found', claimReason?: string, idPhotoUrl?: string, evidencePhotos?: { url: string; uploadedAt: any; description?: string }[]): Promise<void> => {
    try {
      await messageService.sendClaimRequest(conversationId, senderId, senderName, senderProfilePicture, postId, postTitle, postType, claimReason, idPhotoUrl, evidencePhotos);
    } catch (error: any) {
      throw new Error(error.message || 'Failed to send claim request');
    }
  };

  const updateClaimResponse = async (conversationId: string, messageId: string, status: 'accepted' | 'rejected'): Promise<void> => {
    if (!userId || !conversationId || !messageId) {
      throw new Error('Invalid parameters for updateClaimResponse');
    }

    try {
      await messageService.updateClaimResponse(conversationId, messageId, status, userId);
    } catch (error: any) {
      throw new Error(error.message || 'Failed to update claim response');
    }
  };

  const confirmClaimIdPhoto = async (conversationId: string, messageId: string): Promise<void> => {
    if (!userId || !conversationId || !messageId) {
      throw new Error('Invalid parameters for confirmClaimIdPhoto');
    }

    try {
      await messageService.confirmClaimIdPhoto(conversationId, messageId, userId);
    } catch (error: any) {
      throw new Error(error.message || 'Failed to confirm claim ID photo');
    }
  };

  const refreshConversations = async (): Promise<void> => {
    if (!userId) return;

    setLoading(true);

    try {
      const unsubscribe = messageService.getUserConversations(userId, (loadedConversations) => {
        setConversations(loadedConversations);
        setLoading(false);
      }, (error) => {
        console.error('refreshConversations: Error loading conversations:', error);
        setLoading(false);
      });

      setTimeout(() => {
        unsubscribe();
      }, 1000);

    } catch (error: any) {
      console.error('refreshConversations: Failed to refresh conversations:', error);
      setLoading(false);
    }
  };

  const value: MessageContextType = {
    conversations,
    loading,
    totalUnreadCount,
    sendMessage,
    createConversation,
    getConversationMessages,
    getUserConversations,
    markConversationAsRead,
    markMessageAsRead,
    markAllUnreadMessagesAsRead,
    deleteMessage,
    updateHandoverResponse,
    confirmHandoverIdPhoto,
    sendClaimRequest,
    updateClaimResponse,
    confirmClaimIdPhoto,
    refreshConversations
  };

  return (
    <MessageContext.Provider value={value}>
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
