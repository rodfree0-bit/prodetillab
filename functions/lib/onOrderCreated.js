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
exports.onOrderCreated = void 0;
const functions = __importStar(require("firebase-functions/v1"));
const admin = __importStar(require("firebase-admin"));
/**
 * Cloud Function que se ejecuta cuando se CREA una nueva orden
 * Envía notificación push al CLIENTE que creó la orden
 */
exports.onOrderCreated = functions.firestore
    .document('orders/{orderId}')
    .onCreate(async (snap, context) => {
    const order = snap.data();
    const orderId = context.params.orderId;
    console.log(`📦 New order created: ${orderId}`);
    console.log(`   Client: ${order.clientName} (${order.clientId})`);
    console.log(`   Service: ${order.service}`);
    console.log(`   Status: ${order.status}`);
    try {
        // Get client's FCM token
        const clientDoc = await admin.firestore().collection('users').doc(order.clientId).get();
        const clientData = clientDoc.data();
        const fcmToken = clientData === null || clientData === void 0 ? void 0 : clientData.fcmToken;
        if (!fcmToken) {
            console.log(`⚠️ No FCM token found for client ${order.clientId}`);
            return null;
        }
        // Send notification to CLIENT
        const message = {
            token: fcmToken,
            notification: {
                title: '✅ Order Confirmed!',
                body: `Your ${order.service} order has been created. We'll notify you when a washer is assigned.`
            },
            data: {
                type: 'order_created',
                orderId: orderId,
                userId: order.clientId, // CRITICAL: Target specific user
                targetRole: 'client',
                screen: 'CLIENT_ORDERS'
            },
            android: {
                priority: 'high',
                notification: {
                    channelId: 'orders',
                    priority: 'high',
                    sound: 'default'
                }
            }
        };
        await admin.messaging().send(message);
        console.log(`✅ Notification sent to client ${order.clientId}`);
        return { success: true };
    }
    catch (error) {
        console.error('❌ Error sending order created notification:', error);
        return null;
    }
});
//# sourceMappingURL=onOrderCreated.js.map