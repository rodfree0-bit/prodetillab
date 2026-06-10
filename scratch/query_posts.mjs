import admin from 'firebase-admin';
import fs from 'fs';

const serviceAccount = JSON.parse(fs.readFileSync('./serviceAccountKey.json', 'utf8'));

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function queryPosts() {
    console.log('--- FETCHING published_posts ---');
    const postsRef = db.collection('published_posts');
    const snap = await postsRef.orderBy('publishedAt', 'desc').get();
    
    console.log(`Total posts: ${snap.size}`);
    snap.forEach(doc => {
        const data = doc.data();
        console.log(`ID: ${doc.id}`);
        console.log(`Vehicle: ${data.vehicle}`);
        console.log(`Service: ${data.service}`);
        console.log(`Photos:`, data.photos);
        console.log(`PublishedAt: ${data.publishedAt ? data.publishedAt.toDate().toISOString() : 'null'}`);
        console.log('---------------------------');
    });
}

queryPosts().catch(console.error);
