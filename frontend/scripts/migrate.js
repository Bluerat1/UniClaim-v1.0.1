// @ts-check
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, writeBatch, doc } from 'firebase/firestore';

// Initialize Firebase with environment variables
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
  measurementId: process.env.VITE_FIREBASE_MEASUREMENT_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function migrateUserVerification() {
  try {
    console.log('🚀 Starting user verification migration...');
    
    // Get all users
    const usersRef = collection(db, 'users');
    const usersSnapshot = await getDocs(usersRef);
    
    const batch = writeBatch(db);
    let updatedCount = 0;

    // Process each user
    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data();
      
      // Only update if emailVerified doesn't exist
      if (userData.emailVerified === undefined) {
        batch.update(doc(db, 'users', userDoc.id), { 
          emailVerified: true, // Assume existing users are verified
          updatedAt: new Date()
        });
        updatedCount++;
      }
      
      // Commit in batches of 100
      if (updatedCount > 0 && updatedCount % 100 === 0) {
        await batch.commit();
        console.log(`✅ Processed ${updatedCount} users...`);
      }
    }

    // Commit any remaining updates
    if (updatedCount > 0) {
      await batch.commit();
    }

    console.log(`✅ Migration complete! Updated ${updatedCount} users.`);
    return { success: true, updatedCount };
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error',
      updatedCount: 0
    };
  }
}

// Run the migration
migrateUserVerification()
  .then(({ success, updatedCount, error }) => {
    if (success) {
      console.log(`✅ Successfully migrated ${updatedCount} users.`);
      process.exit(0);
    } else {
      console.error('❌ Migration failed:', error);
      process.exit(1);
    }
  })
  .catch((error) => {
    console.error('❌ Unexpected error during migration:', error);
    process.exit(1);
  });
