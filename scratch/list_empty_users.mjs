import admin from 'firebase-admin';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const serviceAccount = require('../serviceAccountKey.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function checkUsers() {
    console.log('=== Checking Firestore Users ===');
    const usersSnap = await db.collection('users').get();
    
    usersSnap.forEach(doc => {
        const data = doc.data();
        console.log(`UID: ${doc.id}`);
        console.log(`  Name: ${data.name || 'N/A'}`);
        console.log(`  Email: ${data.email || 'N/A'}`);
        console.log(`  Phone: ${data.phone || 'N/A'}`);
        console.log(`  Role: ${data.role || 'N/A'}`);
        console.log(`  Status: ${data.status || 'N/A'}`);
        console.log('-'.repeat(30));
    });
}

checkUsers()
    .then(() => {
        console.log('Done.');
        process.exit(0);
    })
    .catch(err => {
        console.error(err);
        process.exit(1);
    });
