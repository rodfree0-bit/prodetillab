const admin = require('firebase-admin');
const http2 = require('http2');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// Initialize Firebase Admin (runs locally using functions service account)
if (!admin.apps.length) {
    const serviceAccount = require('../serviceAccountKey.json');
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

// APNs credentials
const TEAM_ID = 'KDE2VMDLWT';
const KEY_ID = 'XFSA4BRQFV';
const BUNDLE_ID = 'com.rodrigo.prodetaillab.app';
const PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----
MIGTAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBHkwdwIBAQQg3Xzok7+8ogznP+0s
AhJc8QT7H2HUU7knAiUNxd4t/zqgCgYIKoZIzj0DAQehRANCAARzKkJxrsCbCrPx
s5hm+XJaFEg10lLjkdX8p10N4ZEctEkCiRiaQDPRGoZnXJah3OVjo9NbguD+BBf0
5whzrPO6
-----END PRIVATE KEY-----`;

function generateAPNsJWT() {
    return jwt.sign(
        {
            iss: TEAM_ID,
            iat: Math.floor(Date.now() / 1000)
        },
        crypto.createPrivateKey({
            key: PRIVATE_KEY,
            type: 'pkcs8',
            format: 'pem'
        }),
        {
            algorithm: 'ES256',
            header: {
                kid: KEY_ID
            }
        }
    );
}

function sendDirectAPNs(deviceToken, title, body, data = {}) {
    return new Promise((resolve, reject) => {
        try {
            const token = generateAPNsJWT();
            
            // Connect to APNs production server (api.push.apple.com)
            const client = http2.connect('https://api.push.apple.com:443');
            
            client.on('error', (err) => {
                console.error('APNs client connection error:', err);
                reject(err);
            });

            const headers = {
                ':method': 'POST',
                ':path': `/3/device/${deviceToken}`,
                'authorization': `bearer ${token}`,
                'apns-topic': BUNDLE_ID,
                'apns-push-type': 'alert',
                'apns-priority': '10',
                'apns-expiration': '0'
            };

            const req = client.request(headers);

            req.on('response', (headers) => {
                let status = headers[':status'];
                let responseData = '';
                
                req.on('data', (chunk) => {
                    responseData += chunk;
                });

                req.on('end', () => {
                    client.close();
                    if (status === 200) {
                        console.log(`✅ Direct APNs notification sent successfully to ${deviceToken}`);
                        resolve({ success: true });
                    } else {
                        console.error(`❌ APNs failed with status ${status}:`, responseData);
                        reject(new Error(`APNs status ${status}: ${responseData}`));
                    }
                });
            });

            req.on('error', (err) => {
                console.error('APNs request error:', err);
                client.close();
                reject(err);
            });

            const payload = {
                aps: {
                    alert: {
                        title: title,
                        body: body
                    },
                    sound: 'default',
                    badge: 1
                },
                ...data
            };

            req.write(JSON.stringify(payload));
            req.end();

        } catch (err) {
            console.error('APNs send logic error:', err);
            reject(err);
        }
    });
}

async function runTest() {
    console.log('🔍 Fetching washer cramr2015@gmail.com token from Firestore...');
    const userDoc = await db.collection('users').doc('t0P9FSvQuIarhZYoxIpYasWnLEZ2').get();
    
    if (!userDoc.exists) {
        console.error('❌ User not found!');
        return;
    }
    
    const userData = userDoc.data();
    const token = userData.fcmToken;
    
    if (!token) {
        console.error('❌ Token is missing in Firestore!');
        return;
    }
    
    console.log(`🔑 Token to send: ${token} (Length: ${token.length})`);
    
    console.log('🚀 Sending direct APNs notification...');
    await sendDirectAPNs(
        token,
        '🧪 Prueba APNs Directa',
        '¡Las notificaciones en tu iOS ya están funcionando sin compilar!',
        { type: 'test_apns' }
    );
}

runTest()
    .then(() => {
        console.log('✅ Test complete');
        process.exit(0);
    })
    .catch(err => {
        console.error('❌ Test failed:', err);
        process.exit(1);
    });
