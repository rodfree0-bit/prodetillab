const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function cleanupTokens() {
    console.log('=== Proactively Cleaning Up Invalid 64-char FCM Tokens ===');
    const usersSnap = await db.collection('users').get();
    
    let count = 0;
    const batch = db.batch();
    
    usersSnap.forEach(doc => {
        const data = doc.data();
        const fcmToken = data.fcmToken;
        
        if (fcmToken) {
            // Check if it is a 64-character hexadecimal token (iOS APNS token)
            if (fcmToken.length === 64 && /^[0-9a-fA-F]+$/.test(fcmToken)) {
                console.log(`🧹 Found invalid 64-char token for ${data.name || 'N/A'} (${data.email || 'N/A'}) - UID: ${doc.id}`);
                const userRef = db.collection('users').doc(doc.id);
                batch.update(userRef, { fcmToken: admin.firestore.FieldValue.delete() });
                count++;
            }
        }
    });

    if (count > 0) {
        await batch.commit();
        console.log(`\n✅ Proactively cleaned up and deleted ${count} invalid tokens in Firestore!`);
    } else {
        console.log('\n✨ No invalid tokens found to clean up.');
    }
}

cleanupTokens()
    .then(() => process.exit(0))
    .catch(err => {
        console.error(err);
        process.exit(1);
    });
