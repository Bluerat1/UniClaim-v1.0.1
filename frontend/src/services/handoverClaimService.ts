// Consolidated Handover and Claim Request Service
// This service contains all handover and claim request functionality
// to eliminate duplication and provide a single source of truth

import { cloudinaryService } from '../utils/cloudinary';
import { messageService as waterbaseMessageService } from '../utils/waterbase';

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
        await waterbaseMessageService.updateHandoverResponse(conversationId, messageId, status, responderId, idPhotoUrl);
        console.log('✅ Handover response updated successfully');
    } catch (error: any) {
        console.error('❌ Failed to update handover response:', error);
        throw new Error(error.message || 'Failed to update handover response');
    }
};

export const updateClaimResponse = async (
    conversationId: string,
    messageId: string,
    status: 'accepted' | 'rejected',
    responderId: string,
    idPhotoUrl?: string
): Promise<void> => {
    try {
        console.log('🔄 Updating claim response:', { conversationId, messageId, status, responderId, idPhotoUrl });
        await waterbaseMessageService.updateClaimResponse(conversationId, messageId, status, responderId, idPhotoUrl);
        console.log('✅ Claim response updated successfully');
    } catch (error: any) {
        console.error('❌ Failed to update claim response:', error);
        throw new Error(error.message || 'Failed to update claim response');
    }
};

export const confirmHandoverIdPhoto = async (
    conversationId: string,
    messageId: string,
    confirmBy: string
): Promise<{ success: boolean; conversationDeleted: boolean; postId?: string; error?: string }> => {
    try {
        console.log('🔄 Confirming handover ID photo:', { conversationId, messageId, confirmBy });
        const result = await waterbaseMessageService.confirmHandoverIdPhoto(conversationId, messageId, confirmBy);
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
        await waterbaseMessageService.confirmClaimIdPhoto(conversationId, messageId, confirmBy);
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

// Handler Functions (UI Logic) - Define these after service functions
export const handleHandoverResponse = async (
    conversationId: string,
    messageId: string,
    status: 'accepted' | 'rejected',
    currentUserId: string,
    callbacks: HandoverClaimCallbacks
): Promise<void> => {
    try {
        if (!callbacks.onHandoverResponse) {
            console.warn('No onHandoverResponse callback provided');
            return;
        }

        // If accepting, we need to handle ID photo upload separately
        if (status === 'accepted') {
            callbacks.onError?.('Use handleIdPhotoUpload for accepting handover requests');
            return;
        }

        // For rejection, proceed as normal
        await updateHandoverResponse(conversationId, messageId, status, currentUserId);
        callbacks.onHandoverResponse(messageId, status);
    } catch (error: any) {
        console.error('Failed to update handover response:', error);
        callbacks.onError?.(error.message || 'Failed to update handover response');
    }
};

export const handleClaimResponse = async (
    conversationId: string,
    messageId: string,
    status: 'accepted' | 'rejected',
    currentUserId: string,
    callbacks: HandoverClaimCallbacks,
    isAdmin: boolean = false
): Promise<void> => {
    try {
        if (!callbacks.onClaimResponse) {
            console.warn('No onClaimResponse callback provided');
            return;
        }

        // If accepting and not an admin, require ID photo upload
        if (status === 'accepted' && !isAdmin) {
            callbacks.onError?.('Use handleClaimIdPhotoUpload for accepting claim requests');
            return;
        }

        // For acceptance by admin, proceed without ID photo
        if (status === 'accepted' && isAdmin) {
            console.log('Admin bypassing ID photo verification for claim');
            await updateClaimResponse(conversationId, messageId, status, currentUserId, undefined);
            callbacks.onClaimResponse(messageId, status);
            callbacks.onSuccess?.('Claim accepted successfully (admin bypassed ID verification)');
            return;
        }

        // For rejection, proceed as normal
        await updateClaimResponse(conversationId, messageId, status, currentUserId);
        callbacks.onClaimResponse(messageId, status);
    } catch (error: any) {
        console.error('Failed to update claim response:', error);
        callbacks.onError?.(error.message || 'Failed to update claim response');
    }
};

export const handleIdPhotoUpload = async (
  photoFile: File,
  conversationId: string,
  messageId: string,
  currentUserId: string,
  callbacks: HandoverClaimCallbacks
): Promise<void> => {
  try {
    console.log('🔄 Service: handleIdPhotoUpload called', { conversationId, messageId });

    // Upload ID photo
    const uploadResult = await uploadIdPhoto(photoFile, 'handover');
    console.log('📤 Service: Photo upload result', uploadResult);

    if (!uploadResult.success) {
      console.error('❌ Service: Photo upload failed', uploadResult.error);
      callbacks.onError?.(uploadResult.error || 'Failed to upload ID photo');
      return;
    }

    console.log('✅ Service: Photo uploaded successfully, updating Firebase');

    // Update handover response with ID photo
    await updateHandoverResponse(conversationId, messageId, 'accepted', currentUserId, uploadResult.url);

    console.log('🔄 Service: Calling onHandoverResponse callback');
    callbacks.onHandoverResponse?.(messageId, 'accepted');

    console.log('🔄 Service: Calling onSuccess callback');
    callbacks.onSuccess?.('ID photo uploaded successfully! The item owner will now review and confirm.');
  } catch (error: any) {
    console.error('❌ Service: handleIdPhotoUpload failed:', error);
    callbacks.onError?.(error.message || 'Failed to upload ID photo');
  }
};

export const handleClaimIdPhotoUpload = async (
  photoFile: File,
  conversationId: string,
  messageId: string,
  currentUserId: string,
  callbacks: HandoverClaimCallbacks
): Promise<void> => {
  try {
    console.log('🔄 Service: handleClaimIdPhotoUpload called', { conversationId, messageId });

    // Upload ID photo
    const uploadResult = await uploadIdPhoto(photoFile, 'claim');
    console.log('📤 Service: Claim photo upload result', uploadResult);

    if (!uploadResult.success) {
      console.error('❌ Service: Claim photo upload failed', uploadResult.error);
      callbacks.onError?.(uploadResult.error || 'Failed to upload ID photo');
      return;
    }

    console.log('✅ Service: Claim photo uploaded successfully, updating Firebase');

    // Update claim response with ID photo
    await updateClaimResponse(conversationId, messageId, 'accepted', currentUserId, uploadResult.url);

    console.log('🔄 Service: Calling onClaimResponse callback');
    callbacks.onClaimResponse?.(messageId, 'accepted');

    console.log('🔄 Service: Calling onSuccess callback');
    callbacks.onSuccess?.('ID photo uploaded successfully! The item owner will now review and confirm.');
  } catch (error: any) {
    console.error('❌ Service: handleClaimIdPhotoUpload failed:', error);
    callbacks.onError?.(error.message || 'Failed to upload ID photo');
  }
};

export const handleConfirmIdPhoto = async (
  conversationId: string,
  messageId: string,
  confirmBy: string,
  callbacks: HandoverClaimCallbacks
): Promise<void> => {
  try {
    const result = await confirmHandoverIdPhoto(conversationId, messageId, confirmBy);

    if (result.success) {
      if (result.conversationDeleted) {
        callbacks.onSuccess?.('✅ Handover confirmed successfully! The conversation has been archived and the post is now marked as completed.');
        callbacks.onClearConversation?.();
      } else {
        callbacks.onSuccess?.('✅ Handover confirmed successfully! The post is now marked as completed.');
        callbacks.onClearConversation?.();
      }
    } else {
      const errorMessage = result.error || "Unknown error occurred";
      callbacks.onError?.(`❌ Failed to confirm handover: ${errorMessage}`);
    }
  } catch (error: any) {
    console.error('Failed to confirm ID photo:', error);
    callbacks.onError?.(error.message || 'Failed to confirm ID photo');
  }
};

export const handleConfirmClaimIdPhoto = async (
  conversationId: string,
  messageId: string,
  confirmBy: string,
  callbacks: HandoverClaimCallbacks
): Promise<void> => {
  try {
    await confirmClaimIdPhoto(conversationId, messageId, confirmBy);
    callbacks.onSuccess?.('✅ Claim confirmed successfully! The post is now marked as completed.');
    callbacks.onClearConversation?.();
  } catch (error: any) {
    console.error('Failed to confirm claim ID photo:', error);
    callbacks.onError?.(error.message || 'Failed to confirm claim ID photo');
  }
};

// Mobile-specific functions (for React Native)
export const handleIdPhotoUploadMobile = async (
  photoUri: string,
  conversationId: string,
  messageId: string,
  currentUserId: string,
  type: 'handover' | 'claim',
  callbacks: HandoverClaimCallbacks
): Promise<void> => {
  try {
    // Upload ID photo to Cloudinary
    const uploadedUrl = await cloudinaryService.uploadImage(photoUri, "id_photos");

    if (!uploadedUrl) {
      callbacks.onError?.('Failed to upload ID photo');
      return;
    }

    // Update response with ID photo
    if (type === 'handover') {
      await updateHandoverResponse(conversationId, messageId, 'accepted', currentUserId, uploadedUrl);
      callbacks.onHandoverResponse?.(messageId, 'accepted');
    } else {
      await updateClaimResponse(conversationId, messageId, 'accepted', currentUserId, uploadedUrl);
      callbacks.onClaimResponse?.(messageId, 'accepted');
    }

    callbacks.onSuccess?.('ID photo uploaded successfully! The item owner will now review and confirm.');
  } catch (error: any) {
    console.error('Failed to upload ID photo:', error);
    callbacks.onError?.(error.message || 'Failed to upload ID photo');
  }
};

// Export all functions as a service object
export const handoverClaimService = {
  // Handler functions
  handleHandoverResponse,
  handleClaimResponse,
  handleIdPhotoUpload,
  handleClaimIdPhotoUpload,
  handleConfirmIdPhoto,
  handleConfirmClaimIdPhoto,
  handleIdPhotoUploadMobile,

  // Service functions
  updateHandoverResponse,
  updateClaimResponse,
  confirmHandoverIdPhoto,
  confirmClaimIdPhoto,

  // Utility functions
  uploadIdPhoto,
  validateHandoverRequest,
  validateClaimRequest,
};

export default handoverClaimService;
