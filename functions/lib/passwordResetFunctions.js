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
var _a, _b;
Object.defineProperty(exports, "__esModule", { value: true });
exports.resetPasswordWithCode = exports.sendPasswordResetCode = void 0;
const functions = __importStar(require("firebase-functions/v1"));
const admin = __importStar(require("firebase-admin"));
const nodemailer = __importStar(require("nodemailer"));
// Configure email transporter
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER || ((_a = functions.config().email) === null || _a === void 0 ? void 0 : _a.user) || 'prodetaillab@gmail.com',
        pass: process.env.EMAIL_PASSWORD || ((_b = functions.config().email) === null || _b === void 0 ? void 0 : _b.password) || 'ujim isjt uyau sglu'
    }
});
/**
 * Cloud Function: Send Password Reset Code
 * Generates a 6-digit code and emails it to the user.
 */
exports.sendPasswordResetCode = functions.region('us-central1').https.onCall(async (data, context) => {
    var _a;
    const { email } = data;
    if (!email || typeof email !== 'string') {
        throw new functions.https.HttpsError('invalid-argument', 'Email is required');
    }
    try {
        // Check if user exists
        try {
            await admin.auth().getUserByEmail(email);
        }
        catch (authError) {
            if (authError.code === 'auth/user-not-found') {
                throw new functions.https.HttpsError('not-found', 'No account found with this email.');
            }
            throw authError;
        }
        // Generate 6-digit code
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = admin.firestore.Timestamp.fromMillis(Date.now() + 15 * 60 * 1000); // 15 mins
        // Save code to Firestore
        await admin.firestore().collection('password_reset_codes').doc(email).set({
            code,
            email,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            expiresAt,
            verified: false
        });
        // Send Email
        const mailOptions = {
            from: `"Pro Detail Lab" <${((_a = functions.config().email) === null || _a === void 0 ? void 0 : _a.user) || 'prodetaillab@gmail.com'}>`,
            to: email,
            subject: 'Código de Restablecimiento de Contraseña - Pro Detail Lab',
            html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 12px;">
          <h2 style="color: #3b82f6; text-align: center;">Pro Detail Lab</h2>
          <h3 style="text-align: center; color: #1e293b;">Solicitud de Restablecimiento de Contraseña</h3>
          <p style="font-size: 16px; color: #374151;">Hola,</p>
          <p style="font-size: 16px; color: #374151;">Has solicitado restablecer tu contraseña. Usa el siguiente código directamente en la aplicación para proceder:</p>
          <div style="background: #f1f5f9; padding: 30px; border-radius: 12px; text-align: center; margin: 25px 0; border: 1px dashed #cbd5e1;">
            <h1 style="color: #1e293b; font-size: 48px; margin: 0; letter-spacing: 12px; font-weight: 800;">${code}</h1>
          </div>
          <p style="color: #64748b; font-size: 14px; text-align: center;"><b>Nota:</b> Ingresa este código en el formulario de la app. No se requieren links externos.</p>
          <p style="color: #64748b; font-size: 14px; text-align: center;">Este código expirará en 15 minutos.</p>
          <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 20px 0;">
          <p style="color: #94a3b8; font-size: 12px; text-align: center;">Si no solicitaste esto, por favor asegura tu cuenta.</p>
        </div>
      `
        };
        await transporter.sendMail(mailOptions);
        return { success: true };
    }
    catch (error) {
        console.error('Password reset error:', error);
        throw new functions.https.HttpsError('internal', error.message || 'Error occurred');
    }
});
/**
 * Cloud Function: Reset Password with Code
 * Verifies code then updates user password using Admin SDK.
 */
exports.resetPasswordWithCode = functions.region('us-central1').https.onCall(async (data, context) => {
    const { email, code, newPassword } = data;
    if (!email || !code || !newPassword) {
        throw new functions.https.HttpsError('invalid-argument', 'Email, code, and new password are required');
    }
    try {
        const docRef = admin.firestore().collection('password_reset_codes').doc(email);
        const doc = await docRef.get();
        if (!doc.exists) {
            throw new functions.https.HttpsError('not-found', 'Reset code not found or expired');
        }
        const data = doc.data();
        if (data.code !== code) {
            throw new functions.https.HttpsError('permission-denied', 'Invalid verification code');
        }
        if (data.expiresAt.toDate() < new Date()) {
            throw new functions.https.HttpsError('failed-precondition', 'Verification code expired');
        }
        // Update password in Auth
        const user = await admin.auth().getUserByEmail(email);
        await admin.auth().updateUser(user.uid, {
            password: newPassword
        });
        // Clean up code
        await docRef.delete();
        return { success: true };
    }
    catch (error) {
        console.error('Final reset error:', error);
        throw new functions.https.HttpsError('internal', error.message || 'Could not reset password');
    }
});
//# sourceMappingURL=passwordResetFunctions.js.map