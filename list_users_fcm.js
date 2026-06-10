const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function checkUsersFcm() {
    console.log('=== Checking Firestore Users FCM Tokens ===');
    const usersSnap = await db.collection('users').get();
    
    usersSnap.forEach(doc => {
        const data = doc.data();
        console.log(`\nUID: ${doc.id}`);
        console.log(`Name: ${data.name || 'N/A'}`);
        console.log(`Email: ${data.email || 'N/A'}`);
        console.log(`Role: ${data.role || 'N/A'}`);
        console.log(`FCM Token: ${data.fcmToken ? (data.fcmToken.substring(0, 30) + '...') : '❌ Missing'}`);
        if (data.fcmToken) {
            console.log(`FCM Token Length: ${data.fcmToken.length}`);
            if (data.fcmToken === 'SIMULATOR_TOKEN' || data.fcmToken.includes('placeholder')) {
                console.log('⚠️ Token looks like a placeholder/simulator value');
            }
        }
    });
}

checkUsersFcm()
    .then(() => {
        console.log('\nDone.');
        process.exit(0);
    })
    .catch(err => {
        console.error(err);
        process.exit(1);
    });
