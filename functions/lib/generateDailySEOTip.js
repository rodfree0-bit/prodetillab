"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateDailySEOTip = void 0;
const functions = __importStar(require("firebase-functions/v1"));
const admin = __importStar(require("firebase-admin"));
const generative_ai_1 = require("@google/generative-ai");
// Asegúrate de configurar la API Key de Gemini en los secrets de Firebase:
// firebase functions:secrets:set GEMINI_API_KEY
const genAI = new generative_ai_1.GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
exports.generateDailySEOTip = functions.pubsub.schedule('0 8 * * *')
    .timeZone('America/Los_Angeles')
    .onRun(async (context) => {
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
    }
    catch (error) {
        console.error("Error generating daily SEO tip:", error);
        return null;
    }
});
//# sourceMappingURL=generateDailySEOTip.js.map