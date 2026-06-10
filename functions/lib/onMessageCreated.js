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
exports.onMessageCreated = void 0;
const functions = __importStar(require("firebase-functions/v1"));
const admin = __importStar(require("firebase-admin"));
/**
 * Cloud Function que se ejecuta cuando se crea un nuevo MENSAJE en el chat de una orden.
 * Crea un documento en la colección 'notifications' para el receptor.
 */
exports.onMessageCreated = functions.firestore
    .document('messages/{messageId}')
    .onCreate(async (snap, context) => {
    const message = snap.data();
    const { senderId, receiverId, orderId, content, type } = message;
    console.log(`💬 New message in order ${orderId} from ${senderId} to ${receiverId}`);
    try {
        const db = admin.firestore();
        // Create in-app notification document
        // This will trigger 'onNotificationCreated' which sends the actual push
        await db.collection('notifications').add({
            userId: receiverId,
            title: 'New Message',
            message: type === 'image' ? 'Sent you an image' : content.length > 50 ? `${content.substring(0, 47)}...` : content,
            type: 'info',
            read: false,
            linkTo: 'CLIENT_HOME', // App handles routing based on role
            relatedId: orderId,
            timestamp: Date.now(),
            extraData: { orderId, type: 'new_message' }
        });
        console.log(`✅ Message notification document created for ${receiverId}`);
        return { success: true };
    }
    catch (error) {
        console.error('❌ Error creating message notification document:', error);
        return null;
    }
});
//# sourceMappingURL=onMessageCreated.js.map