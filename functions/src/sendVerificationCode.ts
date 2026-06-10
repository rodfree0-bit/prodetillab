/**
 * Cloud Function: Generate and Send Verification Code
 * 
 * Generates a 6-digit code, saves it to Firestore, and sends it via email.
 */

import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import * as nodemailer from 'nodemailer';

// Configure email transporter with a factory for better error handling
const getTransporter = () => {
    const user = process.env.EMAIL_USER || functions.config().email?.user;
    const pass = process.env.EMAIL_PASSWORD || functions.config().email?.password;

    if (!user || !pass) {
        console.error('❌ EMAIL CONFIG MISSING: Please ensure EMAIL_USER and EMAIL_PASSWORD are set in the environment.');
        throw new Error('E-mail service is not configured correctly on the server.');
    }

    return nodemailer.createTransport({
        service: 'gmail',
        auth: { user, pass }
    });
};

export const sendVerificationCode = functions.region('us-central1').https.onCall(async (data: any, context: functions.https.CallableContext) => {
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
            resendCount = data?.resendCount || 0;

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
            from: `"Pro Detail Lab" <${functions.config().email?.user || 'prodetaillab@gmail.com'}>`,
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

    } catch (error: any) {
        console.error('❌ Error in sendVerificationCode:', error);

        // Return a more descriptive error if it's a configuration issue
        if (error.message.includes('not configured')) {
            throw new functions.https.HttpsError('failed-precondition', error.message);
        }

        throw new functions.https.HttpsError('internal', error.message || 'Failed to send verification code');
    }
});
