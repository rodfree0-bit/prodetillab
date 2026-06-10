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
exports.onNotificationCreated = void 0;
const functions = __importStar(require("firebase-functions/v2"));
const admin = __importStar(require("firebase-admin"));
/**
 * Cloud Function that triggers when a new document is added to the 'notifications' collection.
 * It sends a real Push Notification (FCM) to the target user(s).
 */
exports.onNotificationCreated = functions.firestore.onDocumentCreated('notifications/{notificationId}', async (event) => {
    var _a, _b;
    const data = (_a = event.data) === null || _a === void 0 ? void 0 : _a.data();
    if (!data)
        return;
    const { userId, title, message, type, relatedId } = data;
    console.log(`🔔 Processing notification for user: ${userId} (${type})`);
    try {
        const db = admin.firestore();
        const fcm = admin.messaging();
        let tokens = [];
        // CASE 1: BROADCAST TO ALL WASHERS
        if (userId === 'washer-broadcast') {
            console.log('📢 Broadcasting notification to all active washers...');
            const washersSnapshot = await db.collection('users')
                .where('role', '==', 'washer')
                .where('status', '==', 'Active')
                .get();
            washersSnapshot.forEach(doc => {
                const token = doc.data().fcmToken;
                if (token)
                    tokens.push(token);
            });
        }
        // CASE 2: BROADCAST TO ALL ADMINS
        else if (userId === 'admin-broadcast') {
            const adminsSnapshot = await db.collection('users')
                .where('role', '==', 'admin')
                .get();
            adminsSnapshot.forEach(doc => {
                const token = doc.data().fcmToken;
                if (token)
                    tokens.push(token);
            });
        }
        // CASE 3: TARGETED USER
        else {
            const userDoc = await db.collection('users').doc(userId).get();
            const token = (_b = userDoc.data()) === null || _b === void 0 ? void 0 : _b.fcmToken;
            if (token)
                tokens.push(token);
        }
        if (tokens.length === 0) {
            console.log('⚠️ No target tokens found for this notification.');
            return;
        }
        // Prepare FCM Payload
        const payload = {
            tokens: tokens.slice(0, 500), // Max tokens per batch
            notification: {
                title: title || 'Pro Detail Lab Alert',
                body: message || 'You have a new update.',
            },
            data: {
                type: type || 'general',
                relatedId: relatedId || '',
                click_action: 'FLUTTER_NOTIFICATION_CLICK' // For general compatibility
            },
            android: {
                priority: 'high',
                notification: {
                    sound: 'default',
                    channelId: 'general',
                    priority: 'high'
                }
            },
            apns: {
                payload: {
                    aps: {
                        sound: 'default',
                        badge: 1
                    }
                }
            }
        };
        const response = await fcm.sendEachForMulticast(payload);
        console.log(`✅ Successfully sent ${response.successCount} push notifications.`);
        if (response.failureCount > 0) {
            console.warn(`❌ Failed to send ${response.failureCount} notifications.`);
        }
    }
    catch (error) {
        console.error('❌ Error in onNotificationCreated:', error);
    }
});
//# sourceMappingURL=onNotificationCreated.js.map