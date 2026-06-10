"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteUserAccount = void 0;
const functions = __importStar(require("firebase-functions/v1"));
const admin = __importStar(require("firebase-admin"));
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
exports.deleteUserAccount = functions.region('us-central1').https.onCall(async (data, context) => {
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
    }
    catch (error) {
        console.error(`❌ Error during account deletion for ${uid}:`, error);
        throw new functions.https.HttpsError('internal', error.message || 'Error al intentar borrar la cuenta.');
    }
});
//# sourceMappingURL=deleteUser.js.map