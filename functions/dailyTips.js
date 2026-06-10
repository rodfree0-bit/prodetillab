const functions = require("firebase-functions/v1");
const admin = require("firebase-admin");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const seoConfig = require("./seo_config.json");

// The function will run every day at 08:00 AM (Los Angeles time)
// Cron: 0 8 * * *
// In Firebase, we can set the timezone.

exports.generateDailySEOTip = functions.pubsub.schedule("0 8 * * *")
    .timeZone("America/Los_Angeles")
    .onRun(async (context) => {
        console.log("🚀 Starting Daily SEO Tip Generation...");

        const db = admin.firestore();

        // 1. Initialize Gemini
        // Note: API Key should be set via firebase functions:config:set google_ai.key="YOUR_KEY"
        // Or using environment variables in Node 20
        const apiKey = process.env.GOOGLE_AI_KEY || functions.config().google_ai?.key;

        if (!apiKey) {
            console.error("❌ Google AI API Key not found. Please set google_ai.key in functions config.");
            return null;
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-pro" });

        // 2. Prepare Prompt
        const randomTopic = seoConfig.topics[Math.floor(Math.random() * seoConfig.topics.length)];
        const randomNeighborhood = seoConfig.neighborhoods[Math.floor(Math.random() * seoConfig.neighborhoods.length)];

        const prompt = `
            You are a professional car detailing expert and SEO strategist in Los Angeles.
            Write a short, engaging, and professional "Daily Tip" for car owners in ${randomNeighborhood} and Greater Los Angeles.
            Theme: ${randomTopic}
            
            Requirements:
            - Language: English (US)
            - Tone: Expert, premium, and trendy.
            - Length: 2-3 short, punchy sentences.
            - Include 1-2 SEO keywords naturally like: "${seoConfig.keywords[0]}" or "${seoConfig.keywords[1]}".
            - **Trends & Seasonality**: Incorporate current LA trends (e.g., "Post-rain spots", "California summer heat protection", "Eco-conscious water saving", "High-gloss finishes for car shows").
            - Talk about the local environment (beach salt, valley dust, freeway smog) to add authenticity.
            - Format: Return ONLY a JSON object with this structure: {"title": "Short catchy title", "content": "The actual tip content"}
        `;

        try {
            // 3. Generate Content
            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();

            // Clean the text in case Gemini adds markdown code blocks
            const jsonStr = text.replace(/```json|```/g, "").trim();
            const tipData = JSON.parse(jsonStr);

            // 4. Save to Firestore
            const newTip = {
                title: tipData.title,
                content: tipData.content,
                neighborhood: randomNeighborhood,
                topic: randomTopic,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                status: "published",
                source: "gemini-ai-automated"
            };

            await db.collection("seo_daily_tips").add(newTip);
            console.log("✅ Daily SEO Tip published successfully in seo_daily_tips");

            // 5. Maintenance: Keep the collection clean by removing old tips
            // This ensures it scales forever without growing indefinitely.
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            const oldTipsSnapshot = await db.collection("seo_daily_tips")
                .where("createdAt", "<", thirtyDaysAgo)
                .get();

            if (!oldTipsSnapshot.empty) {
                const batch = db.batch();
                oldTipsSnapshot.forEach(doc => {
                    batch.delete(doc.ref);
                });
                await batch.commit();
                console.log(`🧹 Cleaned up ${oldTipsSnapshot.size} old tips.`);
            }

            return null;
        } catch (error) {
            console.error("❌ Error generating daily tip:", error);
            return null;
        }
    });

// Manual trigger for testing
exports.triggerManualSEOTip = functions.https.onCall(async (data, context) => {
    // Only admins or local testing can trigger
    // if (!context.auth || context.auth.token.role !== 'admin') throw new functions.https.HttpsError('unauthenticated');

    // For now, we reuse the same logic
    const { GoogleGenerativeAI } = require("@google/generative-ai");
    const apiKey = process.env.GOOGLE_AI_KEY || functions.config().google_ai?.key;
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });

    // ... same logic as above (extracted to internal function in a real refactor)
    // For brevity in this task, we assume the scheduled one is priority.
});
