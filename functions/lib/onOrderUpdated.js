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
exports.onOrderUpdated = void 0;
const functions = __importStar(require("firebase-functions/v1"));
const admin = __importStar(require("firebase-admin"));
/**
 * Cloud Function que se ejecuta cuando se ACTUALIZA una orden
 * Envía notificaciones push a CLIENTE y WASHER según el cambio de estado
 */
exports.onOrderUpdated = functions.firestore
    .document('orders/{orderId}')
    .onUpdate(async (change, context) => {
    var _a, _b, _c, _d, _e, _f;
    const before = change.before.data();
    const after = change.after.data();
    const orderId = context.params.orderId;
    // Detect what changed
    const statusChanged = before.status !== after.status;
    const washerAssigned = !before.washerId && after.washerId;
    const orderCancelled = after.status === 'Cancelled';
    console.log(`📝 Order updated: ${orderId}`);
    console.log(`   Status: ${before.status} → ${after.status}`);
    console.log(`   Washer: ${before.washerId || 'none'} → ${after.washerId || 'none'}`);
    try {
        const notifications = [];
        // 1. WASHER ASSIGNED - Notify both client and washer
        if (washerAssigned && after.washerId) {
            console.log(`👷 Washer assigned: ${after.washerName} (${after.washerId})`);
            // Notify CLIENT
            const clientDoc = await admin.firestore().collection('users').doc(after.clientId).get();
            const clientToken = (_a = clientDoc.data()) === null || _a === void 0 ? void 0 : _a.fcmToken;
            if (clientToken) {
                notifications.push(admin.messaging().send({
                    token: clientToken,
                    notification: {
                        title: '👷 Washer Assigned!',
                        body: `${after.washerName} has been assigned to your order.`
                    },
                    data: {
                        type: 'washer_assigned',
                        orderId: orderId,
                        userId: after.clientId, // Target client
                        targetRole: 'client',
                        washerId: after.washerId,
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
                }));
            }
            // Notify WASHER
            const washerDoc = await admin.firestore().collection('users').doc(after.washerId).get();
            const washerToken = (_b = washerDoc.data()) === null || _b === void 0 ? void 0 : _b.fcmToken;
            if (washerToken) {
                notifications.push(admin.messaging().send({
                    token: washerToken,
                    notification: {
                        title: '🚗 New Job Assigned!',
                        body: `You've been assigned to wash ${after.vehicle} for ${after.clientName}.`
                    },
                    data: {
                        type: 'job_assigned',
                        orderId: orderId,
                        userId: after.washerId, // Target washer
                        targetRole: 'washer',
                        screen: 'WASHER_JOBS'
                    },
                    android: {
                        priority: 'high',
                        notification: {
                            channelId: 'orders',
                            priority: 'high',
                            sound: 'default'
                        }
                    }
                }));
            }
        }
        // 2. ORDER CANCELLED - Notify both if washer was assigned
        if (orderCancelled) {
            console.log(`❌ Order cancelled`);
            // Notify CLIENT
            const clientDoc = await admin.firestore().collection('users').doc(after.clientId).get();
            const clientToken = (_c = clientDoc.data()) === null || _c === void 0 ? void 0 : _c.fcmToken;
            if (clientToken) {
                notifications.push(admin.messaging().send({
                    token: clientToken,
                    notification: {
                        title: '❌ Order Cancelled',
                        body: `Your order has been cancelled.`
                    },
                    data: {
                        type: 'order_cancelled',
                        orderId: orderId,
                        userId: after.clientId,
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
                }));
            }
            // Notify WASHER if assigned
            if (after.washerId) {
                const washerDoc = await admin.firestore().collection('users').doc(after.washerId).get();
                const washerToken = (_d = washerDoc.data()) === null || _d === void 0 ? void 0 : _d.fcmToken;
                if (washerToken) {
                    notifications.push(admin.messaging().send({
                        token: washerToken,
                        notification: {
                            title: '❌ Job Cancelled',
                            body: `The job for ${after.clientName} has been cancelled.`
                        },
                        data: {
                            type: 'job_cancelled',
                            orderId: orderId,
                            userId: after.washerId,
                            targetRole: 'washer',
                            screen: 'WASHER_JOBS'
                        },
                        android: {
                            priority: 'high',
                            notification: {
                                channelId: 'orders',
                                priority: 'high',
                                sound: 'default'
                            }
                        }
                    }));
                }
            }
        }
        // 3. STATUS CHANGED - Notify both client and washer
        if (statusChanged && !orderCancelled && after.status !== 'Pending') {
            const statusMessages = {
                'Assigned': {
                    client: 'Your order has been assigned to a washer.',
                    washer: 'You have been assigned a new job.'
                },
                'En Route': {
                    client: `${after.washerName} is on the way!`,
                    washer: 'Don\'t forget to update your status when you arrive.'
                },
                'Arrived': {
                    client: `${after.washerName} has arrived at your location.`,
                    washer: 'You have arrived. Waiting for client authorization.'
                },
                'In Progress': {
                    client: `${after.washerName} has started washing your car.`,
                    washer: 'Service in progress. Good luck!'
                },
                'Completed': {
                    client: 'Your car wash is complete! Please rate your experience.',
                    washer: 'Job completed! Waiting for client confirmation.'
                }
            };
            const messages = statusMessages[after.status];
            if (messages) {
                // Notify CLIENT
                const clientDoc = await admin.firestore().collection('users').doc(after.clientId).get();
                const clientToken = (_e = clientDoc.data()) === null || _e === void 0 ? void 0 : _e.fcmToken;
                if (clientToken) {
                    notifications.push(admin.messaging().send({
                        token: clientToken,
                        notification: {
                            title: `Order Status: ${after.status}`,
                            body: messages.client
                        },
                        data: {
                            type: 'status_update',
                            orderId: orderId,
                            userId: after.clientId,
                            targetRole: 'client',
                            status: after.status,
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
                    }));
                }
                // Notify WASHER if assigned
                if (after.washerId) {
                    const washerDoc = await admin.firestore().collection('users').doc(after.washerId).get();
                    const washerToken = (_f = washerDoc.data()) === null || _f === void 0 ? void 0 : _f.fcmToken;
                    if (washerToken) {
                        notifications.push(admin.messaging().send({
                            token: washerToken,
                            notification: {
                                title: `Job Status: ${after.status}`,
                                body: messages.washer
                            },
                            data: {
                                type: 'job_status_update',
                                orderId: orderId,
                                userId: after.washerId,
                                targetRole: 'washer',
                                status: after.status,
                                screen: 'WASHER_JOBS'
                            },
                            android: {
                                priority: 'high',
                                notification: {
                                    channelId: 'orders',
                                    priority: 'high',
                                    sound: 'default'
                                }
                            }
                        }));
                    }
                }
            }
        }
        // 4. AWARD LOYALTY POINTS - When order is completed
        if (statusChanged && after.status === 'Completed' && after.clientId) {
            console.log(`⭐ Awarding 1 loyalty point to client: ${after.clientId}`);
            notifications.push(admin.firestore().collection('users').doc(after.clientId).update({
                loyaltyPoints: admin.firestore.FieldValue.increment(1)
            }));
        }
        // Send all notifications and updates
        if (notifications.length > 0) {
            await Promise.all(notifications);
            console.log(`✅ Sent ${notifications.length} notification(s)`);
        }
        else {
            console.log(`ℹ️ No notifications to send`);
        }
        return { success: true, notificationsSent: notifications.length };
    }
    catch (error) {
        console.error('❌ Error sending order update notifications:', error);
        return null;
    }
});
//# sourceMappingURL=onOrderUpdated.js.map