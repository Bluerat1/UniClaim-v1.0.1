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
  markConversationAsRead: (conversationId: string) => Promise<void>;
  markMessageAsRead: (conversationId: string, messageId: string) => Promise<void>;
  markAllUnreadMessagesAsRead: (conversationId: string) => Promise<void>; // New: Mark all unread messages as read
  deleteMessage: (conversationId: string, messageId: string) => Promise<void>; // New: Delete message function
  updateHandoverResponse: (conversationId: string, messageId: string, status: 'accepted' | 'rejected') => Promise<void>; // New: Update handover response
  confirmHandoverIdPhoto: (conversationId: string, messageId: string) => Promise<{ success: boolean; conversationDeleted: boolean; postId?: string; error?: string }>; // New: Confirm ID photo function
  sendClaimRequest: (conversationId: string, senderId: string, senderName: string, senderProfilePicture: string, postId: string, postTitle: string, claimReason?: string, idPhotoUrl?: string, evidencePhotos?: { url: string; uploadedAt: any; description?: string }[]) => Promise<void>; // New: Send claim request
  updateClaimResponse: (conversationId: string, messageId: string, status: 'accepted' | 'rejected') => Promise<void>; // New: Update claim response
  confirmClaimIdPhoto: (conversationId: string, messageId: string) => Promise<void>; // New: Confirm claim ID photo
  refreshConversations: () => Promise<void>; // Simplified refresh function
}

const MessageContext = createContext<MessageContextType | undefined>(undefined);

export const MessageProvider = ({ children, userId }: { children: ReactNode; userId: string | null }) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  // Calculate total unread count for the current user
  const totalUnreadCount = conversations.reduce((total, conv) => {
    // Get the current user's unread count from this conversation
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
    
    // Simple listener that automatically handles conversation updates
    const unsubscribe = messageService.getUserConversations(userId, (loadedConversations) => {
      setConversations(loadedConversations);
      setLoading(false);
    }, (error) => {
      console.error('MessageContext: Listener error:', error);
      setLoading(false);
      
      // If there's an error, try to refresh conversations manually
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

  const markConversationAsRead = async (conversationId: string): Promise<void> => {
    // Guard clause: don't proceed if conversationId is null, undefined, or empty
    if (!conversationId || conversationId.trim() === '') {
      console.log('🛡️ markConversationAsRead: Skipping - conversationId is empty or null');
      return;
    }

    try {
      await messageService.markConversationAsRead(conversationId, userId!);
    } catch (error: any) {
      throw new Error(error.message || 'Failed to mark conversation as read');
    }
  };

  const markMessageAsRead = async (conversationId: string, messageId: string): Promise<void> => {
    // Guard clause: don't proceed if conversationId or messageId is null, undefined, or empty
    if (!conversationId || conversationId.trim() === '' || !messageId || messageId.trim() === '') {
      console.log('🛡️ markMessageAsRead: Skipping - conversationId or messageId is empty or null');
      return;
    }

    try {
      await messageService.markMessageAsRead(conversationId, messageId, userId!);
    } catch (error: any) {
      throw new Error(error.message || 'Failed to mark conversation as read');
    }
  };

  const markAllUnreadMessagesAsRead = async (conversationId: string): Promise<void> => {
    if (!userId) {
      console.log('🛡️ markAllUnreadMessagesAsRead: Skipping - userId is null');
      return;
    }

    try {
      await messageService.markAllUnreadMessagesAsRead(conversationId, userId);
    } catch (error: any) {
      throw new Error(error.message || 'Failed to mark all unread messages as read');
    }
  };

  const deleteMessage = async (conversationId: string, messageId: string): Promise<void> => {
    try {
      await messageService.deleteMessage(conversationId, messageId, userId!);
    } catch (error: any) {
      throw new Error(error.message || 'Failed to delete message');
    }
  };

  const updateHandoverResponse = async (conversationId: string, messageId: string, status: 'accepted' | 'rejected'): Promise<void> => {
    try {
      // Use the waterbase service which has photo deletion logic
      const { messageService: waterbaseMessageService } = await import('../utils/waterbase');
      await waterbaseMessageService.updateHandoverResponse(conversationId, messageId, status, userId!);
    } catch (error: any) {
      throw new Error(error.message || 'Failed to update handover response');
    }
  };

  const confirmHandoverIdPhoto = async (conversationId: string, messageId: string): Promise<{ success: boolean; conversationDeleted: boolean; postId?: string; error?: string }> => {
    try {
      if (!userId) {
        throw new Error('User not authenticated - userId is null');
      }

      const result = await messageService.confirmHandoverIdPhoto(conversationId, messageId, userId);
      
      // If conversation was successfully deleted, remove it from local state
      if (result.success && result.conversationDeleted) {
        console.log('🗑️ Removing deleted conversation from local state:', conversationId);
        setConversations(prevConversations => 
          prevConversations.filter(conv => conv.id !== conversationId)
        );
      }
      
      return result;
    } catch (error: any) {
      console.error('Failed to confirm handover ID photo:', error.message);
      throw new Error(error.message || 'Failed to confirm handover ID photo');
    }
  };

  const sendClaimRequest = async (conversationId: string, senderId: string, senderName: string, senderProfilePicture: string, postId: string, postTitle: string, claimReason?: string, idPhotoUrl?: string, evidencePhotos?: { url: string; uploadedAt: any; description?: string }[]): Promise<void> => {
    try {
      await messageService.sendClaimRequest(conversationId, senderId, senderName, senderProfilePicture, postId, postTitle, claimReason, idPhotoUrl, evidencePhotos);
    } catch (error: any) {
      throw new Error(error.message || 'Failed to send claim request');
    }
  };

  const updateClaimResponse = async (conversationId: string, messageId: string, status: 'accepted' | 'rejected'): Promise<void> => {
    try {
      console.log('🔄 MessageContext: Calling updateClaimResponse with status:', status);
      console.log('🔄 MessageContext: Parameters:', { conversationId, messageId, status, responderId: userId });
      // Use the waterbase service which has photo deletion logic
      const { messageService: waterbaseMessageService } = await import('../utils/waterbase');
      await waterbaseMessageService.updateClaimResponse(conversationId, messageId, status, userId!);
      console.log('✅ MessageContext: updateClaimResponse completed successfully');
    } catch (error: any) {
      console.error('❌ MessageContext: updateClaimResponse failed:', error);
      throw new Error(error.message || 'Failed to update claim response');
    }
  };

  const confirmClaimIdPhoto = async (conversationId: string, messageId: string): Promise<void> => {
    try {
      await messageService.confirmClaimIdPhoto(conversationId, messageId, userId!);
    } catch (error: any) {
      throw new Error(error.message || 'Failed to confirm claim ID photo');
    }
  };

  // Simple refresh function that fetches current conversations
  const refreshConversations = async (): Promise<void> => {
    if (!userId) return;
    
    try {
      setLoading(true);
      
      // Use a one-time query to get current state
      const currentConversations = await messageService.getCurrentConversations(userId);
      
      setConversations(currentConversations);
      setLoading(false);
    } catch (error: any) {
      setLoading(false);
      throw new Error(error.message || 'Failed to refresh conversations');
    }
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
        markConversationAsRead,
        markMessageAsRead,
        markAllUnreadMessagesAsRead,
        deleteMessage,
        updateHandoverResponse,
        confirmHandoverIdPhoto,
        sendClaimRequest,
        updateClaimResponse,
        confirmClaimIdPhoto,
        refreshConversations,
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
