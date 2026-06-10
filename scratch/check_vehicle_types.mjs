import admin from 'firebase-admin';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config({ path: '.env.production' });

if (!admin.apps.length) {
    const serviceAccountPath = './serviceAccountKey.json';
    if (fs.existsSync(serviceAccountPath)) {
        const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
    } else {
        admin.initializeApp({
            projectId: process.env.VITE_FIREBASE_PROJECT_ID,
        });
    }
}

const db = admin.firestore();

async function run() {
    const snapshot = await db.collection('vehicle_types').get();
    console.log('Vehicle Types in Firestore:');
    snapshot.forEach(doc => {
        console.log(`- ${doc.id}: ${doc.data().name} (active: ${doc.data().active})`);
    });

    const packagesSnapshot = await db.collection('packages').get();
    console.log('\nPackage Prices in Firestore:');
    packagesSnapshot.forEach(doc => {
        console.log(`Package: ${doc.id} (${doc.data().name})`);
        console.log('Prices:', JSON.stringify(doc.data().price, null, 2));
    });
}

run().then(() => process.exit(0)).catch(err => {
    console.error(err);
    process.exit(1);
});
