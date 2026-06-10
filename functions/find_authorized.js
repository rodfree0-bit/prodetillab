const { initializeApp } = require('firebase/app');
const { getFirestore, collection, query, where, getDocs } = require('firebase/firestore');

const firebaseConfig = {
    apiKey: "AIzaSyCPPR8D8Jk1hMWR2IHBCxSG7u5S3XKnSsk",
    authDomain: "my-carwashapp-e6aba.firebaseapp.com",
    projectId: "my-carwashapp-e6aba",
    storageBucket: "my-carwashapp-e6aba.firebasestorage.app",
    messagingSenderId: "1095794498344",
    appId: "1:1095794498344:web:515d51f8f2561ad7a84e1d"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function findAuthorizedOrders() {
    console.log('🔍 Searching for "Authorized" orders...');
    const q = query(collection(db, 'orders'), where('paymentStatus', '==', 'Authorized'));
    const s = await getDocs(q);

    console.log(`📋 Found ${s.size} orders in Authorized state.`);
    s.forEach(d => {
        const data = d.data();
        console.log(`ORDER_ID: ${d.id}, PI: ${data.paymentIntentId}, PRICE: ${data.price}, STATUS: ${data.status}`);
    });

    process.exit(0);
}

findAuthorizedOrders().catch(err => {
    console.error(err);
    process.exit(1);
});
