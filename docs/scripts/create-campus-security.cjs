// Script to create Campus Security account
// Run this script once to set up the campus security user

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

// Campus Security account details
const campusSecurityData = {
    email: 'cs@uniclaim.com',
    password: 'CampusSecurity2024!', // You can change this password
    firstName: 'Campus',
    lastName: 'Security',
    contactNum: '09123456789', // You can change this
    studentId: 'CS001' // You can change this
};

async function createCampusSecurityAccount() {
    try {
        console.log('🚀 Starting Campus Security account creation...');
        console.log('📧 Email:', campusSecurityData.email);
        console.log('🔑 Password:', campusSecurityData.password);
        console.log('👤 Name:', `${campusSecurityData.firstName} ${campusSecurityData.lastName}`);
        console.log('📱 Contact:', campusSecurityData.contactNum);
        console.log('🆔 Student ID:', campusSecurityData.studentId);
        console.log('⏳ Creating Firebase user...');

        // Create user with email and password
        const userCredential = await createUserWithEmailAndPassword(
            auth,
            campusSecurityData.email,
            campusSecurityData.password
        );

        const user = userCredential.user;
        console.log('User created with UID:', user.uid);

        // Update profile display name
        await updateProfile(user, {
            displayName: `${campusSecurityData.firstName} ${campusSecurityData.lastName}`
        });

        // Create user document in Firestore
        const userData = {
            uid: user.uid,
            email: user.email,
            firstName: campusSecurityData.firstName,
            lastName: campusSecurityData.lastName,
            contactNum: campusSecurityData.contactNum,
            studentId: campusSecurityData.studentId,
            profilePicture: 'https://res.cloudinary.com/dopuxb8xw/image/upload/v1701234567/profile_pictures/campus_security_default.jpg', // Default Campus Security profile picture
            role: 'campus_security',
            status: 'active',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        };

        await setDoc(doc(db, 'users', user.uid), userData);
        console.log('User document created in Firestore');

        console.log('✅ Campus Security account created successfully!');
        console.log('Email:', campusSecurityData.email);
        console.log('Password:', campusSecurityData.password);
        console.log('Display Name:', `${campusSecurityData.firstName} ${campusSecurityData.lastName}`);

    } catch (error) {
        console.error('❌ Error creating Campus Security account:', error.message);
    }
}

// Run the function
createCampusSecurityAccount();
