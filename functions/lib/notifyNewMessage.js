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
exports.notifyNewMessage = void 0;
const functions = __importStar(require("firebase-functions/v1"));
const admin = __importStar(require("firebase-admin"));
// Initialize Admin SDK if not already initialized
if (!admin.apps.length) {
    admin.initializeApp();
}
exports.notifyNewMessage = functions.firestore
    .document('supportTickets/{ticketId}/messages/{messageId}')
    .onCreate(async (snap, context) => {
    const messageData = snap.data();
    const { ticketId } = context.params;
    // Only notify for client or washer messages (ignore admin's own responses)
    if (messageData.senderRole === 'admin' || messageData.senderId === 'system') {
        return null;
    }
    try {
        // Get the ticket to find out who the user is (if name missing in message)
        const ticketSnap = await admin.firestore().collection('supportTickets').doc(ticketId).get();
        const ticketData = ticketSnap.data();
        const ticketUserName = (ticketData === null || ticketData === void 0 ? void 0 : ticketData.userName) || 'User';
        const ticketSource = (ticketData === null || ticketData === void 0 ? void 0 : ticketData.source) || '';
        const senderName = messageData.senderName || ticketUserName;
        let messageBody = messageData.message || 'Sent an attachment';
        // Append source to message body if available for context
        if (ticketSource) {
            messageBody = `[${ticketSource}] ${messageBody}`;
        }
        // Find all admin users to notify
        // We look for users with role 'admin' who have an fcmToken
        const adminsQuery = await admin.firestore()
            .collection('users')
            .where('role', '==', 'admin')
            .get();
        const tokens = [];
        adminsQuery.forEach(doc => {
            const userData = doc.data();
            if (userData.fcmToken) {
                tokens.push(userData.fcmToken);
            }
        });
        if (tokens.length === 0) {
            console.log('No admin tokens found to notify.');
            return null;
        }
        // Create notification payload
        const payload = {
            tokens: tokens, // Multicast handles up to 500 tokens
            notification: {
                title: `New Message from ${senderName}`,
                body: messageBody,
            },
            data: {
                type: 'SUPPORT_MESSAGE',
                ticketId: ticketId,
                click_action: 'FLUTTER_NOTIFICATION_CLICK' // Standard for many libs, or handled by app
            },
            android: {
                priority: 'high',
                notification: {
                    channelId: 'general', // Make sure app channel matches
                    priority: 'high',
                    sound: 'default'
                }
            },
            apns: {
                payload: {
                    aps: {
                        sound: 'default',
                        badge: 1,
                        contentAvailable: true
                    }
                }
            }
        };
        // Send notifications
        const response = await admin.messaging().sendEachForMulticast(payload);
        console.log(`Notifications sent: ${response.successCount} success, ${response.failureCount} failed.`);
        // Cleanup invalid tokens if necessary (optional improvement)
        if (response.failureCount > 0) {
            response.responses.forEach((resp, idx) => {
                if (!resp.success) {
                    console.error(`Failed to send to token ${tokens[idx]}:`, resp.error);
                }
            });
        }
        return { success: true, sentCount: response.successCount };
    }
    catch (error) {
        console.error('Error sending support notification:', error);
        return null;
    }
});
//# sourceMappingURL=notifyNewMessage.js.map