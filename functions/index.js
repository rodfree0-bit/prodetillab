const functions = require("firebase-functions/v1");
const { onDocumentCreated, onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { onCall } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { getFirestore } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");

// Inicializar solo si no está inicializado
if (!admin.apps.length) {
    admin.initializeApp();
}

const db = admin.firestore();
const messaging = admin.messaging();
const socialAutoPost = require("./socialAutoPost");
const imageProcessor = require("./imageProcessor");

/**
 * Envía una notificación push directamente a Apple APNs vía HTTP/2
 * para tokens APNS de iOS de 64 caracteres hexadecimales.
 */
async function sendAPNsNotification(apnsToken, title, body, data = {}) {
    const http2 = require('http2');
    const jwt = require('jsonwebtoken');

    const TEAM_ID = 'KD62VMCLWT';
    const KEY_ID = 'WUPC4F7N3J';
    const BUNDLE_ID = 'MyCarwashios';
    const APNS_ENDPOINT = 'https://api.push.apple.com:443';

    // Llave privada P-256 para APNs (AuthKey_WUPC4F7N3J.p8)
    const PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----
MIGTAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBHkwdwIBAQQg3Xzok7+8ogznP+0s
AhJc8QT7H2HUU7knAiUNxd4t/zqgCgYIKoZIzj0DAQehRANCAARzKkJxrsCbCrPx
s5hm+XJaFEg10lLjkdX8p10N4ZEctEkCiRiaQDPRGoZnXJah3OVjo9NbguD+BBf0
5whzrPO6
-----END PRIVATE KEY-----`;

    return new Promise((resolve, reject) => {
        try {
            const jwtToken = jwt.sign(
                { iss: TEAM_ID, iat: Math.floor(Date.now() / 1000) },
                PRIVATE_KEY,
                { algorithm: 'ES256', header: { kid: KEY_ID } }
            );

            const payload = JSON.stringify({
                aps: {
                    alert: { title, body },
                    sound: 'default',
                    badge: 1
                },
                ...data
            });

            const client = http2.connect(APNS_ENDPOINT);

            client.on('error', (err) => {
                client.destroy();
                reject(new Error(`APNs connection error: ${err.message}`));
            });

            const req = client.request({
                ':method': 'POST',
                ':path': `/3/device/${apnsToken}`,
                'authorization': `bearer ${jwtToken}`,
                'apns-topic': BUNDLE_ID,
                'apns-push-type': 'alert',
                'apns-priority': '10',
                'apns-expiration': '0',
                'content-type': 'application/json'
            });

            req.on('response', (headers) => {
                const status = headers[':status'];
                let responseData = '';
                req.on('data', (chunk) => { responseData += chunk; });
                req.on('end', () => {
                    client.close();
                    if (status === 200) {
                        resolve({ success: true, status });
                    } else {
                        resolve({ success: false, status, body: responseData });
                    }
                });
            });

            req.on('error', (err) => {
                client.destroy();
                reject(new Error(`APNs request error: ${err.message}`));
            });

            req.write(payload);
            req.end();
        } catch (err) {
            reject(err);
        }
    });
}

/**
 * Helper para enviar notificaciones push
 */
async function sendNotification(userId, title, body, data = {}) {
    try {
        const userDoc = await db.collection("users").doc(userId).get();
        if (!userDoc.exists) {
            console.log(`Usuario ${userId} no encontrado.`);
            return;
        }

        const userData = userDoc.data();
        const fcmToken = userData.fcmToken;

        if (!fcmToken) {
            console.log(`Usuario ${userId} no tiene FCM Token.`);
            return;
        }

        // Detectar si es un token APNS de iOS directo (64 caracteres hexadecimales)
        if (fcmToken.length === 64 && /^[0-9a-fA-F]+$/.test(fcmToken)) {
            console.log(`📱 Usuario ${userId} tiene token APNS de iOS. Enviando vía APNs HTTP/2 directo...`);
            try {
                const result = await sendAPNsNotification(fcmToken, title, body, data);
                if (result.success) {
                    console.log(`✅ Notificación APNs enviada exitosamente a ${userId}`);
                } else {
                    console.warn(`⚠️ APNs respondió ${result.status} para ${userId}: ${result.body}`);
                    // Si el token ya no es válido, limpiarlo de Firestore
                    if (result.body && (result.body.includes('BadDeviceToken') || result.body.includes('Unregistered'))) {
                        console.log(`🧹 Limpiando token APNS inválido para ${userId}`);
                        await db.collection("users").doc(userId).update({ fcmToken: admin.firestore.FieldValue.delete() });
                    }
                }
            } catch (apnsErr) {
                console.error(`❌ Error enviando APNs a ${userId}:`, apnsErr.message);
            }
            return;
        }

        const message = {
            notification: {
                title: title,
                body: body
            },
            token: fcmToken,
            data: data,
            android: {
                priority: 'high',
                notification: {
                    channelId: 'orders',
                    priority: 'high',
                    sound: 'default'
                }
            }
        };

        const response = await messaging.send(message);
        console.log(`✅ Notificación enviada a ${userId}:`, response);
    } catch (error) {
        console.error(`❌ Error enviando notificación a ${userId}:`, error);
        
        // Limpiar tokens inválidos o no registrados de Firestore automáticamente
        const errCode = error.code || (error.errorInfo && error.errorInfo.code);
        if (errCode === 'messaging/invalid-argument' || errCode === 'messaging/registration-token-not-registered') {
            console.log(`🧹 Limpiando token FCM inválido/expirado para el usuario ${userId} en Firestore.`);
            try {
                await db.collection("users").doc(userId).update({ fcmToken: admin.firestore.FieldValue.delete() });
                console.log(`✅ Token de ${userId} eliminado con éxito.`);
            } catch (dbErr) {
                console.error(`❌ No se pudo limpiar el token en Firestore para ${userId}:`, dbErr);
            }
        }
    }
}

async function getOrCreateStripeCustomer(uid, email, role) {
    const stripeSecret = process.env.STRIPE_SECRET_KEY || (functions.config().stripe && functions.config().stripe.secret) || 'sk_test_placeholder';
    const stripe = require('stripe')(stripeSecret);

    const userSnapshot = await db.collection('users').doc(uid).get();
    const userData = userSnapshot.data();

    if (userData && userData.stripeCustomerId) {
        // Verify the customer still exists in this Stripe mode (prevents stale test-mode IDs)
        try {
            await stripe.customers.retrieve(userData.stripeCustomerId);
            console.log(`✅ Verified existing Stripe customer: ${userData.stripeCustomerId}`);
            return userData.stripeCustomerId;
        } catch (err) {
            console.warn(`⚠️ Stale Stripe customer ID detected (${userData.stripeCustomerId}), creating new one...`);
            // Fall through to create a new customer
        }
    }

    const customer = await stripe.customers.create({
        email: email,
        metadata: { firebaseUID: uid, role: role }
    });

    console.log(`🆕 Created new Stripe customer: ${customer.id} for ${email}`);
    await db.collection('users').doc(uid).set({ stripeCustomerId: customer.id }, { merge: true });
    return customer.id;
}

// Configuración CORS
const cors = require('cors')({ origin: true });

// Helper para envolver funciones HTTPS con seguridad (Firebase V1 compatible)
const handleSecureRequest = (handler) => (req, res) => {
    cors(req, res, async () => {
        if (req.method === 'OPTIONS') {
            res.set('Access-Control-Allow-Origin', '*');
            res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
            res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
            res.status(204).send('');
            return;
        }

        try {
            const authHeader = req.headers.authorization;
            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                return res.status(401).send({ error: 'Unauthenticated' });
            }

            const idToken = authHeader.split('Bearer ')[1];
            const decodedToken = await admin.auth().verifyIdToken(idToken);

            const result = await handler(req.body.data || req.body, {
                auth: { uid: decodedToken.uid, token: decodedToken }
            });

            res.status(200).send({ data: result });
        } catch (error) {
            console.error('Secure Request Error:', error);
            res.status(500).send({ error: error.message });
        }
    });
};

// 1. NEW ORDER CREATED (Notify all Washers)
exports.onNewOrderCreated = functions.region('us-central1').firestore
    .document('orders/{orderId}')
    .onCreate(async (snapshot, context) => {
        const orderData = snapshot.data();
        const orderId = context.params.orderId;

        console.log(`🆕 New order detected: ${orderId}`);

        // Extract city from address
        const address = orderData.address || "";
        const cityMatch = address.match(/,\s*([^,]+),\s*[A-Z]{2}\s*\d{5}/) || address.match(/,\s*([^,]+),/);
        const location = cityMatch ? cityMatch[1] : (address.split(',')[0] || "Unknown");
        const total = orderData.price || 0;

        // Query ALL Washers
        const washersSnapshot = await db.collection("users")
            .where("role", "==", "washer")
            .get();

        const notifications = [];

        // Notify Washers
        washersSnapshot.forEach((doc) => {
            notifications.push(sendNotification(doc.id, "🆕 New Job Available!",
                `New order in ${location} $${total}. Check available orders!`,
                {
                    type: "new_order",
                    orderId: orderId,
                    screen: "WASHER_JOBS"
                }
            ));
        });

        // Notify Admins
        const adminsSnapshot = await db.collection("users")
            .where("role", "==", "admin")
            .get();

        adminsSnapshot.forEach((doc) => {
            notifications.push(sendNotification(doc.id, "💼 New Order Received",
                `${orderData.clientName} ordered ${orderData.service}`,
                { type: "new_order", orderId: orderId, screen: "ADMIN_DASHBOARD" }
            ));
        });

        await Promise.all(notifications);
        return null;
    });

// 2. ORDER STATUS UPDATED (Targeted Notifications)
exports.onOrderStatusUpdated = functions.region('us-central1').firestore
    .document('orders/{orderId}')
    .onUpdate(async (change, context) => {
        const newData = change.after.data();
        const oldData = change.before.data();

        // Only proceed if status changed
        if (newData.status === oldData.status) return null;

        const orderId = context.params.orderId;
        const clientId = newData.clientId;
        const washerId = newData.washerId;

        let title = "", body = "", targetUserId = "";

        // A. Washer Assigned
        if (newData.status === "Assigned" && oldData.status === "Pending") {
            // Notify Client
            await sendNotification(clientId, "Washer Assigned! 🚗",
                `${newData.washerName || 'A washer'} has picked up your order.`,
                { type: "order_update", orderId: orderId, screen: "CLIENT_ORDERS" });

            // Notify the specific Washer who took it (Confirmation)
            if (washerId) {
                await sendNotification(washerId, "Order Confirmed!",
                    `The job for ${newData.clientName} is now yours.`,
                    { type: "job_assigned", orderId: orderId, screen: "WASHER_JOBS" });
            }
        }
        // B. En Route
        else if (newData.status === "En Route") {
            title = "Washer En Route! 📍";
            body = `${newData.washerName || 'Your washer'} is on the way.`;
            targetUserId = clientId;
        }
        // C. Arrived
        else if (newData.status === "Arrived") {
            title = "Washer Arrived! 👋";
            body = `${newData.washerName || 'The washer'} has arrived.`;
            targetUserId = clientId;
        }
        // D. Washing / In Progress
        else if (newData.status === "Washing" || newData.status === "In Progress") {
            title = "Service Started 🧼";
            body = "We are currently washing your vehicle.";
            targetUserId = clientId;
        }
        // E. Completed
        else if (newData.status === "Completed") {
            title = "All Done! ✨";
            body = "Service finished. Please rate your experience!";
            targetUserId = clientId;

            // Trigger Social Media Prep
            try {
                await socialAutoPost.prepareAutoPost(orderId, newData);
            } catch (socialErr) {
                console.error("❌ Social Auto-Post preparation failed:", socialErr);
            }
        }
        // F. Cancelled (FIXED TARGETING)
        else if (newData.status === "Cancelled") {
            const cancelReason = newData.cancelReason || "No reason provided";

            // 1. If washer was assigned, notify WASHER
            if (washerId) {
                await sendNotification(washerId, "Order Cancelled ❌",
                    `The job for ${newData.clientName} has been cancelled. Reason: ${cancelReason}`,
                    { type: "job_cancelled", orderId: orderId, screen: "WASHER_JOBS" });
            }

            // 2. Notify CLIENT (Confirmation)
            title = "Order Cancelled ❌";
            body = `Your order #${orderId.substring(0, 8)} has been cancelled.`;
            targetUserId = clientId;
        }

        // Send final notification to primary target (usually client)
        if (targetUserId && title) {
            await sendNotification(targetUserId, title, body,
                { type: "order_update", orderId: orderId });
        }

        return null;
    });

// 3. NEW MESSAGE (Targeted Chat Notification)
exports.onNewMessage = functions.region('us-central1').firestore
    .document('messages/{messageId}')
    .onCreate(async (snapshot, context) => {
        const messageData = snapshot.data();
        const recipientId = messageData.recipientId;

        if (!recipientId) return null;

        // Identify sender name
        const senderDoc = await db.collection("users").doc(messageData.senderId).get();
        const senderName = senderDoc.exists ? (senderDoc.data().name || "Someone") : "Someone";

        // Notify ONLY the recipient
        await sendNotification(recipientId, `💬 ${senderName}`,
            messageData.text || "Sent you a message",
            {
                type: "new_message",
                orderId: messageData.orderId || "",
                senderId: messageData.senderId
            }
        );

        return null;
    });

// 4. SUPPORT MESSAGE (Help Center Support Trigger)
exports.onSupportMessage = functions.region('us-central1').firestore
    .document('supportTickets/{tId}/messages/{mId}')
    .onCreate(async (snapshot, context) => {
        const messageData = snapshot.data();
        const ticketId = context.params.tId;

        console.log(`💬 New support message in ticket ${ticketId}`);

        try {
            // Get the parent ticket document to determine client/receiver ID
            const ticketRef = db.collection('supportTickets').doc(ticketId);
            const ticketSnap = await ticketRef.get();
            if (!ticketSnap.exists) {
                console.log(`⚠️ Ticket ${ticketId} not found.`);
                return null;
            }

            const ticketData = ticketSnap.data();
            const senderRole = messageData.senderRole;
            const messageContent = messageData.message || messageData.text || "New support reply";

            const notifications = [];

            if (senderRole === 'admin') {
                // If message is from admin, send notification to the client
                const recipientId = ticketData.clientId || ticketData.userId;
                if (recipientId) {
                    console.log(`📩 Notifying client ${recipientId} about admin support response`);
                    notifications.push(sendNotification(recipientId, "Support Message 💬",
                        messageContent,
                        { type: "support_message", ticketId: ticketId }
                    ));
                } else {
                    console.warn(`⚠️ No client ID found on ticket ${ticketId} to notify.`);
                }
            } else {
                // If message is from client/washer, notify all admins
                console.log(`📩 Notifying admins about message from client ${ticketData.clientName || 'User'}`);
                const adminsSnapshot = await db.collection("users")
                    .where("role", "==", "admin")
                    .get();

                adminsSnapshot.forEach((doc) => {
                    notifications.push(sendNotification(doc.id, `💬 Support Msg from ${ticketData.clientName || ticketData.userName || 'User'}`,
                        messageContent,
                        { type: "support_message", ticketId: ticketId }
                    ));
                });
            }

            await Promise.all(notifications);
        } catch (err) {
            console.error("❌ Error in onSupportMessage Cloud Function:", err);
        }

        return null;
    });

// ---------------------------------------------------------
// HTTPS CALLABLE / REQUEST (V1 for Stripe compatibility)
// ---------------------------------------------------------

exports.createStripeSetupIntent = functions.region('us-central1').https.onRequest(
    handleSecureRequest(async (data, context) => {
        const stripeCustomerId = await getOrCreateStripeCustomer(context.auth.uid, context.auth.token.email, 'Client');
        const stripeSecret = process.env.STRIPE_SECRET_KEY || (functions.config().stripe && functions.config().stripe.secret) || 'sk_test_placeholder';
        const stripe = require('stripe')(stripeSecret);
        const setupIntent = await stripe.setupIntents.create({
            customer: stripeCustomerId,
            payment_method_types: ['card'],
        });
        return { clientSecret: setupIntent.client_secret };
    })
);

// SAVE CARD WITH TOKEN - Uses legacy createSource which accepts tokens directly on the customer
exports.saveCardWithToken = functions.region('us-central1').https.onRequest(
    handleSecureRequest(async (data, context) => {
        const { token } = data;
        if (!token) throw new Error('Missing token');

        const stripeSecret = process.env.STRIPE_SECRET_KEY || (functions.config().stripe && functions.config().stripe.secret) || 'sk_test_placeholder';
        const stripe = require('stripe')(stripeSecret);

        // Get or create a valid Stripe customer
        const stripeCustomerId = await getOrCreateStripeCustomer(context.auth.uid, context.auth.token.email, 'Client');

        // Add card source directly to customer using token (works cross-context)
        const source = await stripe.customers.createSource(stripeCustomerId, {
            source: token,
        });

        console.log(`✅ Card source added: ${source.id} to customer ${stripeCustomerId}`);
        return { success: true, sourceId: source.id };
    })
);

exports.listStripePaymentMethods = functions.region('us-central1').https.onRequest(
    handleSecureRequest(async (data, context) => {
        const uid = context.auth.uid;
        const userDoc = await db.collection('users').doc(uid).get();
        const stripeCustomerId = userDoc.data()?.stripeCustomerId;

        if (!stripeCustomerId) return { paymentMethods: [] };

        const stripeSecret = process.env.STRIPE_SECRET_KEY || (functions.config().stripe && functions.config().stripe.secret) || 'sk_test_placeholder';
        const stripe = require('stripe')(stripeSecret);

        const formatted = [];
        const cardsMap = new Map();

        // List PaymentMethods (modern flow)
        try {
            const paymentMethods = await stripe.paymentMethods.list({ customer: stripeCustomerId, type: 'card' });
            paymentMethods.data.forEach(pm => {
                const fingerprint = pm.card.fingerprint;
                const cardData = {
                    id: pm.id,
                    brand: pm.card.brand,
                    last4: pm.card.last4,
                    expiry: `${pm.card.exp_month}/${pm.card.exp_year.toString().slice(-2)}`,
                    fingerprint: fingerprint
                };
                if (fingerprint) {
                    cardsMap.set(fingerprint, cardData);
                } else {
                    formatted.push(cardData);
                }
            });
        } catch (e) {
            console.warn('Could not list PaymentMethods:', e.message);
        }

        // Also list card sources (legacy createSource flow)
        try {
            const sources = await stripe.customers.listSources(stripeCustomerId, { object: 'card', limit: 20 });
            sources.data.forEach(src => {
                const fingerprint = src.fingerprint;
                const cardData = {
                    id: src.id,
                    brand: src.brand,
                    last4: src.last4,
                    expiry: `${src.exp_month}/${src.exp_year.toString().slice(-2)}`,
                    fingerprint: fingerprint
                };
                // ONLY add if fingerprint not already present from a PaymentMethod
                if (fingerprint) {
                    if (!cardsMap.has(fingerprint)) {
                        cardsMap.set(fingerprint, cardData);
                    }
                } else {
                    formatted.push(cardData);
                }
            });
        } catch (e) {
            console.warn('Could not list sources:', e.message);
        }

        // Combine deduplicated cards
        const finalCards = [...formatted, ...Array.from(cardsMap.values())];
        return { paymentMethods: finalCards };
    })
);

exports.deleteStripePaymentMethod = functions.region('us-central1').https.onRequest(
    handleSecureRequest(async (data, context) => {
        const { paymentMethodId } = data;
        const stripeSecret = process.env.STRIPE_SECRET_KEY || (functions.config().stripe && functions.config().stripe.secret) || 'sk_test_placeholder';
        const stripe = require('stripe')(stripeSecret);

        // Handle both PaymentMethod (pm_xxx) and Source (card_xxx) IDs
        if (paymentMethodId.startsWith('card_') || paymentMethodId.startsWith('src_')) {
            const uid = context.auth.uid;
            const userDoc = await db.collection('users').doc(uid).get();
            const stripeCustomerId = userDoc.data()?.stripeCustomerId;
            if (stripeCustomerId) {
                await stripe.customers.deleteSource(stripeCustomerId, paymentMethodId);
            }
        } else {
            await stripe.paymentMethods.detach(paymentMethodId);
        }
        return { success: true };
    })
);

exports.createStripePayment = functions.region('us-central1').https.onRequest(
    handleSecureRequest(async (data, context) => {
        const { amount, paymentMethodId, orderId } = data;
        if (!amount || !paymentMethodId || !orderId) throw new Error('Missing fields');
        const stripeCustomerId = await getOrCreateStripeCustomer(context.auth.uid, context.auth.token.email, 'Client');
        const stripeSecret = process.env.STRIPE_SECRET_KEY || (functions.config().stripe && functions.config().stripe.secret) || 'sk_test_placeholder';
        const stripe = require('stripe')(stripeSecret);
        
        const params = {
            amount: Math.round(amount * 100),
            currency: 'usd',
            customer: stripeCustomerId,
            off_session: true,
            confirm: true,
            metadata: { orderId, firebaseUID: context.auth.uid, type: 'base_order' }
        };

        if (paymentMethodId.startsWith('card_') || paymentMethodId.startsWith('src_')) {
            params.source = paymentMethodId;
        } else {
            params.payment_method = paymentMethodId;
        }

        const paymentIntent = await stripe.paymentIntents.create(params);
        await db.collection('orders').doc(orderId).set({ 
            paymentStatus: 'Paid', 
            paymentId: paymentIntent.id,
            stripePaymentMethodId: paymentMethodId 
        }, { merge: true });
        return { success: true, paymentId: paymentIntent.id };
    })
);

exports.chargeStripeTip = functions.region('us-central1').https.onRequest(
    handleSecureRequest(async (data, context) => {
        const { amount, paymentMethodId, orderId } = data;
        if (!amount || !paymentMethodId || !orderId) throw new Error('Missing fields');
        const stripeCustomerId = await getOrCreateStripeCustomer(context.auth.uid, context.auth.token.email, 'Client');
        const stripeSecret = process.env.STRIPE_SECRET_KEY || (functions.config().stripe && functions.config().stripe.secret) || 'sk_test_placeholder';
        const stripe = require('stripe')(stripeSecret);

        const params = {
            amount: Math.round(amount * 100),
            currency: 'usd',
            customer: stripeCustomerId,
            off_session: true,
            confirm: true,
            metadata: { orderId, firebaseUID: context.auth.uid, type: 'tip' }
        };

        if (paymentMethodId.startsWith('card_') || paymentMethodId.startsWith('src_')) {
            params.source = paymentMethodId;
        } else {
            params.payment_method = paymentMethodId;
        }

        const paymentIntent = await stripe.paymentIntents.create(params);
        await db.collection('orders').doc(orderId).set({ 
            tipStatus: 'Paid', 
            tipPaymentId: paymentIntent.id 
        }, { merge: true });
        return { success: true, paymentId: paymentIntent.id };
    })
);

exports.refundStripePayment = functions.region('us-central1').https.onRequest(
    handleSecureRequest(async (data, context) => {
        const { paymentId, amount, orderId, reason } = data;
        if (!paymentId) throw new Error('Missing paymentId');
        
        const stripeSecret = process.env.STRIPE_SECRET_KEY || (functions.config().stripe && functions.config().stripe.secret) || 'sk_test_placeholder';
        const stripe = require('stripe')(stripeSecret);

        const refundParams = { payment_intent: paymentId };
        if (amount) refundParams.amount = Math.round(amount * 100);

        const refund = await stripe.refunds.create(refundParams);
        
        if (orderId) {
            await db.collection('orders').doc(orderId).update({ 
                paymentStatus: 'Refunded',
                refundId: refund.id,
                refundReason: reason || 'Client/Admin cancellation'
            });
        }

        return { success: true, refundId: refund.id };
    })
);

// AUTHORIZE ONLY - Hold card at booking time, no charge yet
exports.createStripeAuthorization = functions.region('us-central1').https.onRequest(
    handleSecureRequest(async (data, context) => {
        const { amount, paymentMethodId, orderId } = data;
        if (!amount || !paymentMethodId || !orderId) {
            throw new Error('Missing required fields: amount, paymentMethodId, orderId');
        }
        const stripeCustomerId = await getOrCreateStripeCustomer(context.auth.uid, context.auth.token.email, 'Client');
        const stripeSecret = process.env.STRIPE_SECRET_KEY || (functions.config().stripe && functions.config().stripe.secret) || 'sk_test_placeholder';
        const stripe = require('stripe')(stripeSecret);

        // capture_method: 'manual' means authorize now, capture later
        const params = {
            amount: Math.round(amount * 100),
            currency: 'usd',
            customer: stripeCustomerId,
            capture_method: 'manual', // THIS IS AUTHORIZE
            off_session: true,
            confirm: true,
            metadata: { orderId, firebaseUID: context.auth.uid, type: 'authorization' }
        };

        if (paymentMethodId.startsWith('card_') || paymentMethodId.startsWith('src_')) {
            params.source = paymentMethodId;
        } else {
            params.payment_method = paymentMethodId;
        }

        const paymentIntent = await stripe.paymentIntents.create(params);

        // Save the paymentIntentId to the order so we can capture later
        await db.collection('orders').doc(orderId).set({
            paymentIntentId: paymentIntent.id,
            stripePaymentMethodId: paymentMethodId,
            paymentStatus: 'Authorized',
            paymentMethod: 'stripe'
        }, { merge: true });

        console.log(`✅ Stripe Authorization created: ${paymentIntent.id} for order ${orderId}`);
        return { success: true, paymentIntentId: paymentIntent.id };
    })
);

// CAPTURE - Charge the actual amount (base + tip) when order is completed
exports.captureStripePayment = functions.region('us-central1').https.onRequest(
    handleSecureRequest(async (data, context) => {
        const { orderId, paymentIntentId, finalAmount } = data;
        if (!orderId || !paymentIntentId || !finalAmount) {
            throw new Error('Missing required fields: orderId, paymentIntentId, finalAmount');
        }
        const stripeSecret = process.env.STRIPE_SECRET_KEY || (functions.config().stripe && functions.config().stripe.secret) || 'sk_test_placeholder';
        const stripe = require('stripe')(stripeSecret);

        // Capture with the final amount (may include tip, could be less than or equal to authorized amount)
        const captured = await stripe.paymentIntents.capture(paymentIntentId, {
            amount_to_capture: Math.round(finalAmount * 100)
        });

        await db.collection('orders').doc(orderId).update({
            paymentStatus: 'Paid',
            finalChargedAmount: finalAmount,
            paidAt: new Date().toISOString()
        });

        console.log(`✅ Stripe Payment Captured: ${paymentIntentId} - $${finalAmount} for order ${orderId}`);
        return { success: true, captured: captured.id };
    })
);

// CANCEL AUTHORIZATION - Release the hold if order is cancelled
exports.cancelStripeAuthorization = functions.region('us-central1').https.onRequest(
    handleSecureRequest(async (data, context) => {
        const { paymentIntentId, orderId } = data;
        if (!paymentIntentId) throw new Error('Missing paymentIntentId');
        const stripeSecret = process.env.STRIPE_SECRET_KEY || (functions.config().stripe && functions.config().stripe.secret) || 'sk_test_placeholder';
        const stripe = require('stripe')(stripeSecret);

        await stripe.paymentIntents.cancel(paymentIntentId);

        if (orderId) {
            await db.collection('orders').doc(orderId).update({
                paymentStatus: 'Voided',
                paymentIntentId: null
            });
        }

        console.log(`✅ Stripe Authorization cancelled: ${paymentIntentId}`);
        return { success: true };
    })
);

exports.calculateRouteETA = functions.region('us-central1').https.onRequest(
    handleSecureRequest(async (data, context) => {
        // Mock implementation
        return { duration: 15, distance: 5.5, status: 'OK' };
    })
);

exports.updateWasherRating = functions.region('us-central1').https.onRequest(
    handleSecureRequest(async (data, context) => {
        const { washerId, newRating } = data;
        const snapshot = await db.collection('orders').where('washerId', '==', washerId).where('status', '==', 'Completed').get();
        let total = 0, count = 0;
        snapshot.forEach(doc => { if (doc.data().rating) { total += doc.data().rating; count++; } });
        const average = count > 0 ? total / count : newRating;
        
        // Fetch washer user document to get cancellations count
        const washerDoc = await db.collection('users').doc(washerId).get();
        let cancellationsCount = 0;
        let oldStatus = 'Active';
        if (washerDoc.exists) {
            const washerData = washerDoc.data();
            cancellationsCount = washerData.cancellationsCount || 0;
            oldStatus = washerData.status || 'Active';
        }
        
        // Calculate rating deducting cancellations count penalty (0.5 stars each)
        let finalRating = average - (cancellationsCount * 0.5);
        finalRating = Math.max(1.0, Math.min(5.0, parseFloat(finalRating.toFixed(1))));

        const updates = { rating: finalRating, completedJobs: count };
        const isBlockedNow = finalRating <= 3.0;
        if (isBlockedNow && oldStatus !== 'Blocked') {
            updates.status = 'Blocked';
        }

        await db.collection('users').doc(washerId).update(updates);

        if (isBlockedNow && oldStatus !== 'Blocked') {
            // Notify admins - English, no emojis
            const adminsSnapshot = await db.collection("users")
                .where("role", "==", "admin")
                .get();

            const notifications = [];
            adminsSnapshot.forEach((doc) => {
                notifications.push(sendNotification(
                    doc.id,
                    "Washer Account Blocked",
                    `Washer was automatically blocked because their rating fell to ${finalRating} stars.`,
                    {
                        type: "washer_blocked",
                        washerId: washerId,
                        screen: "ADMIN_DASHBOARD"
                    }
                ));
            });
            await Promise.all(notifications);
        }

        return { success: true, averageRating: finalRating };
    })
);
// 5. DAILY SEO TIPS (Automated with IA)
const dailyTips = require("./dailyTips");
exports.generateDailySEOTip = dailyTips.generateDailySEOTip;

// 6. CLEAR ORDERS (Manual Trigger)
const deleteOrdersFunc = require("./delete-orders-func");
exports.deleteAllOrdersManual = deleteOrdersFunc.deleteAllOrdersManual;

// 8. WASHER JOB REMINDERS (Scheduled)
exports.washerJobReminder = functions.region('us-central1').pubsub.schedule('every 5 minutes').onRun(async (context) => {
    console.log("⏱️ Checking for upcoming washer jobs...");
    const now = new Date();

    // Query orders that are assigned but not yet started trip
    const ordersSnapshot = await db.collection("orders")
        .where("status", "==", "Assigned")
        .get();

    if (ordersSnapshot.empty) return null;

    const notifications = [];

    for (const doc of ordersSnapshot.docs) {
        const order = doc.data();
        const washerId = order.washerId;
        if (!washerId) continue;

        // Parse scheduled time
        // order.date: YYYY-MM-DD, order.time: HH:mm or "Wash Now"
        let scheduledDate;
        if (order.time === "Wash Now") {
            scheduledDate = order.createdAt?.toDate ? order.createdAt.toDate() : new Date(order.createdAt || 0);
        } else {
            scheduledDate = new Date(`${order.date}T${order.time}:00`);
        }

        if (isNaN(scheduledDate.getTime())) continue;

        const diffInMinutes = Math.round((scheduledDate - now) / (1000 * 60));
        const remindersSent = order.remindersSent || [];

        let reminderType = null;
        let message = "";

        if (diffInMinutes <= 60 && diffInMinutes > 45 && !remindersSent.includes("60m")) {
            reminderType = "60m";
            message = `Reminder: You have a job for ${order.clientName} in 1 hour.`;
        } else if (diffInMinutes <= 30 && diffInMinutes > 20 && !remindersSent.includes("30m")) {
            reminderType = "30m";
            message = `Reminder: You have a job for ${order.clientName} in 30 minutes.`;
        } else if (diffInMinutes <= 10 && diffInMinutes > 5 && !remindersSent.includes("10m")) {
            reminderType = "10m";
            message = `Alert: You have a job for ${order.clientName} in 10 minutes!`;
        } else if (diffInMinutes <= 1 && diffInMinutes >= -5 && !remindersSent.includes("0m")) {
            reminderType = "0m";
            message = `Start Now: Your job for ${order.clientName} starts now!`;
        }

        if (reminderType) {
            console.log(`🔔 Sending ${reminderType} reminder to washer ${washerId} for order ${doc.id}`);
            notifications.push(sendNotification(washerId, "📅 Job Reminder", message, {
                type: "job_reminder",
                orderId: doc.id,
                reminderType: reminderType,
                screen: "WASHER_JOBS"
            }));

            // Mark reminder as sent
            notifications.push(doc.ref.update({
                remindersSent: admin.firestore.FieldValue.arrayUnion(reminderType)
            }));
        }
    }

    await Promise.all(notifications);
    return null;
});

// 9. EMAIL VERIFICATION & PASSWORD RESET (TypeScript Ported)
const verification = require("./lib/sendVerificationCode");
exports.sendVerificationCode = verification.sendVerificationCode;

const verify = require("./lib/verifyCode");
exports.verifyCode = verify.verifyCode;

const passwordReset = require("./lib/passwordResetFunctions");
exports.sendPasswordResetCode = passwordReset.sendPasswordResetCode;
exports.resetPasswordWithCode = passwordReset.resetPasswordWithCode;

const accountDeletion = require("./lib/deleteUser");
exports.deleteUserAccount = accountDeletion.deleteUserAccount;

/**
 * HTTPS Callable: Regenerates a social caption using AI.
 */
exports.regenerateSocialCaption = onCall({
    cors: true,
    maxInstances: 10,
    region: 'us-central1'
}, async (request) => {
    return await socialAutoPost.regenerateSocialCaption(request.data);
});

/**
 * HTTPS Callable: Manually triggers image enhancement.
 */
exports.enhanceSelectedImage = onCall({
    cors: true,
    maxInstances: 10,
    region: 'us-central1'
}, async (request) => {
    const { imagePath } = request.data;
    return await imageProcessor.enhanceImage(imagePath);
});

// 10. NEW SUPPORT ISSUE REPORTED (Notify admins)
exports.onNewIssueReported = functions.region('us-central1').firestore
    .document('issues/{issueId}')
    .onCreate(async (snapshot, context) => {
        const issueData = snapshot.data();
        const issueId = context.params.issueId;

        console.log(`🆕 New support issue reported: ${issueId}`);

        try {
            // Find all administrators
            const adminsSnapshot = await db.collection("users")
                .where("role", "==", "admin")
                .get();

            const notifications = [];
            const userName = issueData.userName || "User";
            const issueTitle = issueData.title || "New Issue";

            adminsSnapshot.forEach((doc) => {
                notifications.push(sendNotification(
                    doc.id,
                    "⚠️ New Support Issue",
                    `From ${userName}: ${issueTitle}`,
                    {
                        type: "issue",
                        issueId: issueId,
                        screen: "ADMIN_ISSUES"
                    }
                ));
            });

            await Promise.all(notifications);
        } catch (error) {
            console.error("❌ Error in onNewIssueReported Cloud Function:", error);
        }

        return null;
    });

// ========================================================
// 11. DAILY SEO PAGE REFRESH (Runs at 6am every day)
//     - Picks today's tip from Firestore seo_daily_tips
//     - Caches it in seo_config/daily_tip_cache (used by landing page JS)
//     - Updates seo_config/last_refresh doc with timestamp
//     - Sends admin push notification to trigger local deploy
// ========================================================
exports.dailySeoPageRefresh = functions.region('us-central1')
    .pubsub.schedule('0 6 * * *')
    .timeZone('America/Los_Angeles')
    .onRun(async (context) => {
        console.log('🌅 dailySeoPageRefresh started at 6am PT...');

        try {
            const now = new Date();
            const startOfYear = new Date(now.getFullYear(), 0, 0);
            const diff = now - startOfYear;
            const oneDay = 1000 * 60 * 60 * 24;
            const dayOfYear = Math.floor(diff / oneDay);

            // Fetch tip for today from Firestore seo_daily_tips collection
            // Try exact day match first, then fallback to modulo
            let tipDoc = null;
            const exactQuery = await db.collection('seo_daily_tips')
                .where('dayId', '==', dayOfYear)
                .limit(1)
                .get();

            if (!exactQuery.empty) {
                tipDoc = exactQuery.docs[0].data();
            } else {
                // Modulo fallback: cycle through available tips
                const allTips = await db.collection('seo_daily_tips')
                    .orderBy('dayId')
                    .get();
                if (!allTips.empty) {
                    const idx = (dayOfYear - 1) % allTips.docs.length;
                    tipDoc = allTips.docs[idx].data();
                }
            }

            if (!tipDoc) {
                console.warn('⚠️ No tip found for today. Skipping refresh.');
                return null;
            }

            const todayStr = now.toISOString().split('T')[0]; // YYYY-MM-DD

            // Write to seo_config/daily_tip_cache — used by landing page JS (real-time)
            await db.collection('seo_config').doc('daily_tip_cache').set({
                title: tipDoc.title,
                content: tipDoc.content,
                dayId: tipDoc.dayId,
                date: todayStr,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });

            // Write last refresh log
            await db.collection('seo_config').doc('last_refresh').set({
                date: todayStr,
                dayOfYear: dayOfYear,
                tipTitle: tipDoc.title,
                triggeredAt: admin.firestore.FieldValue.serverTimestamp(),
                status: 'success'
            }, { merge: true });

            console.log(`✅ SEO tip cache updated for day ${dayOfYear}: "${tipDoc.title}"`);
            return null;
        } catch (error) {
            console.error('❌ Error in dailySeoPageRefresh:', error);

            // Log failure to Firestore
            await db.collection('seo_config').doc('last_refresh').set({
                status: 'error',
                error: error.message,
                triggeredAt: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });

            return null;
        }
    });

// 12. AUTO CANCEL EXPIRED PENDING ORDERS (Runs every 5 minutes)
// - Finds orders in 'Pending' state that have passed their scheduled time by 15+ minutes
// - Automatically cancels them, releases Stripe pre-authorization hold,
// - Updates paymentStatus to 'Voided', and sends push notification to client.
exports.autoCancelExpiredOrders = functions.region('us-central1')
    .pubsub.schedule('every 5 minutes')
    .onRun(async (context) => {
        console.log("⏱️ Checking for expired pending orders...");
        const now = new Date();

        try {
            // Query orders that are still Pending
            const ordersSnapshot = await db.collection("orders")
                .where("status", "==", "Pending")
                .get();

            if (ordersSnapshot.empty) {
                console.log("No pending orders found.");
                return null;
            }

            const stripeSecret = process.env.STRIPE_SECRET_KEY || (functions.config().stripe && functions.config().stripe.secret) || 'sk_test_placeholder';
            const stripe = require('stripe')(stripeSecret);
            const updatesAndNotifs = [];

            for (const doc of ordersSnapshot.docs) {
                const order = doc.data();
                const orderId = doc.id;

                // Parse scheduled time
                // order.date: YYYY-MM-DD, order.time: HH:mm or "Wash Now"
                let scheduledDate;
                if (order.time === "Wash Now") {
                    scheduledDate = order.createdAt?.toDate ? order.createdAt.toDate() : new Date(order.createdAt || 0);
                } else {
                    scheduledDate = new Date(`${order.date}T${order.time}:00`);
                }

                if (isNaN(scheduledDate.getTime())) continue;

                // If the scheduled time has passed by more than 15 minutes
                const diffInMinutes = (now - scheduledDate) / (1000 * 60);

                if (diffInMinutes >= 15) {
                    console.log(`🚨 Order ${orderId} has expired. Scheduled time: ${scheduledDate.toISOString()}, Now: ${now.toISOString()}. Cancelling...`);

                    // 1. Cancel Stripe authorization if exists
                    if (order.paymentIntentId && order.paymentStatus === 'Authorized') {
                        try {
                            console.log(`   ⚡ Cancelling Stripe hold for order ${orderId}, PI: ${order.paymentIntentId}`);
                            await stripe.paymentIntents.cancel(order.paymentIntentId);
                            console.log(`   ✅ Stripe hold cancelled successfully for order ${orderId}`);
                        } catch (stripeErr) {
                            console.error(`   ❌ Failed to cancel Stripe hold for order ${orderId}:`, stripeErr.message);
                        }
                    }

                    // 2. Update order status in Firestore
                    const updateTask = doc.ref.update({
                        status: 'Cancelled',
                        paymentStatus: 'Voided',
                        cancelReason: 'Sorry, we do not have washers available for this time.',
                        updatedAt: admin.firestore.FieldValue.serverTimestamp()
                    });
                    updatesAndNotifs.push(updateTask);

                    // 3. Send notification to the client
                    if (order.clientId) {
                        const clientNotif = sendNotification(
                            order.clientId,
                            "Order Update",
                            "Sorry, we do not have washers available for this time. Your order has been cancelled and no charges were made.",
                            {
                                type: "order_update",
                                orderId: orderId,
                                screen: "CLIENT_ORDERS"
                            }
                        );
                        updatesAndNotifs.push(clientNotif);
                    }

                    // 4. Send notification to admins
                    const adminsSnapshot = await db.collection("users")
                        .where("role", "==", "admin")
                        .get();

                    adminsSnapshot.forEach((adminDoc) => {
                        const adminNotif = sendNotification(
                            adminDoc.id,
                            "Expired Order Cancelled",
                            `Order #${orderId.substring(0, 8)} for ${order.clientName} cancelled automatically (no washer accepted).`,
                            {
                                type: "new_order",
                                orderId: orderId,
                                screen: "ADMIN_DASHBOARD"
                            }
                        );
                        updatesAndNotifs.push(adminNotif);
                    });
                }
            }

            if (updatesAndNotifs.length > 0) {
                await Promise.all(updatesAndNotifs);
                console.log(`✅ Auto-cancelled expired orders & sent notifications.`);
            } else {
                console.log("No expired orders needed cancellation.");
            }
        } catch (err) {
            console.error("❌ Error in autoCancelExpiredOrders cron job:", err);
        }
        return null;
    });

// 13. INACTIVITY REMINDERS (Scheduled)
const scheduledInactivityReminders = require("./lib/scheduledInactivityReminders");
exports.sendInactivityReminders = scheduledInactivityReminders.sendInactivityReminders;


