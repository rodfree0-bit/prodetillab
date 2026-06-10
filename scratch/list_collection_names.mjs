import admin from 'firebase-admin';
import fs from 'fs';

const serviceAccount = JSON.parse(fs.readFileSync('./serviceAccountKey.json', 'utf8'));

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function listCollectionNames() {
    console.log('Listing collection names:');
    const collections = await db.listCollections();
    const names = collections.map(c => c.id);
    console.log(names.join(', '));
}

listCollectionNames().catch(console.error);
