/**
 * Cloud Function: Verificar Código
 * 
 * Valida el código ingresado por el usuario y crea/autentica la cuenta
 */

import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';

export const verifyCode = functions.region('us-central1').https.onCall(async (data: any, context: functions.https.CallableContext) => {
    const { email, code } = data;

    // Validar parámetros
    if (!email || !code) {
        throw new functions.https.HttpsError('invalid-argument', 'Email and code are required');
    }

    try {
        const codeDoc = await admin.firestore().collection('verification_codes').doc(email).get();

        if (!codeDoc.exists) {
            throw new functions.https.HttpsError('not-found', 'No verification code found for this email');
        }

        const codeData = codeDoc.data()!;

        // Limpiar códigos para comparación
        const submittedCode = code.toString().trim();
        const savedCode = (codeData.code || '').toString().trim();

        // Verificar si ya fue usado
        if (codeData.verified) {
            // IDEMPOTENCY: If already verified with THIS code, proceed as success
            if (savedCode === submittedCode) {
                console.log(`ℹ️ Code for ${email} was already verified, proceeding for session recovery.`);
                // Proceed to return success even if creating custom token fails
            } else {
                throw new functions.https.HttpsError('failed-precondition', 'Code already used');
            }
        } else {
            // Verificar expiración
            if (codeData.expiresAt.toMillis() < Date.now()) {
                throw new functions.https.HttpsError('deadline-exceeded', 'Code has expired');
            }

            // Verificar intentos (máximo 5)
            if (codeData.attempts >= 5) {
                throw new functions.https.HttpsError('resource-exhausted', 'Too many attempts. Request a new code.');
            }

            // Verificar código
            if (savedCode !== submittedCode) {
                // Incrementar intentos
                await admin.firestore().collection('verification_codes').doc(email).update({
                    attempts: admin.firestore.FieldValue.increment(1)
                });

                throw new functions.https.HttpsError('invalid-argument', 'Invalid verification code');
            }
        }

        // Código válido o ya verificado recientemente
        // Crear o obtener usuario
        let user;
        try {
            user = await admin.auth().getUserByEmail(email);

            // If user exists but is not verified in Auth, verify them now
            if (!user.emailVerified) {
                await admin.auth().updateUser(user.uid, {
                    emailVerified: true
                });
                console.log(`✅ User ${email} marked as verified in Auth`);
            }
        } catch (error: any) {
            if (error.code === 'auth/user-not-found') {
                // Usuario no existe, crearlo
                user = await admin.auth().createUser({
                    email,
                    emailVerified: true
                });
                console.log(`✅ New user ${email} created and verified`);

                // Crear perfil en Firestore
                await admin.firestore().collection('users').doc(user.uid).set({
                    id: user.uid,
                    email,
                    role: 'client',
                    name: email.split('@')[0],
                    phone: '',
                    address: '',
                    photo: `https://ui-avatars.com/api/?name=${email.split('@')[0]}&background=3b82f6&color=fff`,
                    savedVehicles: [],
                    savedCards: [],
                    savedAddresses: [],
                    createdAt: admin.firestore.FieldValue.serverTimestamp()
                });
            } else {
                throw error;
            }
        }

        // Generar custom token para autenticación (OPCIONAL)
        // A veces falla por permisos de IAM (signBlob), pero no debe bloquear el registro
        let customToken = null;
        try {
            customToken = await admin.auth().createCustomToken(user.uid);
        } catch (tokenError: any) {
            console.warn('⚠️ Could not generate custom token (IAM permission issue):', tokenError.message);
        }

        // Marcar el código como usado si no lo estaba
        if (!codeData.verified) {
            await admin.firestore().collection('verification_codes').doc(email).update({
                verified: true,
                verifiedAt: admin.firestore.FieldValue.serverTimestamp()
            });
        }

        console.log(`✅ User ${email} verified successfully. Token: ${customToken ? 'YES' : 'NO (requires reload)'}`);

        return {
            success: true,
            token: customToken,
            userId: user.uid
        };

    } catch (error: any) {
        console.error('❌ Error verifying code:', error);

        if (error instanceof functions.https.HttpsError) {
            throw error;
        }

        throw new functions.https.HttpsError('internal', `Failed to verify code: ${error.message || 'Unknown error'}`);
    }
});
