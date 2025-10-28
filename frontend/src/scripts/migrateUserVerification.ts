import { collection, getDocs, writeBatch } from 'firebase/firestore';
import { db } from '../services/firebase/config';

// Initialize Firestore

/**
 * Migrates existing users to ensure they have proper email verification status
 * This should be run once after deploying the new auth system
 */
export async function migrateUserVerification() {
  try {
    console.log('Starting user verification migration...');
    
    // Get all users
    const usersRef = collection(db, 'users');
    const usersSnapshot = await getDocs(usersRef);
    
    const batch = writeBatch(db);
    let updatedCount = 0;

    // Process each user
    for (const doc of usersSnapshot.docs) {
      const userData = doc.data();
      
      // Skip if already processed
      if (userData.emailVerified !== undefined) continue;
      
      // Update user with emailVerified status
      batch.update(doc.ref, { 
        emailVerified: true, // Assume existing users are verified
        updatedAt: new Date()
      });
      
      updatedCount++;
      
      // Commit in batches of 100
      if (updatedCount % 100 === 0) {
        await batch.commit();
        console.log(`Migrated ${updatedCount} users...`);
      }
    }

    // Commit any remaining updates
    if (updatedCount % 100 !== 0) {
      await batch.commit();
    }

    console.log(`✅ Migration complete! Updated ${updatedCount} users.`);
    return { success: true, updatedCount };
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// Run the migration if this file is executed directly
if (require.main === module) {
  migrateUserVerification()
    .then(({ success, updatedCount, error }) => {
      if (success) {
        console.log(`Successfully migrated ${updatedCount} users.`);
        process.exit(0);
      } else {
        console.error('Migration failed:', error);
        process.exit(1);
      }
    });
}

