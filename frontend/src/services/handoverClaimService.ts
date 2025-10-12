// Consolidated Handover and Claim Request Service
// This service contains all handover and claim request functionality
// to eliminate duplication and provide a single source of truth

import { cloudinaryService } from '../utils/cloudinary';
import { messageService } from './firebase/messages';

// Types
export interface HandoverClaimCallbacks {
    onHandoverResponse?: (messageId: string, status: 'accepted' | 'rejected') => void;
    onClaimResponse?: (messageId: string, status: 'accepted' | 'rejected') => void;
    onConfirmIdPhotoSuccess?: (messageId: string) => void;
    onClearConversation?: () => void;
    onError?: (error: string) => void;
    onSuccess?: (message: string) => void;
}

export interface UploadResult {
    success: boolean;
    url?: string;
    error?: string;
}

// Service Functions (Backend Logic) - Define these first
export const updateHandoverResponse = async (
    conversationId: string,
    messageId: string,
    status: 'accepted' | 'rejected',
    responderId: string,
    idPhotoUrl?: string
): Promise<void> => {
    try {
        console.log('🔄 Updating handover response:', { conversationId, messageId, status, responderId, idPhotoUrl });
        await messageService.updateHandoverResponse(conversationId, messageId, status, responderId, idPhotoUrl);
        console.log('✅ Handover response updated successfully');
    } catch (error: any) {
        console.error('❌ Failed to update handover response:', error);
        throw new Error(error.message || 'Failed to update handover response');
    }
};

export const confirmHandoverIdPhoto = async (
    conversationId: string,
    messageId: string,
    confirmBy: string
): Promise<{ success: boolean; conversationDeleted: boolean; postId?: string; error?: string }> => {
    try {
        console.log('🔄 Confirming handover ID photo:', { conversationId, messageId, confirmBy });
        const result = await messageService.confirmHandoverIdPhoto(conversationId, messageId, confirmBy);
        console.log('✅ Handover ID photo confirmed successfully');
        return result;
    } catch (error: any) {
        console.error('❌ Failed to confirm handover ID photo:', error);
        return { success: false, conversationDeleted: false, error: error.message };
    }
};

export const confirmClaimIdPhoto = async (
    conversationId: string,
    messageId: string,
    confirmBy: string
): Promise<void> => {
    try {
        console.log('🔄 Confirming claim ID photo:', { conversationId, messageId, confirmBy });
        await messageService.confirmClaimIdPhoto(conversationId, messageId, confirmBy);
        console.log('✅ Claim ID photo confirmed successfully');
    } catch (error: any) {
        console.error('❌ Failed to confirm claim ID photo:', error);
        throw new Error(error.message || 'Failed to confirm claim ID photo');
    }
};

// Utility Functions
export const uploadIdPhoto = async (photoFile: File, type: 'handover' | 'claim'): Promise<UploadResult> => {
    try {
        console.log(`📸 Starting ${type} ID photo upload...`, photoFile.name);

        const uploadedUrl = await cloudinaryService.uploadImage(photoFile, "id_photos");

        if (!uploadedUrl || typeof uploadedUrl !== 'string' || !uploadedUrl.includes("cloudinary.com")) {
            throw new Error("Invalid ID photo URL returned from upload");
        }

        console.log(`✅ ${type} ID photo uploaded successfully:`, uploadedUrl.substring(0, 50) + "...");

        return { success: true, url: uploadedUrl };
    } catch (error: any) {
        console.error(`❌ Failed to upload ${type} ID photo:`, error);
        return { success: false, error: error.message || 'Failed to upload ID photo' };
    }
};

export const validateHandoverRequest = (message: any): boolean => {
    return message?.messageType === 'handover_request' &&
        message?.handoverData &&
        typeof message.handoverData === 'object';
};

export const validateClaimRequest = (message: any): boolean => {
    return message?.messageType === 'claim_request' &&
        message?.claimData &&
        typeof message.claimData === 'object';
};

// Export all functions as a service object (defined after all functions)
export const handoverClaimService = {
  // Service functions
  updateHandoverResponse,
  confirmHandoverIdPhoto,
  confirmClaimIdPhoto,

  // Utility functions
  uploadIdPhoto,
  validateHandoverRequest,
  validateClaimRequest,

  // Handler functions - simplified wrappers
  handleHandoverResponse: updateHandoverResponse,
  handleClaimResponse: async (
    conversationId: string,
    messageId: string,
    status: 'accepted' | 'rejected',
    currentUserId: string,
    idPhotoUrl?: string
  ): Promise<void> => {
    try {
      await messageService.updateClaimResponse(conversationId, messageId, status, currentUserId, idPhotoUrl);
    } catch (error: any) {
      throw new Error(error.message || 'Failed to handle claim response');
    }
  },
  handleIdPhotoUpload: async (
    photoFile: File,
    conversationId: string,
    messageId: string,
    currentUserId: string,
    callbacks: HandoverClaimCallbacks
  ) => {
    try {
      const uploadResult = await uploadIdPhoto(photoFile, 'handover');
      if (uploadResult.success) {
        await updateHandoverResponse(conversationId, messageId, 'accepted', currentUserId, uploadResult.url);
        callbacks.onHandoverResponse?.(messageId, 'accepted');
        callbacks.onSuccess?.('ID photo uploaded successfully!');
      } else {
        callbacks.onError?.(uploadResult.error || 'Failed to upload ID photo');
      }
    } catch (error: any) {
      callbacks.onError?.(error.message || 'Failed to upload ID photo');
    }
  },

  handleClaimIdPhotoUpload: async (
    photoFile: File,
    conversationId: string,
    messageId: string,
    currentUserId: string,
    callbacks: HandoverClaimCallbacks
  ) => {
    try {
      const uploadResult = await uploadIdPhoto(photoFile, 'claim');
      if (uploadResult.success) {
        await messageService.updateClaimResponse(conversationId, messageId, 'accepted', currentUserId, uploadResult.url);
        callbacks.onClaimResponse?.(messageId, 'accepted');
        callbacks.onSuccess?.('ID photo uploaded successfully!');
      } else {
        callbacks.onError?.(uploadResult.error || 'Failed to upload ID photo');
      }
    } catch (error: any) {
      callbacks.onError?.(error.message || 'Failed to upload ID photo');
    }
  },

  handleConfirmIdPhoto: confirmHandoverIdPhoto,
  handleConfirmClaimIdPhoto: confirmClaimIdPhoto,
};

export default handoverClaimService;
