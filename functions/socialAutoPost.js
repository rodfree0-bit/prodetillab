
const admin = require('firebase-admin');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { enhanceImage } = require("./imageProcessor");

/**
 * Prepares a social media post draft when an order is completed.
 */
async function prepareAutoPost(orderId, orderData) {
    console.log(`🚀 Preparing social auto-post for order: ${orderId}`);
    
    try {
        const configSnap = await admin.firestore().collection('social_config').doc('general').get();
        const config = configSnap.exists ? configSnap.data() : { autoPostEnabled: true, aiCaptionEnabled: true };

        if (!config.autoPostEnabled) {
            console.log('⚠️ Social auto-post is disabled in config.');
            return;
        }

        const { service, vehicle, location, photos = [] } = orderData;
        
        // 1. Process the main image (if any)
        let mainPhoto = photos.length > 0 ? photos[0] : null;
        let enhancedPhotoUrl = mainPhoto;

        if (mainPhoto && mainPhoto.includes('firebase-storage')) {
            try {
                // Extract path from URL (simplified for example)
                const decodedUrl = decodeURIComponent(mainPhoto);
                const pathParts = decodedUrl.split('/o/')[1].split('?')[0];
                const enhancedResult = await enhanceImage(pathParts);
                if (enhancedResult) {
                    enhancedPhotoUrl = enhancedResult.url;
                    console.log('✨ Enhanced photo generated successfully!');
                }
            } catch (err) {
                console.error('❌ Failed to process photo:', err);
            }
        }

        // 2. Generate Viral Caption with AI
        let caption = `Just finished a ${service} on this ${vehicle} in ${location}! ✨🚿 #carwash #detailing`;
        
        if (config.aiCaptionEnabled) {
            try {
                const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_KEY);
                const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

                const prompt = `
                    You are a world-class social media marketing expert for a luxury car wash business called "Snowy Carwash".
                    You are writing an Instagram/Facebook post for a ${service} service on a ${vehicle} in ${location}.
                    
                    RULES:
                    - Use a "Viral Hook": Start with something that grabs attention (e.g. POV, STORY, SHOCK).
                    - Professional & Premium Tone: Use emojis but keep it high-end.
                    - Call to Action: Encourage people to book or comment.
                    - Even if the photo is simple, find a "Story": Maybe it's about the paint perl, the clean lines, or the feeling of a fresh car.
                    - Include 5 relevant hashtags including #snowycarwash.
                    - Keep it under 300 characters.
                `;

                const result = await model.generateContent(prompt);
                caption = result.response.text().trim();
            } catch (err) {
                console.error('❌ AI Captioning failed:', err);
            }
        }

        // 3. Save to pending_posts
        await admin.firestore().collection('pending_posts').add({
            orderId,
            service,
            vehicle,
            location,
            photos: [enhancedPhotoUrl, ...photos.slice(1)],
            originalPhotos: photos,
            caption,
            status: 'pending_approval',
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        console.log('✅ Pending social post created successfully!');
    } catch (error) {
        console.error('❌ Error in prepareAutoPost:', error);
    }
}

/**
 * Re-generates a caption for an existing post draft.
 */
async function regenerateSocialCaption(data) {
    const { service, vehicle, location } = data;
    try {
        const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        const prompt = `Write a viral, professional Instagram caption for a ${service} on a ${vehicle} in ${location} for Snowy Carwash. 
        Focus on a different angle than before (e.g. if before was technical, now be lifestyle or luxury). Use emojis and strong hashtags.`;

        const result = await model.generateContent(prompt);
        return { caption: result.response.text().trim() };
    } catch (error) {
        console.error('❌ AI Regeneration failed:', error);
        throw new Error('AI Regeneration failed');
    }
}

module.exports = { prepareAutoPost, regenerateSocialCaption };
