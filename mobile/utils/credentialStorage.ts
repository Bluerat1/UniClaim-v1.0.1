import * as SecureStore from 'expo-secure-store';

const CREDENTIALS_KEY = 'stored_credentials';

export interface StoredCredentials {
    email: string;
    password: string;
}

export const credentialStorage = {
    // Save user credentials securely
    async saveCredentials(email: string, password: string): Promise<void> {
        try {
            // Validate input
            if (!email || !password) {
                throw new Error('Email and password are required');
            }

            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                throw new Error('Invalid email format');
            }

            if (password.length < 6) {
                throw new Error('Password must be at least 6 characters');
            }

            const credentials: StoredCredentials = { email, password };

            // Store credentials using Expo SecureStore (automatically encrypted)
            await SecureStore.setItemAsync(CREDENTIALS_KEY, JSON.stringify(credentials));
                    } catch (error) {
            console.error('❌ Error saving credentials:', error);
            throw new Error('Failed to save login credentials');
        }
    },

    // Retrieve stored credentials
    async getStoredCredentials(): Promise<StoredCredentials | null> {
        try {
            const credentialsData = await SecureStore.getItemAsync(CREDENTIALS_KEY);

            if (!credentialsData) {
                                return null; // No stored credentials
            }

            const credentials: StoredCredentials = JSON.parse(credentialsData);

            // Validate retrieved credentials
            if (!credentials.email || !credentials.password) {
                console.warn('⚠️ Invalid credentials format detected, clearing stored data');
                await this.clearCredentials();
                return null;
            }

                        return credentials;
        } catch (error) {
            console.error('❌ Error retrieving credentials:', error);
            // Clear corrupted data
            try {
                await this.clearCredentials();
            } catch (clearError) {
                console.error('❌ Error clearing corrupted credentials:', clearError);
            }
            return null; // Return null on any error
        }
    },

    // Clear stored credentials
    async clearCredentials(): Promise<void> {
        try {
            await SecureStore.deleteItemAsync(CREDENTIALS_KEY);
                    } catch (error) {
            console.error('❌ Error clearing credentials:', error);
            // Don't throw error - clearing should always succeed
        }
    },

    // Check if credentials are stored
    async hasStoredCredentials(): Promise<boolean> {
        try {
            const credentialsData = await SecureStore.getItemAsync(CREDENTIALS_KEY);
            const hasCredentials = credentialsData !== null;
                        return hasCredentials;
        } catch (error) {
            console.error('❌ Error checking stored credentials:', error);
            return false;
        }
    }
};
