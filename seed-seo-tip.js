const admin = require("firebase-admin");
const tipsBank = require("./landing/seo_daily_bank.json");

const serviceAccount = require('./serviceAccountKey.json');

try {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
} catch (e) {
    // ignore if already initialized
}

async function seedTips() {
    const db = admin.firestore();
    const tipsRef = db.collection('seo_daily_tips');

    console.log("🌱 Cleaning old SEO daily tips...");
    const snapshot = await tipsRef.get();
    const batch = db.batch();
    snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
    });
    await batch.commit();
    console.log("✅ Cleaned old tips.");

    console.log(`🚀 Seeding ${tipsBank.length} SEO tips...`);
    for (const tip of tipsBank) {
        await tipsRef.add({
            ...tip,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
        if (tip.dayId % 50 === 0) console.log(`   Uploaded Day ${tip.dayId}...`);
    }
    
    console.log("✨ Seeding complete! AI daily bank is now LIVE.");
}

seedTips().catch(console.error);
