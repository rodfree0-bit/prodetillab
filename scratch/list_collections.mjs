import admin from 'firebase-admin';
import fs from 'fs';

const serviceAccount = JSON.parse(fs.readFileSync('./serviceAccountKey.json', 'utf8'));

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function listCollections() {
    console.log('Listing all collections:');
    const collections = await db.listCollections();
    for (const coll of collections) {
        console.log(`Collection: ${coll.id}`);
        // Let's print the first few docs or sizes
        const snap = await coll.limit(5).get();
        console.log(`  Count (capped at 5): ${snap.size}`);
        snap.forEach(doc => {
            console.log(`    Doc ID: ${doc.id}`);
            console.log(`    Data:`, JSON.stringify(doc.data()).substring(0, 150));
        });
    }
}

listCollections().catch(console.error);
