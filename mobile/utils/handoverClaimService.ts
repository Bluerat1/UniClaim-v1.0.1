// Consolidated Handover and Claim Request Service for Mobile
// This service contains all handover and claim request functionality
// to eliminate duplication and provide a single source of truth

import { cloudinaryService } from './cloudinary';
import { messageService } from './firebase';
import { Alert } from 'react-native';

// Types
export interface HandoverClaimCallbacks {
    onHandoverResponse?: (messageId: string, status: 'accepted' | 'rejected') => void;
    onClaimResponse?: (messageId: string, status: 'accepted' | 'rejected', idPhotoUrl?: string) => void;
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

// Utility Functions
export const uploadIdPhotoMobile = async (photoUri: string, type: 'handover' | 'claim'): Promise<UploadResult> => {
    try {
        console.log(`📸 Starting ${type} ID photo upload...`);

        const uploadedUrl = await cloudinaryService.uploadImage(photoUri, "id_photos");

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

// Handler Functions (UI Logic)
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
            callbacks.onError?.('Use handleIdPhotoUploadMobile for accepting handover requests');
            return;
        }

        // For rejection, proceed as normal
        console.log('🔄 Mobile handoverClaimService: Starting rejection process');
        await updateHandoverResponse(conversationId, messageId, status, currentUserId);
        console.log('✅ Mobile handoverClaimService: Rejection process completed');
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
    callbacks: HandoverClaimCallbacks
): Promise<void> => {
    try {
        if (!callbacks.onClaimResponse) {
            console.warn('No onClaimResponse callback provided');
            return;
        }

        // If accepting, we need to handle ID photo upload separately
        if (status === 'accepted') {
            callbacks.onError?.('Use handleClaimIdPhotoUploadMobile for accepting claim requests');
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

export const handleIdPhotoUploadMobile = async (
    photoUri: string,
    conversationId: string,
    messageId: string,
    currentUserId: string,
    type: 'handover' | 'claim',
    callbacks: HandoverClaimCallbacks
): Promise<void> => {
    try {
        // Upload ID photo
        const uploadResult = await uploadIdPhotoMobile(photoUri, type);

        if (!uploadResult.success) {
            callbacks.onError?.(uploadResult.error || 'Failed to upload ID photo');
            return;
        }

        // Update response with ID photo
        if (type === 'handover') {
            console.log('🔄 Mobile handoverClaimService: Updating handover response with ID photo');
            await updateHandoverResponse(conversationId, messageId, 'accepted', currentUserId, uploadResult.url);
            callbacks.onHandoverResponse?.(messageId, 'accepted');
        } else {
            console.log('🔄 Mobile handoverClaimService: Updating claim response with ID photo');
            console.log('🔄 Mobile handoverClaimService: Calling updateClaimResponse with:', { conversationId, messageId, status: 'accepted', currentUserId, idPhotoUrl: uploadResult.url });
            await updateClaimResponse(conversationId, messageId, 'accepted', currentUserId, uploadResult.url);
            console.log('🔄 Mobile handoverClaimService: About to call onClaimResponse callback');
            callbacks.onClaimResponse?.(messageId, 'accepted', uploadResult.url);
        }

        callbacks.onSuccess?.('ID photo uploaded successfully! The item owner will now review and confirm.');
    } catch (error: any) {
        console.error('Failed to upload ID photo:', error);
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
                callbacks.onSuccess?.('✅ Handover confirmed successfully! The conversation has been archived and the post is now marked as resolved.');
                // Don't call onClearConversation if conversation is already deleted - this prevents duplicate confirmations
            } else {
                callbacks.onSuccess?.('✅ Handover confirmed successfully! The post is now marked as resolved.');
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
        console.log('🔄 Mobile handoverClaimService: handleConfirmClaimIdPhoto called with:', { conversationId, messageId, confirmBy });

        const result = await confirmClaimIdPhoto(conversationId, messageId, confirmBy);

        if (result.success) {
            if (result.conversationDeleted) {
                callbacks.onSuccess?.('✅ Claim confirmed successfully! The conversation has been archived and the post is now marked as resolved.');
                // Don't call onClearConversation if conversation is already deleted - this prevents duplicate confirmations
            } else {
                callbacks.onSuccess?.('✅ Claim confirmed successfully! The post is now marked as resolved.');
                callbacks.onClearConversation?.();
            }
        } else {
            const errorMessage = result.error || "Unknown error occurred";
            callbacks.onError?.(`❌ Failed to confirm claim: ${errorMessage}`);
        }
    } catch (error: any) {
        console.error('❌ Mobile handoverClaimService: Failed to confirm claim ID photo:', error);

        // If conversation is missing, we still want to show success since the post should be marked as resolved
        if (error.message?.includes('Conversation does not exist') ||
            error.message?.includes('Message not found') ||
            error.message?.includes('already processed')) {
            console.log('ℹ️ Mobile handoverClaimService: Conversation missing but treating as success');
            callbacks.onSuccess?.('✅ Claim confirmed successfully! The post is now marked as resolved.');
            callbacks.onClearConversation?.();
            return;
        }

        callbacks.onError?.(error.message || 'Failed to confirm claim ID photo');
    }
};

// Service Functions (Backend Logic)
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

export const updateClaimResponse = async (
    conversationId: string,
    messageId: string,
    status: 'accepted' | 'rejected',
    responderId: string,
    idPhotoUrl?: string
): Promise<void> => {
    try {
        console.log('🔄 Updating claim response:', { conversationId, messageId, status, responderId, idPhotoUrl });
        await messageService.updateClaimResponse(conversationId, messageId, status, responderId, idPhotoUrl);
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
): Promise<{ success: boolean; conversationDeleted: boolean; postId?: string; error?: string }> => {
    try {
        console.log('🔄 Confirming claim ID photo:', { conversationId, messageId, confirmBy });
        const result = await messageService.confirmClaimIdPhoto(conversationId, messageId, confirmBy);
        console.log('✅ Claim ID photo confirmed successfully');
        return result;
    } catch (error: any) {
        console.error('❌ Failed to confirm claim ID photo:', error);
        return { success: false, conversationDeleted: false, error: error.message };
    }
};

// Export all functions as a service object
export const handoverClaimService = {
    // Handler functions
    handleHandoverResponse,
    handleClaimResponse,
    handleIdPhotoUploadMobile,
    handleConfirmIdPhoto,
    handleConfirmClaimIdPhoto,

    // Service functions
    updateHandoverResponse,
    updateClaimResponse,
    confirmHandoverIdPhoto,
    confirmClaimIdPhoto,

    // Utility functions
    uploadIdPhotoMobile,
    validateHandoverRequest,
    validateClaimRequest,
};

export default handoverClaimService;
