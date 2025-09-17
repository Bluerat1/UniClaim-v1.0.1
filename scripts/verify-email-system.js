// Email Verification System Verification Script
// Run this in browser console to check the current state of the email verification system

console.log('🔍 Email Verification System Verification Script');
console.log('================================================');

// Check if user is logged in
const currentUser = firebase.auth().currentUser;
if (!currentUser) {
    console.log('❌ No user logged in. Please log in first.');
    console.log('💡 Log in and run this script again to check verification status.');
    return;
}

console.log('✅ User logged in:', currentUser.email);
console.log('📧 Firebase email verified:', currentUser.emailVerified);

// Get user data from Firestore
firebase.firestore().collection('users').doc(currentUser.uid).get()
    .then(userDoc => {
        if (!userDoc.exists()) {
            console.log('❌ User document not found in Firestore');
            return;
        }

        const userData = userDoc.data();
        console.log('👤 User role:', userData.role || 'user');
        console.log('📧 Firestore emailVerified:', userData.emailVerified);

        // Check verification status
        const needsVerification = !currentUser.emailVerified ||
            (userData.emailVerified !== undefined ? !userData.emailVerified : false);

        console.log('\n🔐 Verification Status:');
        console.log('======================');

        if (userData.role === 'admin' || userData.role === 'campus_security') {
            console.log('✅ Admin/Campus Security - Verification bypassed');
        } else if (needsVerification) {
            console.log('❌ User needs email verification');
            console.log('💡 User will be redirected to verification page');
        } else {
            console.log('✅ User is verified and can access platform');
        }

        // Check if user is grandfathered
        if (userData.emailVerified === undefined) {
            console.log('👴 User is grandfathered (no emailVerified field)');
        }

        console.log('\n📊 System Status:');
        console.log('=================');
        console.log('Firebase Auth verified:', currentUser.emailVerified);
        console.log('Firestore verified:', userData.emailVerified);
        console.log('User role:', userData.role || 'user');
        console.log('Needs verification:', needsVerification);

        // Recommendations
        console.log('\n💡 Recommendations:');
        console.log('===================');

        if (userData.role !== 'admin' && userData.role !== 'campus_security') {
            if (userData.emailVerified === undefined) {
                console.log('⚠️  Run grandfather script to set emailVerified: true');
            } else if (!userData.emailVerified) {
                console.log('📧 User needs to verify email');
            } else {
                console.log('✅ User is properly verified');
            }
        } else {
            console.log('✅ Admin/Campus Security user - no action needed');
        }

    })
    .catch(error => {
        console.error('❌ Error checking user data:', error);
    });

// Check if email verification system is properly set up
console.log('\n🔧 System Check:');
console.log('================');

// Check if EmailVerificationRoute exists
if (typeof window !== 'undefined' && window.location) {
    console.log('🌐 Current page:', window.location.pathname);

    if (window.location.pathname === '/email-verification') {
        console.log('📧 User is on email verification page');
    } else if (window.location.pathname === '/login') {
        console.log('🔑 User is on login page');
    } else {
        console.log('🏠 User is on main platform');
    }
}

// Check for common issues
console.log('\n🚨 Common Issues Check:');
console.log('=======================');

// Check if user is stuck in redirect loop
if (window.location.pathname === '/email-verification' && currentUser.emailVerified) {
    console.log('⚠️  Potential issue: User on verification page but email is verified');
    console.log('💡 Check if Firestore emailVerified field is set to true');
}

// Check if admin user is on verification page
firebase.firestore().collection('users').doc(currentUser.uid).get()
    .then(userDoc => {
        if (userDoc.exists()) {
            const userData = userDoc.data();
            if ((userData.role === 'admin' || userData.role === 'campus_security') &&
                window.location.pathname === '/email-verification') {
                console.log('⚠️  Potential issue: Admin/Campus Security on verification page');
                console.log('💡 Admin users should bypass verification');
            }
        }
    });

console.log('\n🎯 Next Steps:');
console.log('==============');
console.log('1. If user needs verification, check email inbox');
console.log('2. If admin user, should bypass verification');
console.log('3. If existing user locked out, run grandfather script');
console.log('4. If new user, complete email verification process');

console.log('\n✨ Verification script completed!');
