// Debug script to test post creation with detailed logging
const { initializeApp } = require('firebase/app');
const { getAuth, signInWithEmailAndPassword } = require('firebase/auth');
const { getFirestore, collection, addDoc, serverTimestamp } = require('firebase/firestore');

// Firebase configuration for Uniclaim app
const firebaseConfig = {
    apiKey: "AIzaSyCgN70CTX2wQpcgoSZF6AK0fuq7ikcQgNs",
    authDomain: "uniclaim2.firebaseapp.com",
    projectId: "uniclaim2",
    storageBucket: "uniclaim2.appspot.com",
    messagingSenderId: "38339063459",
    appId: "1:38339063459:web:3b5650ebe6fabd352b1916",
    measurementId: "G-E693CKMPSY"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

async function debugPostCreation() {
    try {
        console.log('🔍 Debugging Campus Security post creation...');

        // Test with a simple user account first
        console.log('⚠️  This test requires a valid user account.');
        console.log('Please update the email and password below with a real user account.');

        // For now, let's just validate the post structure
        const testPost = {
            title: 'Debug Test Item',
            description: 'Testing Campus Security ownership transfer.',
            category: 'Electronics',
            location: 'Library',
            type: 'found',
            status: 'pending',
            foundAction: 'turnover to Campus Security',
            user: {
                firstName: 'Campus',
                lastName: 'Security',
                email: 'cs@uniclaim.com',
                contactNum: '',
                studentId: '',
                profilePicture: null
            },
            images: [],
            dateTime: new Date().toISOString(),
            createdAt: serverTimestamp()
        };

        console.log('📋 Post data structure:');
        console.log(JSON.stringify(testPost, null, 2));

        // Check if all required fields are present
        const requiredFields = ['title', 'description', 'category', 'location', 'type', 'user', 'status'];
        const missingFields = requiredFields.filter(field => !testPost[field]);

        if (missingFields.length > 0) {
            console.log('❌ Missing required fields:', missingFields);
        } else {
            console.log('✅ All required fields present');
        }

        // Check user email
        console.log('📧 User email:', testPost.user.email);
        console.log('🎯 Expected: cs@uniclaim.com');
        console.log('✅ Email matches:', testPost.user.email === 'cs@uniclaim.com');

        console.log('\n🔍 Firestore Rules Check:');
        console.log('✅ Has all required fields:', requiredFields.every(field => testPost[field]));
        console.log('✅ Valid type:', ['lost', 'found'].includes(testPost.type));
        console.log('✅ Valid status:', ['pending', 'resolved', 'unclaimed'].includes(testPost.status));
        console.log('✅ Valid user email:', testPost.user.email === 'cs@uniclaim.com');

        return true;

    } catch (error) {
        console.error('❌ Error in debug:', error.message);
        return false;
    }
}

// Run the debug
debugPostCreation();

