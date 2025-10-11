// Script to grandfather existing users by setting emailVerified = true
// This ensures existing users don't get locked out when email verification is implemented

const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
const serviceAccount = require('./firebase-service-account.json'); // You'll need to add your service account key

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://uniclaim2-default-rtdb.firebaseio.com" // Replace with your project URL
});

const db = admin.firestore();

async function grandfatherExistingUsers() {
    try {
        console.log('Starting to grandfather existing users...');

        // Get all users from the users collection
        const usersSnapshot = await db.collection('users').get();

        if (usersSnapshot.empty) {
            console.log('No users found in the database.');
            return;
        }

        console.log(`Found ${usersSnapshot.size} users to process.`);

        const batch = db.batch();
        let updateCount = 0;

        usersSnapshot.forEach((doc) => {
            const userData = doc.data();

            // Only update users who don't have emailVerified field or have it set to false
            if (userData.emailVerified === undefined || userData.emailVerified === false) {
                batch.update(doc.ref, {
                    emailVerified: true,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                });
                updateCount++;
                console.log(`Will update user: ${userData.email || doc.id}`);
            } else {
                console.log(`User already verified: ${userData.email || doc.id}`);
            }
        });

        if (updateCount > 0) {
            console.log(`\nCommitting ${updateCount} updates...`);
            await batch.commit();
            console.log(`✅ Successfully updated ${updateCount} existing users with emailVerified: true`);
        } else {
            console.log('✅ No users needed updating - all users already have emailVerified: true');
        }

        console.log('\nGrandfathering process completed successfully!');
        console.log('Existing users can now access the platform without email verification.');

    } catch (error) {
        console.error('❌ Error during grandfathering process:', error);
        throw error;
    }
}

// Run the script
grandfatherExistingUsers()
    .then(() => {
        console.log('\n🎉 Script completed successfully!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n💥 Script failed:', error);
        process.exit(1);
    });
