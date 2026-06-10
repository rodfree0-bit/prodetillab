import { db } from './firebase.js'; // Assuming firebase.js exports 'db'
import { collection, addDoc, getDocs, query, where, deleteDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import tipsBank from './seo_daily_bank.json' with { type: 'json' };

async function seedTips() {
    console.log("Starting AI SEO Tips seeding...");
    const tipsRef = collection(db, 'seo_daily_tips');

    // 1. Clean existing daily tips
    const existing = await getDocs(tipsRef);
    for (const doc of existing.docs) {
        await deleteDoc(doc.ref);
    }
    console.log("Cleaned old tips.");

    // 2. Upload new AI bank
    for (const tip of tipsBank) {
        await addDoc(tipsRef, {
            ...tip,
            createdAt: new Date()
        });
        console.log(`Uploaded Day ${tip.dayId}: ${tip.title}`);
    }
    
    console.log("Seeding complete! 31 AI tips are now active.");
}

// Note: This script is intended to be run manually or via a temporary HTML page to trigger the upload.
// In a real environment, you'd run this via Node.js or a Firebase Admin script.
