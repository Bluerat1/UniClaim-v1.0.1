// Web-based script to grandfather existing users
// Run this in the browser console while logged in as an admin user
// This script will update all existing users to have emailVerified: true

// Make sure you're logged in as an admin user before running this script
console.log('Starting grandfather script for existing users...');

// Check if user is admin
const currentUser = firebase.auth().currentUser;
if (!currentUser) {
    console.error('❌ Please log in as an admin user first');
    throw new Error('Not logged in');
}

// Get user data to check if admin
firebase.firestore().collection('users').doc(currentUser.uid).get()
    .then(userDoc => {
        if (!userDoc.exists()) {
            console.error('❌ User document not found');
            return;
        }

        const userData = userDoc.data();
        if (userData.role !== 'admin') {
            console.error('❌ Only admin users can run this script');
            return;
        }

        console.log('✅ Admin user confirmed, proceeding with grandfather script...');
        runGrandfatherScript();
    })
    .catch(error => {
        console.error('❌ Error checking admin status:', error);
    });

async function runGrandfatherScript() {
    try {
        console.log('Fetching all users...');

        // Get all users from the users collection
        const usersSnapshot = await firebase.firestore().collection('users').get();

        if (usersSnapshot.empty) {
            console.log('No users found in the database.');
            return;
        }

        console.log(`Found ${usersSnapshot.size} users to process.`);

        const batch = firebase.firestore().batch();
        let updateCount = 0;

        usersSnapshot.forEach((doc) => {
            const userData = doc.data();

            // Only update users who don't have emailVerified field or have it set to false
            if (userData.emailVerified === undefined || userData.emailVerified === false) {
                batch.update(doc.ref, {
                    emailVerified: true,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
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

        console.log('\n🎉 Grandfathering process completed successfully!');
        console.log('Existing users can now access the platform without email verification.');

    } catch (error) {
        console.error('❌ Error during grandfathering process:', error);
    }
}

// Instructions for running the script
console.log(`
📋 INSTRUCTIONS:
1. Make sure you're logged in as an admin user
2. Open browser console (F12)
3. Copy and paste this entire script
4. Press Enter to run

The script will:
- Check if you're an admin user
- Find all existing users
- Set emailVerified: true for users who don't have it
- Preserve existing verification status for users who already have it
`);
