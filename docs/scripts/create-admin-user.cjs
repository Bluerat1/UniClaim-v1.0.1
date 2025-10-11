// Script to create Admin account for testing admin badge
// Run this script once to set up an admin user

const { initializeApp } = require('firebase/app');
const { getAuth, createUserWithEmailAndPassword, updateProfile } = require('firebase/auth');
const { getFirestore, doc, setDoc, serverTimestamp } = require('firebase/firestore');

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

// Admin account details
const adminData = {
    email: 'admin@uniclaim.com',
    password: 'Admin2024!', // You can change this password
    firstName: 'System',
    lastName: 'Administrator',
    contactNum: '09123456789', // You can change this
    studentId: 'ADMIN001' // You can change this
};

async function createAdminAccount() {
    try {
        console.log('🚀 Starting Admin account creation...');
        console.log('📧 Email:', adminData.email);
        console.log('🔑 Password:', adminData.password);
        console.log('👤 Name:', `${adminData.firstName} ${adminData.lastName}`);
        console.log('📱 Contact:', adminData.contactNum);
        console.log('🆔 Student ID:', adminData.studentId);
        console.log('⏳ Creating Firebase user...');

        // Create user with email and password
        const userCredential = await createUserWithEmailAndPassword(
            auth,
            adminData.email,
            adminData.password
        );

        const user = userCredential.user;
        console.log('User created with UID:', user.uid);

        // Update profile display name
        await updateProfile(user, {
            displayName: `${adminData.firstName} ${adminData.lastName}`
        });

        // Create user document in Firestore
        const userData = {
            uid: user.uid,
            email: user.email,
            firstName: adminData.firstName,
            lastName: adminData.lastName,
            contactNum: adminData.contactNum,
            studentId: adminData.studentId,
            role: 'admin', // This is the key field for admin badge
            status: 'active',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        };

        await setDoc(doc(db, 'users', user.uid), userData);
        console.log('User document created in Firestore');

        console.log('✅ Admin account created successfully!');
        console.log('Email:', adminData.email);
        console.log('Password:', adminData.password);
        console.log('Display Name:', `${adminData.firstName} ${adminData.lastName}`);
        console.log('Role:', 'admin');

    } catch (error) {
        console.error('❌ Error creating Admin account:', error.message);
    }
}

// Run the function
createAdminAccount();
