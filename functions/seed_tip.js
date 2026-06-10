/**
 * One-time script to manually seed the first SEO tip to Firestore.
 * Uses Firebase application default credentials (gcloud auth).
 * Run: node seed_tip.js
 */

const admin = require('firebase-admin');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Uses application default credentials (from firebase login / gcloud auth)
admin.initializeApp({
    projectId: 'my-carwashapp-e6aba',
});

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

async function seedTip() {
    if (!GEMINI_API_KEY) {
        console.error('❌ GEMINI_API_KEY not set.');
        console.error('   Run: $env:GEMINI_API_KEY="your_key"; node seed_tip.js');
        process.exit(1);
    }

    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const prompt = `
    You are a premium corporate "auto detailing" expert and marketer based in Los Angeles, California.
    Write a short, highly engaging tip (maximum 2 short paragraphs, around 60-80 words total)
    about car care aimed at premium customers.

    SEO Instructions:
    - Subtly include keywords like "mobile car wash", "mobile detailing", or "Los Angeles".
    - The tone must be professional, educational, and persuasive.
    - Do not use greetings or sign-offs, get straight to the tip.
    - End the tip by subtly inviting them to book a service through our mobile app.

    Format Example:
    The intense Los Angeles sun damages paint quickly. Discover how our mobile ceramic coating protects it 365 days a year. Schedule your mobile car wash in our app today.
  `;

    console.log('🤖 Generating SEO tip with Gemini...');
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    console.log('\n✅ Generated tip:\n', text);

    const tipsRef = admin.firestore().collection('seo_daily_tips');
    await tipsRef.add({
        content: text.trim(),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        active: true,
    });

    console.log('\n🔥 Tip saved to Firestore! It will appear on the landing page now.');
    process.exit(0);
}

seedTip().catch((err) => {
    console.error('❌ Error:', err.message);
    process.exit(1);
});
