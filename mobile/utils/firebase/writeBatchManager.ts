import { writeBatch, doc, Firestore } from 'firebase/firestore';
import { db } from './config';

class WriteBatchManager {
  private static instance: WriteBatchManager;
  private batch = writeBatch(db);
  private operationCount = 0;
  private readonly MAX_BATCH_SIZE = 400; // Firestore limit is 500, using 400 for safety
  private isProcessing = false;
  private pendingOperations: Array<() => Promise<void>> = [];
  private readonly WRITE_DELAY_MS = 100; // 100ms delay between batch commits

  private constructor() {
    // Private constructor to enforce singleton
  }

  public static getInstance(): WriteBatchManager {
    if (!WriteBatchManager.instance) {
      WriteBatchManager.instance = new WriteBatchManager();
    }
    return WriteBatchManager.instance;
  }

  public async addToBatch<T extends Record<string, any>>(
    collectionPath: string,
    docId: string,
    data: T,
    options: { merge?: boolean } = { merge: true }
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      this.pendingOperations.push(async () => {
        try {
          const docRef = doc(db, collectionPath, docId);
          if (options.merge) {
            this.batch.set(docRef, data, { merge: true });
          } else {
            this.batch.set(docRef, data);
          }
          this.operationCount++;

          if (this.operationCount >= this.MAX_BATCH_SIZE) {
            await this.commitBatch();
          }
          resolve();
        } catch (error) {
          console.error('Error adding to batch:', error);
          reject(error);
        }
      });

      this.processQueue();
    });
  }

  public async deleteFromBatch(collectionPath: string, docId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.pendingOperations.push(async () => {
        try {
          const docRef = doc(db, collectionPath, docId);
          this.batch.delete(docRef);
          this.operationCount++;

          if (this.operationCount >= this.MAX_BATCH_SIZE) {
            await this.commitBatch();
          }
          resolve();
        } catch (error) {
          console.error('Error adding delete to batch:', error);
          reject(error);
        }
      });

      this.processQueue();
    });
  }

  public async commitBatch(): Promise<void> {
    if (this.operationCount === 0) return;

    try {
      console.log(`Committing batch of ${this.operationCount} operations`);
      await this.batch.commit();
      console.log('Batch commit successful');
    } catch (error) {
      console.error('Batch commit failed:', error);
      throw error;
    } finally {
      this.batch = writeBatch(db);
      this.operationCount = 0;
    }
  }

  private async processQueue() {
    if (this.isProcessing || this.pendingOperations.length === 0) return;

    this.isProcessing = true;

    try {
      while (this.pendingOperations.length > 0) {
        const operation = this.pendingOperations.shift();
        if (operation) {
          await operation();
          
          // Add a small delay between operations to prevent overwhelming Firestore
          if (this.pendingOperations.length > 0) {
            await new Promise(resolve => setTimeout(resolve, this.WRITE_DELAY_MS));
          }
        }
      }

      // Commit any remaining operations in the batch
      if (this.operationCount > 0) {
        await this.commitBatch();
      }
    } catch (error) {
      console.error('Error processing write queue:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  // Call this when the app is backgrounded or closed
  public async flush(): Promise<void> {
    if (this.operationCount > 0) {
      await this.commitBatch();
    }
  }

  private initializeAppStateListeners() {
    try {
      // For web
      if (typeof window !== 'undefined' && window.addEventListener) {
        window.addEventListener('beforeunload', () => {
          // Use void to explicitly ignore the Promise
          void this.flush();
        });
      }
      
      // For React Native
      if (typeof document !== 'undefined' && 'addEventListener' in document) {
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'hidden') {
            // Use void to explicitly ignore the Promise
            void this.flush();
          }
        });
      }
    } catch (error) {
      console.error('Error initializing app state listeners:', error);
    }
  }
}

// Create and initialize the singleton instance
const writeBatchManager = WriteBatchManager.getInstance();

// Initialize app state listeners when the module loads
if (typeof window !== 'undefined') {
  // Use type assertion to access private method
  (writeBatchManager as any).initializeAppStateListeners();
}

export { writeBatchManager };
export default writeBatchManager;
