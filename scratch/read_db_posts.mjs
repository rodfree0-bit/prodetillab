import admin from 'firebase-admin';
import fs from 'fs';

const serviceAccount = JSON.parse(fs.readFileSync('./serviceAccountKey.json', 'utf8'));
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function readPosts() {
    const snap = await db.collection('published_posts').get();
    console.log(`Found ${snap.size} posts:`);
    snap.forEach(doc => {
        console.log(`Document ID: ${doc.id}`);
        console.log(JSON.stringify(doc.data(), null, 2));
        console.log("=" * 60);
    });
}

readPosts();
