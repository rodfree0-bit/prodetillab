import * as functions from 'firebase-functions/v2';
import * as admin from 'firebase-admin';

/**
 * Cloud Function HTTP para enviar notificaciones de "buen clima" manualmente
 * Se llama desde el Admin Panel
 */
export const sendWeatherNotificationsManual = functions.https.onCall(async (request) => {
    console.log('📱 Enviando notificaciones de clima manualmente...');

    try {
        // Verificar que el usuario es admin
        if (!request.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
        }

        const userDoc = await admin.firestore().collection('users').doc(request.auth.uid).get();
        const userData = userDoc.data();

        if (userData?.role !== 'admin') {
            throw new functions.https.HttpsError('permission-denied', 'Only admins can send notifications');
        }

        // Obtener temperatura del request (opcional)
        const temperature = request.data?.temperature || 75;
        const customMessage = request.data?.message;

        // Obtener usuarios elegibles (More inclusive: only role client)
        // We filter preferences and tokens in memory to avoid index issues/missing fields
        const usersSnapshot = await admin.firestore()
            .collection('users')
            .where('role', '==', 'client')
            .get();

        if (usersSnapshot.empty) {
            console.log('⚠️ No clients found in database');
            return { success: 0, failed: 0, total: 0, message: 'No users found' };
        }

        const tokens: string[] = [];
        let skippedByPrefs = 0;
        let skippedByToken = 0;

        usersSnapshot.forEach(doc => {
            const userData = doc.data();
            const fcmToken = userData.fcmToken;
            const prefs = userData.notificationPreferences;

            // If weatherAlerts is not explicitly false, we send it (opt-out model)
            const wantsWeather = prefs?.weatherAlerts !== false;

            if (!fcmToken) {
                skippedByToken++;
            } else if (!wantsWeather) {
                skippedByPrefs++;
            } else {
                tokens.push(fcmToken);
            }
        });

        console.log(`📱 Processed ${usersSnapshot.size} clients. Tokens found: ${tokens.length}. Skipped: ${skippedByToken} (no token), ${skippedByPrefs} (opted out).`);

        if (tokens.length === 0) {
            return {
                success: 0,
                failed: 0,
                total: 0,
                message: `No active tokens found. Total clients: ${usersSnapshot.size} (${skippedByToken} without token, ${skippedByPrefs} opted out)`
            };
        }

        // Crear mensaje
        const message = {
            notification: {
                title: '☀️ Perfect Weather Today!',
                body: customMessage || `Great day to wash your car! It's ${temperature}°F and sunny 😊`
            },
            data: {
                type: 'weather_alert',
                action: 'book_wash',
                screen: 'CLIENT_VEHICLE'
            }
        };

        // Enviar en lotes
        const batchSize = 500;
        let totalSuccess = 0;
        let totalFailure = 0;

        for (let i = 0; i < tokens.length; i += batchSize) {
            const batch = tokens.slice(i, i + batchSize);

            try {
                const response = await admin.messaging().sendEachForMulticast({
                    tokens: batch,
                    ...message
                });

                totalSuccess += response.successCount;
                totalFailure += response.failureCount;
            } catch (error) {
                console.error('Error sending batch:', error);
                totalFailure += batch.length;
            }
        }

        console.log(`✅ Sent: ${totalSuccess}, ❌ Failed: ${totalFailure}`);

        return {
            success: totalSuccess,
            failed: totalFailure,
            total: tokens.length,
            message: `Sent ${totalSuccess} notifications successfully`
        };

    } catch (error: any) {
        console.error('Error in sendWeatherNotificationsManual:', error);
        throw new functions.https.HttpsError('internal', error.message);
    }
});

/**
 * Cloud Function HTTP para enviar recordatorios de inactividad manualmente
 */
export const sendInactivityRemindersManual = functions.https.onCall(async (request) => {
    console.log('🔔 Enviando recordatorios de inactividad manualmente...');

    try {
        // Verificar que el usuario es admin
        if (!request.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
        }

        const userDoc = await admin.firestore().collection('users').doc(request.auth.uid).get();
        const userData = userDoc.data();

        if (userData?.role !== 'admin') {
            throw new functions.https.HttpsError('permission-denied', 'Only admins can send notifications');
        }

        const now = Date.now();
        const minDays = request.data?.minDays || 14; // Mínimo de días de inactividad

        // Obtener órdenes completadas
        const ordersSnapshot = await admin.firestore()
            .collection('orders')
            .where('status', '==', 'Completed')
            .orderBy('completedAt', 'desc')
            .get();

        // Agrupar por cliente
        const clientLastOrder = new Map<string, { date: number; orderId: string }>();

        ordersSnapshot.forEach(doc => {
            const order = doc.data();
            const clientId = order.clientId;
            const completedAt = order.completedAt || order.createdAt?.toMillis() || 0;

            if (clientId && completedAt) {
                const existing = clientLastOrder.get(clientId);
                if (!existing || completedAt > existing.date) {
                    clientLastOrder.set(clientId, { date: completedAt, orderId: doc.id });
                }
            }
        });

        // Identificar clientes inactivos
        const inactiveClients: Array<{ userId: string; daysSince: number; fcmToken: string }> = [];

        for (const [clientId, lastOrder] of clientLastOrder.entries()) {
            const daysSince = Math.floor((now - lastOrder.date) / (1000 * 60 * 60 * 24));

            if (daysSince >= minDays) {
                const userDoc = await admin.firestore().collection('users').doc(clientId).get();

                if (userDoc.exists) {
                    const userData = userDoc.data();

                    if (userData?.fcmToken && userData?.notificationPreferences?.reminders !== false) {
                        inactiveClients.push({
                            userId: clientId,
                            daysSince,
                            fcmToken: userData.fcmToken
                        });
                    }
                }
            }
        }

        if (inactiveClients.length === 0) {
            return { success: 0, failed: 0, total: 0, message: 'No inactive clients found' };
        }

        console.log(`📱 Enviando a ${inactiveClients.length} clientes inactivos...`);

        // Enviar notificaciones
        let successCount = 0;
        let failureCount = 0;

        for (const client of inactiveClients) {
            const { userId, daysSince, fcmToken } = client;

            // Mensaje personalizado según días
            let notification;
            if (daysSince >= 28) {
                notification = {
                    title: '🚗 Your Car Misses You!',
                    body: `How about a wash today? Your car will thank you 😊`
                };
            } else if (daysSince >= 21) {
                notification = {
                    title: '✨ Time for a Wash?',
                    body: `Regular washes keep your car looking brand new. Ready to book?`
                };
            } else {
                notification = {
                    title: 'Today is a good day to wash your car! 🚗✨',
                    body: `It's been 15 days since your last wash. Give your car the shine it deserves! Book today.`
                };
            }

            try {
                await admin.messaging().send({
                    token: fcmToken,
                    notification,
                    data: {
                        type: 'inactivity_reminder',
                        action: 'book_wash',
                        screen: 'CLIENT_VEHICLE'
                    }
                });

                successCount++;
            } catch (error: any) {
                failureCount++;
                console.error(`Error sending to ${userId}:`, error.message);
            }
        }

        console.log(`✅ Sent: ${successCount}, ❌ Failed: ${failureCount}`);

        return {
            success: successCount,
            failed: failureCount,
            total: inactiveClients.length,
            message: `Sent ${successCount} reminders successfully`
        };

    } catch (error: any) {
        console.error('Error in sendInactivityRemindersManual:', error);
        throw new functions.https.HttpsError('internal', error.message);
    }
});
