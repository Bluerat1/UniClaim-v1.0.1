// Ghost conversation detection and cleanup types
export interface GhostConversation {
    conversationId: string;
    postId: string;
    reason: string;
}

export interface OrphanedMessage {
    conversationId: string;
    messageId: string;
    reason: string;
}

export interface CleanupResult {
    success: number;
    failed: number;
    errors: string[];
}

export interface ConversationIntegrityResult {
    totalConversations: number;
    validConversations: number;
    ghostConversations: number;
    orphanedMessages: number;
    details: string[];
}

export interface PeriodicCleanupResult {
    timestamp: string;
    ghostsDetected: number;
    ghostsCleaned: number;
    errors: string[];
    duration: number;
}

export interface HealthCheckResult {
    healthy: boolean;
    totalConversations: number;
    ghostCount: number;
    issues: string[];
}

export interface ConversationData {
    postId?: string;
    participants?: { [userId: string]: any };
    createdAt?: any;
    updatedAt?: any;
}

export interface PostData {
    id: string;
    title: string;
    description: string;
    status: string;
    deletedAt?: any;
}

// Error types for better error handling
export class GhostConversationError extends Error {
    public code?: string;

    constructor(message: string, code?: string) {
        super(message);
        this.name = 'GhostConversationError';
        this.code = code;
    }
}

export class ValidationError extends GhostConversationError {
    constructor(message: string) {
        super(message, 'VALIDATION_ERROR');
        this.name = 'ValidationError';
    }
}

export class CleanupError extends GhostConversationError {
    constructor(message: string) {
        super(message, 'CLEANUP_ERROR');
        this.name = 'CleanupError';
    }
}
