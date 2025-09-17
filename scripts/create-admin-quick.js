// Quick admin user creation for testing
// Run this in Node.js: node create-admin-quick.js

const { initializeApp } = require('firebase/app');
const { getAuth, createUserWithEmailAndPassword, updateProfile } = require('firebase/auth');
const { getFirestore, doc, setDoc, getDoc, serverTimestamp } = require('firebase/firestore');

// Firebase config
const firebaseConfig = {
    apiKey: "AIzaSyCgN70CTX2wQpcgoSZF6AK0fuq7ikcQgNs",
    authDomain: "uniclaim2.firebaseapp.com",
    projectId: "uniclaim2",
    storageBucket: "uniclaim2.appspot.com",
    messagingSenderId: "38339063459",
    appId: "1:38339063459:web:3b5650ebe6fabd352b1916",
    measurementId: "G-E693CKMPSY"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

async function createQuickAdmin() {
    try {
        console.log('🚀 Creating quick admin user...');

        const adminEmail = 'testadmin@uniclaim.com';
        const adminPassword = 'TestAdmin123!';

        // Create user
        const userCredential = await createUserWithEmailAndPassword(auth, adminEmail, adminPassword);
        const user = userCredential.user;

        console.log('✅ User created:', user.uid);

        // Update profile
        await updateProfile(user, {
            displayName: 'Test Admin'
        });

        // Create user document with admin role
        await setDoc(doc(db, 'users', user.uid), {
            uid: user.uid,
            email: adminEmail,
            firstName: 'Test',
            lastName: 'Admin',
            contactNum: '1234567890',
            studentId: 'ADMIN001',
            role: 'admin', // This is the key field for admin access
            status: 'active', // Must be active
            emailVerified: true, // Skip email verification for testing
            profilePicture: '/src/assets/empty_profile.jpg', // Default profile picture
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });

        console.log('📄 User document created with admin role');

        // Verify the document was created
        const verifyDoc = await getDoc(doc(db, 'users', user.uid));
        if (verifyDoc.exists()) {
            console.log('✅ User document verified:', verifyDoc.data());
        } else {
            console.error('❌ Failed to create user document');
        }

        console.log('✅ Admin user created successfully!');
        console.log('📧 Email:', adminEmail);
        console.log('🔑 Password:', adminPassword);
        console.log('🎭 Role: admin');
        console.log('\n🔄 You can now log in with these credentials and test admin notifications');

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

createQuickAdmin();
