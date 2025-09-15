// Verify and fix admin user setup
// Run this in browser console when logged in

console.log('🔍 Verifying Admin User Setup...');

window.verifyAdminSetup = async function () {
    try {
        console.log('1️⃣ Checking current user...');

        // Get current user
        const { auth, db } = await import('./frontend/src/services/firebase/config.js');
        const { getDoc, doc, updateDoc } = await import('firebase/firestore');

        const currentUser = auth.currentUser;
        if (!currentUser) {
            console.error('❌ No user logged in. Please log in first.');
            return;
        }

        console.log('👤 Current user:', {
            uid: currentUser.uid,
            email: currentUser.email,
            emailVerified: currentUser.emailVerified
        });

        console.log('2️⃣ Checking user document in Firestore...');

        // Check user document
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));

        if (!userDoc.exists()) {
            console.error('❌ User document does not exist in Firestore');
            console.log('💡 You may need to complete registration or create the user document');
            return;
        }

        const userData = userDoc.data();
        console.log('📄 User document:', userData);

        console.log('3️⃣ Checking admin status...');

        const isAdmin = userData.role === 'admin';
        console.log('🔑 Is admin (role-based):', isAdmin);

        // Check if email is in admin list
        const adminEmails = ['admin@ustp.edu.ph', 'superadmin@ustp.edu.ph', 'admin@uniclaim.com', 'cs@uniclaim.com'];
        const isAdminByEmail = adminEmails.includes(currentUser.email);
        console.log('📧 Is admin (email-based):', isAdminByEmail);

        console.log('4️⃣ Fixing admin setup if needed...');

        if (!isAdmin && !isAdminByEmail) {
            console.log('⚠️ User is not admin. Setting role to admin...');

            try {
                await updateDoc(doc(db, 'users', currentUser.uid), {
                    role: 'admin',
                    status: 'active',
                    emailVerified: true
                });

                console.log('✅ Updated user to admin role');
            } catch (updateError) {
                console.error('❌ Failed to update user role:', updateError);
                console.log('💡 You may need to manually set role: "admin" in Firestore console');
            }
        }

        console.log('5️⃣ Testing admin notifications access...');

        // Test admin notifications
        try {
            const { adminNotificationService } = await import('./frontend/src/services/firebase/adminNotifications.js');

            console.log('📦 Admin notification service loaded');

            // Test creating a notification
            const testId = await adminNotificationService.createAdminNotification({
                type: 'system_alert',
                title: 'Setup Verification Test',
                message: 'Testing admin setup - ' + new Date().toLocaleTimeString(),
                priority: 'normal',
                adminId: 'all',
                data: { setupTest: true }
            });

            console.log('✅ Created test notification:', testId);

            // Test retrieving notifications
            const notifications = await adminNotificationService.getAdminNotifications(currentUser.uid, 5);
            console.log('📋 Retrieved notifications:', notifications.length);

            if (notifications.length > 0) {
                console.log('🎉 SUCCESS! Admin notifications are working!');
                console.log('✅ You should now see notifications in the admin dashboard');
            } else {
                console.log('⚠️ No notifications retrieved, but no errors occurred');
            }

        } catch (notifError) {
            console.error('❌ Admin notifications error:', notifError);
        }

        console.log('6️⃣ Summary:');
        console.log('User ID:', currentUser.uid);
        console.log('Email:', currentUser.email);
        console.log('Role:', userData.role);
        console.log('Status:', userData.status);
        console.log('Admin Access:', isAdmin || isAdminByEmail);

    } catch (error) {
        console.error('❌ Verification error:', error);
    }
};

// Auto-run
window.verifyAdminSetup();

console.log('🎯 Function available as window.verifyAdminSetup()');
