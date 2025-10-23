import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { messageService } from "../utils/firebase";
import type { Conversation, Message } from "../types/type";

interface MessageContextType {
  conversations: Conversation[];
  loading: boolean;
  totalUnreadCount: number; // Add total unread count like web version
  sendMessage: (conversationId: string, senderId: string, senderName: string, text: string, senderProfilePicture?: string) => Promise<void>;
  createConversation: (postId: string, postTitle: string, postOwnerId: string, currentUserId: string, currentUserData: any, postOwnerUserData?: any, postType?: string, postStatus?: string, foundAction?: string) => Promise<string>;
  getConversationMessages: (conversationId: string, callback: (messages: Message[]) => void, limit?: number) => () => void;
  getOlderMessages: (conversationId: string, lastMessageTimestamp: any, limit?: number) => Promise<Message[]>;
  getConversation: (conversationId: string) => Promise<any>;
  deleteMessage: (conversationId: string, messageId: string) => Promise<void>;
  markMessageAsRead: (conversationId: string, messageId: string, userId: string) => Promise<void>;
  markAllUnreadMessagesAsRead: (conversationId: string, userId: string) => Promise<void>;
  sendHandoverRequest: (conversationId: string, senderId: string, senderName: string, senderProfilePicture: string, postId: string, postTitle: string, handoverReason?: string, idPhotoUrl?: string, itemPhotos?: { url: string; uploadedAt: any; description?: string }[]) => Promise<void>;
  updateHandoverResponse: (conversationId: string, messageId: string, status: 'accepted' | 'rejected', idPhotoUrl?: string) => Promise<void>;
  confirmHandoverIdPhoto: (conversationId: string, messageId: string, userId: string) => Promise<void>;
  sendClaimRequest: (conversationId: string, senderId: string, senderName: string, senderProfilePicture: string, postId: string, postTitle: string, claimReason?: string, idPhotoUrl?: string, evidencePhotos?: { url: string; uploadedAt: any; description?: string }[]) => Promise<void>;
  updateClaimResponse: (conversationId: string, messageId: string, status: 'accepted' | 'rejected', userId: string, idPhotoUrl?: string) => Promise<void>;
  confirmClaimIdPhoto: (conversationId: string, messageId: string, userId: string) => Promise<void>;
  refreshConversations: () => Promise<void>;
  markConversationAsRead: (conversationId: string, userId: string) => Promise<void>;
  getUnreadConversationCount: (userId: string) => number;
  getTotalUnreadMessageCount: (userId: string) => number;
  getConversationUnreadCount: (conversationId: string, userId: string) => number;
  getUnreadConversationsSummary: (userId: string) => { count: number; conversations: Array<{ id: string; postTitle: string; unreadCount: number; lastMessage?: any }> };
}

const MessageContext = createContext<MessageContextType | undefined>(undefined);

export const MessageProvider = ({ children, userId, isAuthenticated }: { children: ReactNode; userId: string | null; isAuthenticated: boolean }) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  // Calculate total unread count for the current user (like web version)
  const totalUnreadCount = conversations.reduce((total, conv) => {
    const userUnreadCount = conv.unreadCounts?.[userId || ''] || 0;
    return total + userUnreadCount;
  }, 0);

  // Load user conversations
  useEffect(() => {
    if (!userId || !isAuthenticated) {
      setConversations([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    // Simple listener that automatically handles conversation updates
    const unsubscribe = messageService.getUserConversations(userId, (loadedConversations) => {
      setConversations(loadedConversations);
      setLoading(false);
    });

    return () => {
      unsubscribe();
    };
  }, [userId, isAuthenticated]);



  const sendMessage = async (conversationId: string, senderId: string, senderName: string, text: string, senderProfilePicture?: string): Promise<void> => {
    try {
      await messageService.sendMessage(conversationId, senderId, senderName, text, senderProfilePicture);
    } catch (error: any) {
      console.error('❌ MessageContext: Failed to send message:', error);
      throw new Error(error.message || 'Failed to send message');
    }
  };

  const createConversation = async (postId: string, postTitle: string, postOwnerId: string, currentUserId: string, currentUserData: any, postOwnerUserData?: any, postType?: string, postStatus?: string, foundAction?: string): Promise<string> => {
    try {
      return await messageService.createConversation(postId, postTitle, postOwnerId, currentUserId, currentUserData, postOwnerUserData, postType, postStatus, foundAction);
    } catch (error: any) {
      throw new Error(error.message || 'Failed to create conversation');
    }
  };

  const getConversationMessages = (conversationId: string, callback: (messages: Message[]) => void, limit?: number) => {
    return messageService.getConversationMessages(conversationId, callback, limit);
  };

  const getOlderMessages = async (conversationId: string, lastMessageTimestamp: any, limit?: number) => {
    try {
      return await messageService.getOlderMessages(conversationId, lastMessageTimestamp, limit);
    } catch (error: any) {
      throw new Error(error.message || 'Failed to get older messages');
    }
  };

  const getConversation = async (conversationId: string) => {
    try {
      return await messageService.getConversation(conversationId);
    } catch (error: any) {
      throw new Error(error.message || 'Failed to get conversation');
    }
  };

  const deleteMessage = async (conversationId: string, messageId: string): Promise<void> => {
    try {
      await messageService.deleteMessage(conversationId, messageId, userId!);
    } catch (error: any) {
      throw new Error(error.message || 'Failed to delete message');
    }
  };

  const markMessageAsRead = async (conversationId: string, messageId: string, userId: string): Promise<void> => {
    try {
      await messageService.markMessageAsRead(conversationId, messageId, userId);
    } catch (error: any) {
      console.error('❌ MessageContext: Failed to mark message as read:', error);

      // Log additional debugging information for permission errors
      if (error.code === 'permission-denied') {
        console.error(`🔒 MessageContext: Permission denied for user ${userId} in conversation ${conversationId}, message ${messageId}`);
      }

      throw new Error(error.message || 'Failed to mark message as read');
    }
  };

  const markAllUnreadMessagesAsRead = async (conversationId: string, userId: string): Promise<void> => {
    try {
      await messageService.markAllUnreadMessagesAsRead(conversationId, userId);
    } catch (error: any) {
      console.error('Failed to mark all unread messages as read:', error);
      // Don't throw error - just log it
    }
  };

  const confirmHandoverIdPhoto = async (conversationId: string, messageId: string, userId: string): Promise<void> => {
    try {
      const result = await messageService.confirmHandoverIdPhoto(conversationId, messageId, userId);
      if (!result.success) {
        throw new Error(result.error || 'Failed to confirm handover ID photo');
      }
    } catch (error: any) {
      throw new Error(error.message || 'Failed to confirm handover ID photo');
    }
  };

  const updateHandoverResponse = async (conversationId: string, messageId: string, status: 'accepted' | 'rejected', idPhotoUrl?: string): Promise<void> => {
    try {
      await messageService.updateHandoverResponse(conversationId, messageId, status, userId!, idPhotoUrl);
    } catch (error: any) {
      throw new Error(error.message || 'Failed to update handover response');
    }
  };

  const sendHandoverRequest = async (conversationId: string, senderId: string, senderName: string, senderProfilePicture: string, postId: string, postTitle: string, handoverReason?: string, idPhotoUrl?: string, itemPhotos?: { url: string; uploadedAt: any; description?: string }[]): Promise<void> => {
    try {
      await messageService.sendHandoverRequest(conversationId, senderId, senderName, senderProfilePicture, postId, postTitle, handoverReason, idPhotoUrl, itemPhotos);
    } catch (error: any) {
      throw new Error(error.message || 'Failed to send handover request');
    }
  };

  const sendClaimRequest = async (conversationId: string, senderId: string, senderName: string, senderProfilePicture: string, postId: string, postTitle: string, claimReason?: string, idPhotoUrl?: string, evidencePhotos?: { url: string; uploadedAt: any; description?: string }[]): Promise<void> => {
    try {
      await messageService.sendClaimRequest(conversationId, senderId, senderName, senderProfilePicture, postId, postTitle, claimReason, idPhotoUrl, evidencePhotos);
    } catch (error: any) {
      throw new Error(error.message || 'Failed to send claim request');
    }
  };

  const updateClaimResponse = async (conversationId: string, messageId: string, status: 'accepted' | 'rejected', userId: string, idPhotoUrl?: string): Promise<void> => {
    try {
      await messageService.updateClaimResponse(conversationId, messageId, status, userId, idPhotoUrl);
    } catch (error: any) {
      throw new Error(error.message || 'Failed to update claim response');
    }
  };

  const confirmClaimIdPhoto = async (conversationId: string, messageId: string, userId: string): Promise<void> => {
    try {
      const result = await messageService.confirmClaimIdPhoto(conversationId, messageId, userId);
      if (!result.success) {
        console.error('❌ Mobile MessageContext: confirmClaimIdPhoto failed:', result.error);
        throw new Error(result.error || 'Failed to confirm claim ID photo');
      }
    } catch (error: any) {
      console.error('❌ Mobile MessageContext: confirmClaimIdPhoto failed:', error);
      throw new Error(error.message || 'Failed to confirm claim ID photo');
    }
  };

  // Simple refresh function that fetches current conversations
  const refreshConversations = async (): Promise<void> => {
    if (!userId || !isAuthenticated) {
      setConversations([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      // Use a one-time query to get current state
      const currentConversations = await messageService.getCurrentConversations(userId);

      setConversations(currentConversations);
      setLoading(false);
    } catch (error: any) {
      console.error('🔧 Mobile MessageContext: Refresh failed:', error);
      setLoading(false);

      // For permission errors, don't throw - just log and continue
      if (error?.code === 'permission-denied') {
        setConversations([]);
        return;
      }

      throw new Error(error.message || 'Failed to refresh conversations');
    }
  };

  // Mark conversation as read for a specific user
  const markConversationAsRead = async (conversationId: string, userId: string): Promise<void> => {
    if (!userId || !isAuthenticated) return;

    try {
      // Update the conversation's unread count for this user
      await messageService.markConversationAsRead(conversationId, userId);
      
      // Update local state to reflect the change
      setConversations(prevConversations => 
        prevConversations.map(conv => 
          conv.id === conversationId 
            ? { ...conv, unreadCounts: { ...conv.unreadCounts, [userId]: 0 } }
            : conv
        )
      );
    } catch (error: any) {
      console.error('Failed to mark conversation as read:', error);
      // Don't throw error - just log it
    }
  };

  // Get count of conversations with unread messages for a specific user
  const getUnreadConversationCount = (userId: string): number => {
    if (!userId) return 0;
    
    return conversations.filter(conv => 
      conv.unreadCounts?.[userId] > 0
    ).length;
  };

  // Get total count of unread messages for a specific user (optional - for future use)
  const getTotalUnreadMessageCount = (userId: string): number => {
    if (!userId) return 0;
    
    return conversations.reduce((total, conv) => 
      total + (conv.unreadCounts?.[userId] || 0), 0
    );
  };

  // Get unread count for a specific conversation (useful for chat headers)
  const getConversationUnreadCount = (conversationId: string, userId: string): number => {
    if (!userId) return 0;
    
    const conversation = conversations.find(conv => conv.id === conversationId);
    return conversation?.unreadCounts?.[userId] || 0;
  };

  // Get unread conversations summary (useful for notifications or other UI elements)
  const getUnreadConversationsSummary = (userId: string) => {
    if (!userId) return { count: 0, conversations: [] };
    
    const unreadConversations = conversations.filter(conv => 
      conv.unreadCounts?.[userId] > 0
    );
    
    return {
      count: unreadConversations.length,
      conversations: unreadConversations.map(conv => ({
        id: conv.id,
        postTitle: conv.postTitle,
        unreadCount: conv.unreadCounts?.[userId] || 0,
        lastMessage: conv.lastMessage
      }))
    };
  };

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
        markAllUnreadMessagesAsRead,
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
      }}
    >
      {children}
    </MessageContext.Provider>
  );
};

export const useMessage = () => {
  const context = useContext(MessageContext);
  if (!context) {
    throw new Error('useMessage must be used within MessageProvider');
  }
  return context;
};
