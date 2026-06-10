"use strict";
/**
 * Cloud Function: Generate and Send Verification Code
 *
 * Generates a 6-digit code, saves it to Firestore, and sends it via email.
 */
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
exports.sendVerificationCode = void 0;
const functions = __importStar(require("firebase-functions/v1"));
const admin = __importStar(require("firebase-admin"));
const nodemailer = __importStar(require("nodemailer"));
// Configure email transporter with a factory for better error handling
const getTransporter = () => {
    var _a, _b;
    const user = process.env.EMAIL_USER || ((_a = functions.config().email) === null || _a === void 0 ? void 0 : _a.user);
    const pass = process.env.EMAIL_PASSWORD || ((_b = functions.config().email) === null || _b === void 0 ? void 0 : _b.password);
    if (!user || !pass) {
        console.error('❌ EMAIL CONFIG MISSING: Please ensure EMAIL_USER and EMAIL_PASSWORD are set in the environment.');
        throw new Error('E-mail service is not configured correctly on the server.');
    }
    return nodemailer.createTransport({
        service: 'gmail',
        auth: { user, pass }
    });
};
exports.sendVerificationCode = functions.region('us-central1').https.onCall(async (data, context) => {
    var _a;
    const { email } = data;
    // Validate email
    if (!email || typeof email !== 'string' || !email.includes('@')) {
        console.error('❌ Invalid email provided:', email);
        throw new functions.https.HttpsError('invalid-argument', 'A valid email is required');
    }
    try {
        console.log(`📧 Preparing verification code for: ${email}`);
        // Check for existing document to track resends
        const existingDoc = await admin.firestore().collection('verification_codes').doc(email).get();
        let resendCount = 0;
        if (existingDoc.exists) {
            const data = existingDoc.data();
            resendCount = (data === null || data === void 0 ? void 0 : data.resendCount) || 0;
            // Limit resends to 3 (4 total attempts)
            if (resendCount >= 3) {
                console.warn(`🛑 Resend limit reached for ${email} (${resendCount} resends)`);
                throw new functions.https.HttpsError('resource-exhausted', 'Has alcanzado el límite de reenvíos (máximo 3). Por favor, intenta más tarde.');
            }
            resendCount += 1;
            console.log(`🔄 Resending code to ${email}. Count: ${resendCount}`);
        }
        // Generate 6-digit code
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        // Save code to Firestore with a 10-minute expiration
        const expiresAt = admin.firestore.Timestamp.fromMillis(Date.now() + 10 * 60 * 1000);
        await admin.firestore().collection('verification_codes').doc(email).set({
            code,
            email,
            resendCount,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            expiresAt,
            attempts: 0,
            verified: false
        }, { merge: true });
        console.log(`💾 Code ${code} saved to Firestore for ${email} (Resend: ${resendCount})`);
        // Get transporter (this will throw if not configured)
        const transporter = getTransporter();
        // Send email with the code
        const mailOptions = {
            from: `"Pro Detail Lab" <${((_a = functions.config().email) === null || _a === void 0 ? void 0 : _a.user) || 'prodetaillab@gmail.com'}>`,
            to: email,
            subject: 'Your Verification Code - Pro Detail Lab',
            html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 12px;">
          <h2 style="color: #3b82f6; text-align: center;">Pro Detail Lab</h2>
          <p style="font-size: 16px; color: #374151;">Hello,</p>
          <p style="font-size: 16px; color: #374151;">Here is your verification code for the Pro Detail Lab:</p>
          <div style="background: #f8fafc; padding: 30px; border-radius: 12px; text-align: center; margin: 25px 0; border: 1px dashed #cbd5e1;">
            <h1 style="color: #1e293b; font-size: 48px; margin: 0; letter-spacing: 12px; font-weight: 800;">${code}</h1>
          </div>
          <p style="color: #64748b; font-size: 14px; text-align: center;"><b>IMPORTANT:</b> Enter this code directly in the app. You don't need to click any external links.</p>
          <p style="color: #64748b; font-size: 14px; text-align: center;">This code will expire in 10 minutes for your security.</p>
          <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 20px 0;">
          <p style="color: #94a3b8; font-size: 12px; text-align: center;">If you didn't request this code, you can safely ignore this email.</p>
        </div>
      `
        };
        await transporter.sendMail(mailOptions);
        console.log(`✅ Verification code successfully sent to ${email}`);
        return {
            success: true,
            message: 'Verification code sent successfully',
            expiresIn: 600 // 10 minutes in seconds
        };
    }
    catch (error) {
        console.error('❌ Error in sendVerificationCode:', error);
        // Return a more descriptive error if it's a configuration issue
        if (error.message.includes('not configured')) {
            throw new functions.https.HttpsError('failed-precondition', error.message);
        }
        throw new functions.https.HttpsError('internal', error.message || 'Failed to send verification code');
    }
});
//# sourceMappingURL=sendVerificationCode.js.map