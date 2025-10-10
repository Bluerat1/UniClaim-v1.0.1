// Firebase retry logic and quota management utilities
// Extracted from waterbase.ts for better organization

import { isPermissionError, isQuotaError } from './firebaseErrorUtils';

// Utility function to handle Firebase operations with retry logic
export const firebaseOperationWithRetry = async <T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000
): Promise<T> => {
    let lastError: any;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await operation();
        } catch (error: any) {
            lastError = error;

            // Don't retry on permission errors or quota errors
            if (isPermissionError(error) || isQuotaError(error)) {
                throw error;
            }

            // Don't retry on the last attempt
            if (attempt === maxRetries) {
                break;
            }

            // Calculate delay with exponential backoff
            const delay = baseDelay * Math.pow(2, attempt);
            console.warn(`Firebase operation failed, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries}):`, error.message);

            // Wait before retrying
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }

    throw lastError;
};

// Quota monitoring and management system
export class QuotaManager {
    private static instance: QuotaManager;
    private quotaErrors: number = 0;
    private lastQuotaError: number = 0;
    private isInQuotaWarning: boolean = false;

    private constructor() { }

    static getInstance(): QuotaManager {
        if (!QuotaManager.instance) {
            QuotaManager.instance = new QuotaManager();
        }
        return QuotaManager.instance;
    }

    // Record a quota error
    recordQuotaError(): void {
        const now = Date.now();
        this.quotaErrors++;
        this.lastQuotaError = now;

        // If we've had multiple quota errors recently, enter warning mode
        if (this.quotaErrors >= 3 && (now - this.lastQuotaError) < 300000) { // 5 minutes
            this.isInQuotaWarning = true;
            console.warn('🚨 Firebase quota warning mode activated - reducing database operations');
        }
    }

    // Check if we should reduce operations due to quota issues
    shouldReduceOperations(): boolean {
        return this.isInQuotaWarning;
    }

    // Reset quota error count (call this when quota resets)
    resetQuotaErrors(): void {
        this.quotaErrors = 0;
        this.isInQuotaWarning = false;
        console.log('✅ Firebase quota errors reset - normal operations resumed');
    }

    // Get current quota status
    getQuotaStatus(): {
        errorCount: number;
        lastError: number;
        inWarningMode: boolean;
        recommendations: string[];
    } {
        const recommendations: string[] = [];

        if (this.isInQuotaWarning) {
            recommendations.push('Consider upgrading Firebase plan');
            recommendations.push('Reduce real-time listeners');
            recommendations.push('Implement caching strategies');
        }

        if (this.quotaErrors > 0) {
            recommendations.push('Monitor Firebase console for usage');
        }

        return {
            errorCount: this.quotaErrors,
            lastError: this.lastQuotaError,
            inWarningMode: this.isInQuotaWarning,
            recommendations
        };
    }
}

// Global quota manager instance
export const quotaManager = QuotaManager.getInstance();
