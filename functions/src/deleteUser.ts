import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';

/**
 * Cloud Function: deleteUserAccount
 * 
 * Securely deletes everything related to a user:
 * 1. Firestore profile
 * 2. Associated orders
 * 3. Associated notifications
 * 4. Associated messages
 * 5. Firebase Auth record
 */
export const deleteUserAccount = functions.region('us-central1').https.onCall(async (data, context) => {
    // 1. Verify Authentication
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Debes estar autenticado para borrar tu cuenta.');
    }

    const uid = context.auth.uid;
    const email = context.auth.token.email;

    console.log(`🗑️ Starting deep deletion for user ${uid} (${email})`);

    try {
        const db = admin.firestore();

        // 2. Delete Firestore User Document
        await db.collection('users').doc(uid).delete();
        console.log(`✅ Deleted user document: ${uid}`);

        // 3. Delete Verification Codes if any
        if (email) {
            await db.collection('verification_codes').doc(email).delete();
            console.log(`✅ Deleted verification codes for: ${email}`);
        }

        // 4. Batch delete user-related data (Orders, Notifications, Messages)
        // Note: For very large datasets, this might need a more complex recursive delete, 
        // but for a typical user this is sufficient.

        const collectionsToCleanup = [
            { name: 'orders', field: 'clientId' },
            { name: 'notifications', field: 'userId' },
            { name: 'messages', field: 'senderId' },
            { name: 'messages', field: 'receiverId' }
        ];

        for (const col of collectionsToCleanup) {
            const snapshot = await db.collection(col.name).where(col.field, '==', uid).get();
            if (!snapshot.empty) {
                const batch = db.batch();
                snapshot.docs.forEach(doc => batch.delete(doc.ref));
                await batch.commit();
                console.log(`✅ Deleted ${snapshot.size} documents from ${col.name}`);
            }
        }

        // 5. Delete Firebase Auth Record
        await admin.auth().deleteUser(uid);
        console.log(`✅ Deleted Auth account for UID: ${uid}`);

        return { success: true, message: 'Cuenta borrada exitosamente.' };

    } catch (error: any) {
        console.error(`❌ Error during account deletion for ${uid}:`, error);
        throw new functions.https.HttpsError('internal', error.message || 'Error al intentar borrar la cuenta.');
    }
});
