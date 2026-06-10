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
exports.notifyWaitingTime = void 0;
const functions = __importStar(require("firebase-functions/v1"));
const admin = __importStar(require("firebase-admin"));
/**
 * Cloud Function que se ejecuta cada minuto para:
 * 1. Enviar notificaciones a clientes que tienen washer esperando
 * 2. Calcular cargos por tiempo de espera ($10 cada 10 minutos después del primer bloque)
 */
exports.notifyWaitingTime = functions.pubsub
    .schedule('every 1 minutes')
    .timeZone('America/Los_Angeles')
    .onRun(async (context) => {
    var _a, _b, _c;
    const db = admin.firestore();
    const now = Date.now();
    try {
        // Buscar órdenes donde washer está esperando autorización
        const ordersSnapshot = await db.collection('orders')
            .where('status', '==', 'Arrived')
            .where('waitingForClient', '==', true)
            .where('clientAuthorized', '==', false)
            .get();
        console.log(`Found ${ordersSnapshot.size} orders with waiting washers`);
        for (const orderDoc of ordersSnapshot.docs) {
            const order = orderDoc.data();
            const waitingStartTime = order.waitingStartTime || order.arrivedAt || now;
            const waitingMinutes = Math.floor((now - waitingStartTime) / 60000);
            // Calcular bloque actual (0-9 min = bloque 0, 10-19 min = bloque 1, etc.)
            const currentBlock = Math.floor(waitingMinutes / 10);
            const previousBlock = order.waitingTimeBlocks || 0;
            // Enviar notificación cada minuto
            const lastNotification = ((_a = order.waitingNotificationsSent) === null || _a === void 0 ? void 0 : _a[order.waitingNotificationsSent.length - 1]) || 0;
            const minutesSinceLastNotification = Math.floor((now - lastNotification) / 60000);
            if (minutesSinceLastNotification >= 1 || !((_b = order.waitingNotificationsSent) === null || _b === void 0 ? void 0 : _b.length)) {
                let notificationMessage = '';
                let notificationTitle = 'Washer Waiting';
                if (waitingMinutes < 10) {
                    // Primeros 10 minutos - advertencia
                    notificationMessage = `Your washer is waiting (${waitingMinutes} min). Please authorize the service. After 10 minutes, you will be charged $10 for every additional 10 minutes.`;
                }
                else {
                    // Después de 10 minutos - mostrar cargo actual
                    const blocksCharged = currentBlock; // Bloque 1 = $10, Bloque 2 = $20, etc.
                    const currentCharge = blocksCharged * 10;
                    notificationMessage = `Your washer has been waiting ${waitingMinutes} minutes. Current waiting charge: $${currentCharge}. Please authorize the service now.`;
                    notificationTitle = '⚠️ Waiting Charges Apply';
                }
                // Enviar notificación push
                if (order.clientId) {
                    try {
                        // Obtener FCM token del cliente
                        const clientDoc = await db.collection('users').doc(order.clientId).get();
                        const fcmToken = (_c = clientDoc.data()) === null || _c === void 0 ? void 0 : _c.fcmToken;
                        if (fcmToken) {
                            await admin.messaging().send({
                                token: fcmToken,
                                notification: {
                                    title: notificationTitle,
                                    body: notificationMessage
                                },
                                data: {
                                    orderId: orderDoc.id,
                                    type: 'waiting_time',
                                    waitingMinutes: waitingMinutes.toString(),
                                    currentCharge: (currentBlock * 10).toString()
                                },
                                android: {
                                    priority: 'high',
                                    notification: {
                                        channelId: 'waiting_alerts',
                                        priority: 'high',
                                        sound: 'default'
                                    }
                                }
                            });
                            console.log(`Sent notification to client ${order.clientId} for order ${orderDoc.id}`);
                        }
                    }
                    catch (error) {
                        console.error(`Error sending notification for order ${orderDoc.id}:`, error);
                    }
                }
                // Actualizar timestamp de última notificación
                await orderDoc.ref.update({
                    waitingNotificationsSent: admin.firestore.FieldValue.arrayUnion(now)
                });
            }
            // Actualizar cargo si cambió de bloque
            if (currentBlock > previousBlock) {
                const chargePerBlock = order.waitingChargePerBlock || 10;
                const totalCharge = currentBlock * chargePerBlock;
                await orderDoc.ref.update({
                    waitingTimeBlocks: currentBlock,
                    waitingCharge: totalCharge
                });
                console.log(`Updated order ${orderDoc.id}: Block ${currentBlock}, Charge $${totalCharge}`);
            }
        }
        return null;
    }
    catch (error) {
        console.error('Error in notifyWaitingTime function:', error);
        return null;
    }
});
//# sourceMappingURL=notifyWaitingTime.js.map