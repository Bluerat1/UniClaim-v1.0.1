import { collection, doc, getDocs, writeBatch } from 'firebase/firestore';
import { db } from '../services/firebase/config';

export const migrateUserVerification = async (): Promise<{ success: boolean; message: string }> => {
  try {
    // Get all users
    const usersRef = collection(db, 'users');
    const usersSnapshot = await getDocs(usersRef);
    
    const batch = writeBatch(db);
    let updatedCount = 0;

    usersSnapshot.forEach((userDoc) => {
      const userData = userDoc.data();
      // Only update if emailVerified doesn't exist
      if (userData.emailVerified === undefined) {
        batch.update(doc(db, 'users', userDoc.id), { 
          emailVerified: true // Assume existing users are verified
        });
        updatedCount++;
      }
    });

    if (updatedCount > 0) {
      await batch.commit();
      return { 
        success: true, 
        message: `Successfully updated ${updatedCount} user(s)` 
      };
    }
    
    return { 
      success: true, 
      message: 'No users needed updating' 
    };
    
  } catch (error: any) {
    console.error('Migration failed:', error);
    return { 
      success: false, 
      message: `Migration failed: ${error.message}` 
    };
  }
};
