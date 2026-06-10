
import admin from 'firebase-admin';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.production' });

if (!admin.apps.length) {
    admin.initializeApp();
}

const db = admin.firestore();

async function initSocialConfig() {
    console.log('🚀 Initializing Social automation config...');
    
    const configRef = db.collection('social_config').doc('general');
    const existing = await configRef.get();
    
    if (!existing.exists) {
        await configRef.set({
            autoPostEnabled: true,
            aiCaptionEnabled: true,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log('✅ Created default social_config/general');
    } else {
        console.log('ℹ️ social_config/general already exists');
    }

    const metaRef = db.collection('social_config').doc('meta');
    const metaExisting = await metaRef.get();
    if (!metaExisting.exists) {
        await metaRef.set({
            connected: false,
            platform: 'meta',
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log('✅ Created placeholder social_config/meta');
    }

    console.log('🏁 Initialization complete.');
    process.exit(0);
}

initSocialConfig().catch(err => {
    console.error('❌ Failed to initialize config:', err);
    process.exit(1);
});
