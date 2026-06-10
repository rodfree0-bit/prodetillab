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
exports.generateDailySEOTip = exports.resetPasswordWithCode = exports.sendPasswordResetCode = exports.verifyCode = exports.sendVerificationCode = exports.sendInactivityRemindersManual = exports.sendWeatherNotificationsManual = exports.sendInactivityReminders = exports.onOrderUpdated = exports.onOrderCreated = exports.notifyWaitingTime = exports.notifyNewMessage = void 0;
/**
 * Firebase Cloud Functions Index
 *
 * Este archivo exporta todas las Cloud Functions para Stripe y SendGrid
 */
const admin = __importStar(require("firebase-admin"));
// Initialize Admin SDK once for all functions
if (!admin.apps.length) {
    admin.initializeApp();
}
// Notification Functions
// export { sendReceipt } from './sendReceipt';
// Notification Functions
var notifyNewMessage_1 = require("./notifyNewMessage");
Object.defineProperty(exports, "notifyNewMessage", { enumerable: true, get: function () { return notifyNewMessage_1.notifyNewMessage; } });
var notifyWaitingTime_1 = require("./notifyWaitingTime");
Object.defineProperty(exports, "notifyWaitingTime", { enumerable: true, get: function () { return notifyWaitingTime_1.notifyWaitingTime; } });
// Order Notification Triggers (Automatic)
var onOrderCreated_1 = require("./onOrderCreated");
Object.defineProperty(exports, "onOrderCreated", { enumerable: true, get: function () { return onOrderCreated_1.onOrderCreated; } });
var onOrderUpdated_1 = require("./onOrderUpdated");
Object.defineProperty(exports, "onOrderUpdated", { enumerable: true, get: function () { return onOrderUpdated_1.onOrderUpdated; } });
// Scheduled Notification Functions (DISABLED - Manual Control Only)
// // export { sendWeatherNotifications } from './scheduledWeatherNotifications';
var manualNotifications_1 = require("./manualNotifications");
Object.defineProperty(exports, "sendInactivityReminders", { enumerable: true, get: function () { return manualNotifications_1.sendInactivityRemindersManual; } });
// Manual Notification Functions (Admin Panel)
var manualNotifications_2 = require("./manualNotifications");
Object.defineProperty(exports, "sendWeatherNotificationsManual", { enumerable: true, get: function () { return manualNotifications_2.sendWeatherNotificationsManual; } });
Object.defineProperty(exports, "sendInactivityRemindersManual", { enumerable: true, get: function () { return manualNotifications_2.sendInactivityRemindersManual; } });
// Email Verification Functions (2FA)
var sendVerificationCode_1 = require("./sendVerificationCode");
Object.defineProperty(exports, "sendVerificationCode", { enumerable: true, get: function () { return sendVerificationCode_1.sendVerificationCode; } });
var verifyCode_1 = require("./verifyCode");
Object.defineProperty(exports, "verifyCode", { enumerable: true, get: function () { return verifyCode_1.verifyCode; } });
// Password Reset Functions (Custom Code-based)
var passwordResetFunctions_1 = require("./passwordResetFunctions");
Object.defineProperty(exports, "sendPasswordResetCode", { enumerable: true, get: function () { return passwordResetFunctions_1.sendPasswordResetCode; } });
Object.defineProperty(exports, "resetPasswordWithCode", { enumerable: true, get: function () { return passwordResetFunctions_1.resetPasswordWithCode; } });
// SEO Automation Functions
var generateDailySEOTip_1 = require("./generateDailySEOTip");
Object.defineProperty(exports, "generateDailySEOTip", { enumerable: true, get: function () { return generateDailySEOTip_1.generateDailySEOTip; } });
//# sourceMappingURL=index.js.map