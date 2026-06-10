import * as functions from 'firebase-functions/v2';
import * as admin from 'firebase-admin';

/**
 * Cloud Function programada que se ejecuta semanalmente los lunes a las 9:00 AM (Hora del Pacífico).
 * Envía recordatorios personalizados a:
 * 1. Clientes que nunca han completado un lavado (0 lavados) y se registraron hace más de 7 días.
 * 2. Clientes cuya última orden completada fue hace más de 14 días.
 */
export const sendInactivityReminders = functions.scheduler.onSchedule({
    schedule: '0 9 * * 1',
    timeZone: 'America/Los_Angeles',
    timeoutSeconds: 540,
    memory: '256MiB'
}, async (event) => {
    console.log('⏰ [ScheduledInactivityReminders] Iniciando envío de recordatorios...');

    try {
        const db = admin.firestore();
        const now = Date.now();

        // 1. Obtener todas las órdenes completadas para calcular las fechas del último servicio por cliente
        const ordersSnapshot = await db
            .collection('orders')
            .where('status', '==', 'Completed')
            .get();

        console.log(`📦 [ScheduledInactivityReminders] Total de órdenes completadas leídas: ${ordersSnapshot.size}`);

        const clientLastOrderDateMap = new Map<string, number>();

        ordersSnapshot.forEach(doc => {
            const order = doc.data();
            const clientId = order.clientId;
            
            // Determinar timestamp de completado de forma robusta
            let completedAt = 0;
            if (order.completedAt) {
                completedAt = typeof order.completedAt === 'number' 
                    ? order.completedAt 
                    : (order.completedAt.toMillis ? order.completedAt.toMillis() : new Date(order.completedAt).getTime());
            } else if (order.createdAt) {
                completedAt = order.createdAt.toMillis ? order.createdAt.toMillis() : new Date(order.createdAt).getTime();
            }

            if (clientId && completedAt && !isNaN(completedAt)) {
                const existing = clientLastOrderDateMap.get(clientId);
                if (!existing || completedAt > existing) {
                    clientLastOrderDateMap.set(clientId, completedAt);
                }
            }
        });

        // 2. Obtener todos los usuarios de Firestore
        const usersSnapshot = await db.collection('users').get();
        console.log(`👥 [ScheduledInactivityReminders] Total de usuarios en el sistema: ${usersSnapshot.size}`);

        const notificationsToSend: Array<{
            userId: string;
            fcmToken: string;
            title: string;
            body: string;
            daysSince: number;
            type: 'no_washes' | 'inactive';
        }> = [];

        usersSnapshot.forEach(doc => {
            const user = doc.data();
            const userId = doc.id;

            // Filtrar solo roles que correspondan a clientes
            const isClient = user.role === 'client' || !user.role;
            if (!isClient) return;

            // Verificar si el usuario tiene FCM token y si tiene habilitados los recordatorios
            const hasFcm = !!user.fcmToken && user.fcmToken.trim() !== '';
            const wantsReminders = user.notificationPreferences?.reminders !== false;

            if (hasFcm && wantsReminders) {
                const fcmToken = user.fcmToken;
                
                // Determinar fecha de registro (createdAt) de forma robusta
                let registrationDate = now;
                if (user.createdAt) {
                    registrationDate = typeof user.createdAt === 'number' 
                        ? user.createdAt 
                        : (user.createdAt.toMillis ? user.createdAt.toMillis() : new Date(user.createdAt).getTime());
                } else if (user.joinedDate) {
                    registrationDate = new Date(user.joinedDate).getTime();
                }

                if (isNaN(registrationDate)) {
                    registrationDate = now;
                }

                // Controlar frecuencia de recordatorios (máximo uno cada 7 días)
                let lastReminder = 0;
                if (user.lastInactivityReminder) {
                    lastReminder = typeof user.lastInactivityReminder === 'number'
                        ? user.lastInactivityReminder
                        : (user.lastInactivityReminder.toMillis ? user.lastInactivityReminder.toMillis() : new Date(user.lastInactivityReminder).getTime());
                }
                const daysSinceLastReminder = lastReminder ? Math.floor((now - lastReminder) / (1000 * 60 * 60 * 24)) : 999;

                if (daysSinceLastReminder < 7) {
                    // Ya se le envió un recordatorio en los últimos 7 días, omitir
                    return;
                }

                // Comprobar si el cliente tiene órdenes en nuestro mapa
                const lastOrderDate = clientLastOrderDateMap.get(userId);

                if (lastOrderDate) {
                    // CLIENTE INACTIVO (Tiene lavados previos)
                    const daysSinceLastOrder = Math.floor((now - lastOrderDate) / (1000 * 60 * 60 * 24));

                    if (daysSinceLastOrder >= 14) {
                        let title = "Today is a good day to wash your car! 🚗✨";
                        let body = "It's been 15 days since your last wash. Give your car the shine it deserves! Book today.";

                        if (daysSinceLastOrder >= 28) {
                            title = '🚗 Your car misses you!';
                            body = "Don't forget to keep your car clean. Book a mobile detail today and we will come directly to your driveway!";
                        } else if (daysSinceLastOrder >= 21) {
                            title = '✨ Time for a wash?';
                            body = "Regular washing protects your paint. Don't forget to keep your car clean with Pro Detail Lab.";
                        }

                        notificationsToSend.push({
                            userId,
                            fcmToken,
                            title,
                            body,
                            daysSince: daysSinceLastOrder,
                            type: 'inactive'
                        });
                    }
                } else {
                    // CLIENTE SIN LAVADOS (0 lavados en el sistema)
                    const daysSinceRegistration = Math.floor((now - registrationDate) / (1000 * 60 * 60 * 24));

                    // Si lleva más de 7 días registrado y nunca ha hecho un lavado
                    if (daysSinceRegistration >= 7) {
                        notificationsToSend.push({
                            userId,
                            fcmToken,
                            title: "Don't forget to keep your car clean! 🚗🧼",
                            body: 'Hi! Experience the convenience of mobile car washing. Book your first wash today!',
                            daysSince: daysSinceRegistration,
                            type: 'no_washes'
                        });
                    }
                }
            }
        });

        if (notificationsToSend.length === 0) {
            console.log('✅ [ScheduledInactivityReminders] No hay clientes inactivos o sin lavados que requieran recordatorio.');
            return;
        }

        console.log(`📱 [ScheduledInactivityReminders] Enviando notificaciones a ${notificationsToSend.length} clientes...`);

        let successCount = 0;
        let failureCount = 0;

        for (const notif of notificationsToSend) {
            const { userId, fcmToken, title, body, daysSince, type } = notif;

            try {
                // Enviar notificación a través de Firebase Cloud Messaging (FCM)
                await admin.messaging().send({
                    token: fcmToken,
                    notification: { title, body },
                    data: {
                        type: 'inactivity_reminder',
                        action: 'book_wash',
                        reminderType: type,
                        daysSince: daysSince.toString(),
                        screen: 'CLIENT_VEHICLE'
                    },
                    android: {
                        priority: 'high',
                        notification: {
                            channelId: 'promotions',
                            sound: 'default'
                        }
                    }
                });

                // Actualizar la fecha del último recordatorio en el perfil del usuario
                await db.collection('users').doc(userId).update({
                    lastInactivityReminder: now
                });

                successCount++;
                console.log(`✅ [ScheduledInactivityReminders] Recordatorio (${type}) enviado a ${userId} (${daysSince} días)`);
            } catch (error: any) {
                failureCount++;
                console.error(`❌ [ScheduledInactivityReminders] Error enviando a ${userId}:`, error.message);

                // Limpieza robusta de token FCM inválido si corresponde
                if (error.code === 'messaging/invalid-argument' || error.code === 'messaging/registration-token-not-registered') {
                    console.log(`🧹 [ScheduledInactivityReminders] Eliminando token FCM obsoleto para ${userId}`);
                    await db.collection('users').doc(userId).update({
                        fcmToken: admin.firestore.FieldValue.delete()
                    }).catch(err => console.error(`   No se pudo limpiar el token FCM: ${err.message}`));
                }
            }
        }

        console.log(`\n📊 [ScheduledInactivityReminders] Resumen final de recordatorios:`);
        console.log(`   ✅ Exitosos: ${successCount}`);
        console.log(`   ❌ Fallidos: ${failureCount}`);
        console.log(`   📱 Total procesados: ${notificationsToSend.length}`);

        return;
    } catch (error: any) {
        console.error('❌ [ScheduledInactivityReminders] Error crítico en sendInactivityReminders:', error);
        return;
    }
});
