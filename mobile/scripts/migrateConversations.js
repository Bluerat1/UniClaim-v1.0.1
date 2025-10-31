// Migration script to add participantIds to existing conversations
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, writeBatch, query } = require('firebase/firestore');
const { getAuth, signInWithEmailAndPassword } = require('firebase/auth');
const { config } = require('../../frontend/src/firebase/config');

// Use command line arguments for admin credentials
const args = process.argv.slice(2);
if (args.length < 2) {
  console.error('Usage: node scripts/migrateConversations.js <admin-email> <admin-password>');
  process.exit(1);
}

const ADMIN_EMAIL = args[0];
const ADMIN_PASSWORD = args[1];

// Initialize Firebase with the project config
const app = initializeApp(config);
const db = getFirestore(app);
const auth = getAuth();

async function migrateConversations() {
  try {
    console.log('Starting migration...');
    
    // Sign in as admin
    console.log('Signing in...');
    const userCredential = await signInWithEmailAndPassword(auth, ADMIN_EMAIL, ADMIN_PASSWORD);
    console.log('✓ Signed in as:', userCredential.user.email);

    // Get all conversations
    console.log('Fetching conversations...');
    const conversationsRef = collection(db, 'conversations');
    const q = query(conversationsRef);
    const snapshot = await getDocs(q);

    console.log(`✓ Found ${snapshot.size} conversations to process`);
    
    if (snapshot.size === 0) {
      console.log('No conversations found. Exiting...');
      process.exit(0);
    }
    
    let batch = writeBatch(db);
    let batchCount = 0;
    let updatedCount = 0;
    const BATCH_LIMIT = 400; // Firestore batch limit (staying under 500 limit)

    for (const doc of snapshot.docs) {
      const data = doc.data();
      
      // Skip if participantIds already exists and is an array
      if (data.participantIds && Array.isArray(data.participantIds)) {
        // Verify the array has the correct format
        const participantIds = data.participantIds;
        if (participantIds.length > 0 && typeof participantIds[0] === 'string') {
          console.log(`✓ [${updatedCount + 1}/${snapshot.size}] Skipping ${doc.id} - already has valid participantIds`);
          continue;
        }
      }

      // Extract participant IDs from the participants map
      const participantIds = data.participants ? Object.keys(data.participants) : [];
      
      // Update the document with participantIds
      const docRef = doc.ref;
      batch.update(docRef, { 
        participantIds,
        _migrationUpdatedAt: new Date().toISOString()
      });
      
      updatedCount++;
      batchCount++;
      
      console.log(`✓ [${updatedCount}/${snapshot.size}] Updating ${doc.id} with ${participantIds.length} participants`);

      // Execute batch if we've reached the limit
      if (batchCount >= BATCH_LIMIT) {
        console.log(`\n🚀 Committing batch of ${batchCount} updates (${updatedCount}/${snapshot.size} total)...`);
        await batch.commit();
        batch = writeBatch(db);
        batchCount = 0;
        // Add a small delay between batches to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // Commit any remaining updates
    if (batchCount > 0) {
      console.log(`\n🚀 Committing final batch of ${batchCount} updates (${updatedCount}/${snapshot.size} total)...`);
      await batch.commit();
    }

    console.log(`\n✅ Migration completed successfully!`);
    console.log(`   Total conversations: ${snapshot.size}`);
    console.log(`   Updated conversations: ${updatedCount}`);
    console.log(`   Already up to date: ${snapshot.size - updatedCount}`);
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error during migration:');
    console.error(error);
    
    if (error.code) {
      console.error(`\nError code: ${error.code}`);
      console.error(`Error message: ${error.message}`);
      
      if (error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found') {
        console.error('\nAuthentication failed. Please check your admin credentials.');
        console.error('Usage: node scripts/migrateConversations.js <admin-email> <admin-password>');
      } else if (error.code === 'permission-denied') {
        console.error('\nPermission denied. Make sure your admin account has the necessary permissions.');
      }
    }
    
    process.exit(1);
  }
}

migrateConversations();
