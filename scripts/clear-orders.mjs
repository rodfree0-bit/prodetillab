import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, deleteDoc, doc } from 'firebase/firestore';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.production' });

const firebaseConfig = {
    apiKey: process.env.VITE_FIREBASE_API_KEY,
    authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.VITE_FIREBASE_APP_ID
};

console.log('Connecting to Firebase Project:', firebaseConfig.projectId);

if (!firebaseConfig.projectId) {
    console.error('❌ Error: VITE_FIREBASE_PROJECT_ID is not defined in .env.production');
    process.exit(1);
}

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function clearOrders() {
    console.log('🔍 Fetching all documents in "orders" collection...');
    const querySnapshot = await getDocs(collection(db, 'orders'));

    if (querySnapshot.empty) {
        console.log('✅ Collection is already empty. Nothing to delete.');
        return;
    }

    console.log(`⚠️ Found ${querySnapshot.size} orders. Starting deletion...`);

    let count = 0;
    for (const d of querySnapshot.docs) {
        await deleteDoc(doc(db, 'orders', d.id));
        count++;
        if (count % 5 === 0) console.log(`...deleted ${count}/${querySnapshot.size} orders`);
    }

    console.log(`✅ Successfully deleted all ${count} orders.`);
}

clearOrders().catch(err => {
    console.error('❌ Error clearing orders:', err);
    process.exit(1);
});
