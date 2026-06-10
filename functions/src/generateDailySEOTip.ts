import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Asegúrate de configurar la API Key de Gemini en los secrets de Firebase:
// firebase functions:secrets:set GEMINI_API_KEY
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export const generateDailySEOTip = functions.pubsub.schedule('0 8 * * *')
    .timeZone('America/Los_Angeles')
    .onRun(async (context: functions.EventContext) => {
        try {
            // Verificar si la API key está presente
            if (!process.env.GEMINI_API_KEY) {
                console.error("GEMINI_API_KEY is not set in environment variables.");
                return null;
            }

            const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro-latest" });

            const prompt = `
                You are a premium corporate "auto detailing" expert and marketer based in Los Angeles, California.
                Write a short, highly engaging tip (maximum 2 short paragraphs, around 60-80 words in total) 
                about car care aimed at premium customers.
                
                SEO Instructions:
                - Subtly include keywords like "mobile car wash", "mobile detailing", or "Los Angeles".
                - The tone must be professional, educational, and persuasive.
                - Do not use greetings or sign-offs, get straight to the tip.
                - End the tip by subtly inviting them to book a service through our mobile app.

                Format Example:
                The intense Los Angeles sun damages paint quickly. Discover how our mobile ceramic coating protects it 365 days a year. Schedule your home wash in our app today.
            `;

            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();

            // Guardar en Firestore
            const tipsRef = admin.firestore().collection('seo_daily_tips');

            await tipsRef.add({
                content: text.trim(),
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                active: true
            });

            console.log("SEO Tip generated successfully:", text.substring(0, 50) + "...");

            // Opcional: Mantener limpia la bd (Borrar tips de hace más de 30 días)
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            const oldTips = await tipsRef.where('createdAt', '<', thirtyDaysAgo).get();
            const batch = admin.firestore().batch();

            oldTips.docs.forEach((doc) => {
                batch.delete(doc.ref);
            });

            if (!oldTips.empty) {
                await batch.commit();
                console.log(`Deleted ${oldTips.size} old SEO tips.`);
            }

            return null;

        } catch (error) {
            console.error("Error generating daily SEO tip:", error);
            return null;
        }
    });
