import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const CREDENTIALS_KEY = 'stored_credentials';

export interface StoredCredentials {
    email: string;
    password: string;
}

// Define the credential storage interface
export interface ICredentialStorage {
  saveCredentials(email: string, password: string): Promise<void>;
  getStoredCredentials(): Promise<StoredCredentials | null>;
  clearCredentials(): Promise<void>;
  hasStoredCredentials(): Promise<boolean>;
}

// Implement the credential storage
class CredentialStorage implements ICredentialStorage {
  private readonly CREDENTIALS_KEY = 'stored_credentials';

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
            await SecureStore.setItemAsync(this.CREDENTIALS_KEY, JSON.stringify(credentials));
        } catch (error) {
            console.error('❌ Error saving credentials:', error);
            throw new Error('Failed to save login credentials');
        }
    }

  // Retrieve stored credentials
  async getStoredCredentials(): Promise<StoredCredentials | null> {
        try {
            const credentialsData = await SecureStore.getItemAsync(CREDENTIALS_KEY);

            if (!credentialsData) {
                return null; // No stored credentials
            }

            const credentials: StoredCredentials = JSON.parse(credentialsData);

            // Validate retrieved credentials
            if (!credentials?.email || !credentials?.password) {
                console.warn('⚠️ Invalid credentials format detected');
                // Don't call clearCredentials here to avoid potential loops
                await SecureStore.deleteItemAsync(CREDENTIALS_KEY).catch(e => 
                    console.warn('Failed to clear invalid credentials:', e)
                );
                return null;
            }

            return credentials;
        } catch (error) {
            console.error('❌ Error retrieving credentials:', error);
            // Clear corrupted data without using clearCredentials to avoid potential loops
            try {
                await SecureStore.deleteItemAsync(CREDENTIALS_KEY);
            } catch (clearError) {
                console.error('❌ Error clearing corrupted credentials:', clearError);
            }
            return null; // Return null on any error
        }
    }

  // Clear stored credentials
  async clearCredentials(): Promise<void> {
    try {
      // Delete the credentials
      await SecureStore.deleteItemAsync(this.CREDENTIALS_KEY);
    } catch (error) {
      // Silently handle any errors - this is a best-effort operation
    }
    
    return Promise.resolve();
  }

  // Check if credentials are stored
  async hasStoredCredentials(): Promise<boolean> {
    try {
      const credentialsData = await SecureStore.getItemAsync(this.CREDENTIALS_KEY);
      const hasCredentials = credentialsData !== null;
      console.log(`🔍 [hasStoredCredentials] Check result: ${hasCredentials ? 'FOUND' : 'NOT FOUND'}`);
      return hasCredentials;
    } catch (error) {
      console.error('❌ Error checking stored credentials:', error);
      return false;
    }
  }
}

// Export a singleton instance
export const credentialStorage: ICredentialStorage = new CredentialStorage();
