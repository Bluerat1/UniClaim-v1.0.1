const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, updateDoc, doc, query, where } = require('firebase/firestore');

// Firebase config (you may need to adjust this based on your config)
const firebaseConfig = {
  // Add your Firebase config here
  apiKey: "your-api-key",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "your-app-id"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function migrateConversations() {
  console.log('🔄 Starting conversation migration...');
  
  try {
    // Get all conversations
    const conversationsRef = collection(db, 'conversations');
    const conversationsSnapshot = await getDocs(conversationsRef);
    
    console.log(`📊 Found ${conversationsSnapshot.docs.length} conversations to check`);
    
    let updatedCount = 0;
    let errorCount = 0;
    
    for (const conversationDoc of conversationsSnapshot.docs) {
      const conversation = conversationDoc.data();
      const conversationId = conversationDoc.id;
      
      // Check if conversation is missing required fields
      if (!conversation.postType || !conversation.postStatus) {
        console.log(`🔍 Migrating conversation ${conversationId}...`);
        
        try {
          // Get the post data
          const postDoc = await getDoc(doc(db, 'posts', conversation.postId));
          if (postDoc.exists()) {
            const postData = postDoc.data();
            
            // Update the conversation with post data
            await updateDoc(doc(db, 'conversations', conversationId), {
              postType: postData.type || 'lost',
              postStatus: postData.status || 'pending',
              foundAction: postData.foundAction || null,
              postCreatorId: postData.creatorId || conversation.postOwnerId
            });
            
            console.log(`✅ Updated conversation ${conversationId}: ${postData.type} | ${postData.status}`);
            updatedCount++;
          } else {
            console.log(`⚠️  Post not found for conversation ${conversationId}`);
            errorCount++;
          }
        } catch (error) {
          console.error(`❌ Error updating conversation ${conversationId}:`, error);
          errorCount++;
        }
      } else {
        console.log(`✅ Conversation ${conversationId} already has required fields`);
      }
    }
    
    console.log(`\n🎉 Migration completed!`);
    console.log(`✅ Updated: ${updatedCount} conversations`);
    console.log(`❌ Errors: ${errorCount} conversations`);
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
  }
}

// Run migration
migrateConversations();
