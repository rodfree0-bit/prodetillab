/**
 * Deploy Firebase Cloud Functions usando service account + Cloud Functions REST API
 */
const jwt      = require('jsonwebtoken');
const https    = require('https');
const http     = require('http');
const fs       = require('fs');
const path     = require('path');
const archiver = require('./node_modules/archiver');

const KEY      = require('C:\\Users\\Carlitos6\\firebase-key.json');
const PROJECT  = 'my-carwashapp-e6aba';
const REGION   = 'us-central1';
const RUNTIME  = 'nodejs20';
const SA_EMAIL = 'my-carwashapp-e6aba@appspot.gserviceaccount.com';

// deployedName → { entryPoint, trigger }
const FUNCTIONS = {
    // New function: confirmation email when order created
    onNewOrderCreated: {
        entryPoint: 'onNewOrderCreated',
        trigger: {
            eventType: 'providers/cloud.firestore/eventTypes/document.create',
            resource: `projects/${PROJECT}/databases/(default)/documents/orders/{orderId}`,
            service: 'firestore.googleapis.com',
            failurePolicy: {}
        }
    },
    // Existing function (OFFLINE → reactivate): email receipt + status notifications
    onOrderUpdated: {
        entryPoint: 'onOrderStatusUpdated',
        trigger: {
            eventType: 'providers/cloud.firestore/eventTypes/document.write',
            resource: `projects/${PROJECT}/databases/(default)/documents/orders/{orderId}`,
            service: 'firestore.googleapis.com',
            failurePolicy: {}
        }
    },
    // Existing function: add client push reminders
    washerJobReminder: {
        entryPoint: 'washerJobReminder',
        trigger: {
            eventType: 'google.pubsub.topic.publish',
            resource: `projects/${PROJECT}/topics/firebase-schedule-washerJobReminder-us-central1`,
            service: 'pubsub.googleapis.com',
            failurePolicy: {}
        }
    },
};

// ── Auth ───────────────────────────────────────────────────────────────────────

async function getToken() {
    const now = Math.floor(Date.now() / 1000);
    const assertion = jwt.sign({
        iss: KEY.client_email, sub: KEY.client_email,
        aud: 'https://oauth2.googleapis.com/token',
        iat: now, exp: now + 3600,
        scope: 'https://www.googleapis.com/auth/cloud-platform',
    }, KEY.private_key, { algorithm: 'RS256' });

    const body = `grant_type=${encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer')}&assertion=${encodeURIComponent(assertion)}`;
    const res = await req('oauth2.googleapis.com', '/token', 'POST', null, body, 'application/x-www-form-urlencoded');
    if (!res.body.access_token) throw new Error('Token error: ' + JSON.stringify(res.body));
    return res.body.access_token;
}

// ── HTTP helper ────────────────────────────────────────────────────────────────

function req(hostname, path_, method, token, body, contentType) {
    return new Promise((resolve, reject) => {
        const isHttp = hostname.startsWith('http://');
        const cleanHost = hostname.replace(/^https?:\/\//, '');
        const headers = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;
        const bodyBuf = body ? Buffer.from(typeof body === 'string' ? body : JSON.stringify(body)) : null;
        if (bodyBuf) {
            headers['Content-Type'] = contentType || 'application/json';
            headers['Content-Length'] = bodyBuf.length;
        }
        const options = { hostname: cleanHost, path: path_, method, headers };
        const lib = isHttp ? http : https;
        const r = lib.request(options, res => {
            const chunks = [];
            res.on('data', c => chunks.push(c));
            res.on('end', () => {
                const raw = Buffer.concat(chunks).toString();
                try { resolve({ status: res.statusCode, body: JSON.parse(raw), headers: res.headers }); }
                catch { resolve({ status: res.statusCode, body: raw, headers: res.headers }); }
            });
        });
        r.on('error', reject);
        if (bodyBuf) r.write(bodyBuf);
        r.end();
    });
}

// ── Upload via PUT to signed URL ───────────────────────────────────────────────

function uploadZip(uploadUrl, zipBuf) {
    return new Promise((resolve, reject) => {
        const u = new URL(uploadUrl);
        const lib = u.protocol === 'http:' ? http : https;
        const r = lib.request({
            hostname: u.hostname,
            path: u.pathname + u.search,
            method: 'PUT',
            headers: {
                'Content-Type': 'application/zip',
                'Content-Length': zipBuf.length,
                'x-goog-content-length-range': '0,104857600',
            },
        }, res => {
            let d = '';
            res.on('data', c => d += c);
            res.on('end', () => resolve({ status: res.statusCode, body: d }));
        });
        r.on('error', reject);
        r.write(zipBuf);
        r.end();
    });
}

// ── Zip functions/ directory ───────────────────────────────────────────────────

function zipFunctions() {
    return new Promise((resolve, reject) => {
        const chunks = [];
        const archive = archiver('zip', { zlib: { level: 6 } });
        archive.on('data', c => chunks.push(c));
        archive.on('end', () => resolve(Buffer.concat(chunks)));
        archive.on('error', reject);

        const fnDir = path.join(__dirname, 'functions');

        // Modified package.json — skip tsc build (code is already compiled)
        const pkg = JSON.parse(fs.readFileSync(path.join(fnDir, 'package.json'), 'utf8'));
        pkg.scripts = pkg.scripts || {};
        pkg.scripts.build = 'echo "build skipped — pre-compiled"';
        archive.append(JSON.stringify(pkg, null, 2), { name: 'package.json' });

        // Add all other files except node_modules, src, .ts, .map, and package.json
        archive.glob('**/*', {
            cwd: fnDir,
            ignore: ['node_modules/**', 'src/**', '**/*.map', '**/*.ts', '.git/**', 'package.json'],
        });
        archive.finalize();
    });
}

// ── Wait for operation ─────────────────────────────────────────────────────────

async function waitForOperation(opName, token, timeoutMs = 300000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        await new Promise(r => setTimeout(r, 5000));
        const res = await req('cloudfunctions.googleapis.com', `/v1/${opName}`, 'GET', token);
        if (res.body.done) {
            if (res.body.error) throw new Error(`Operation failed: ${JSON.stringify(res.body.error)}`);
            return res.body;
        }
        process.stdout.write('.');
    }
    throw new Error('Operation timed out');
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
    console.log('🔑 Getting access token...');
    const token = await getToken();
    console.log('✅ Token OK');

    console.log('📦 Zipping functions/...');
    const zipBuf = await zipFunctions();
    console.log(`   Zip size: ${(zipBuf.length / 1024).toFixed(1)} KB`);

    // Get upload URL
    console.log('☁️  Getting upload URL...');
    const uploadRes = await req(
        'cloudfunctions.googleapis.com',
        `/v1/projects/${PROJECT}/locations/${REGION}/functions:generateUploadUrl`,
        'POST', token, {}
    );
    if (uploadRes.status !== 200) throw new Error('generateUploadUrl failed: ' + JSON.stringify(uploadRes.body));
    const uploadUrl = uploadRes.body.uploadUrl;
    const sourceUploadUrl = uploadUrl;
    console.log('✅ Upload URL obtained');

    // Upload zip
    console.log('📤 Uploading zip...');
    const upRes = await uploadZip(uploadUrl, zipBuf);
    if (upRes.status !== 200) throw new Error(`Upload failed HTTP ${upRes.status}: ${upRes.body}`);
    console.log('✅ Zip uploaded');

    // Deploy each function
    for (const [deployedName, cfg] of Object.entries(FUNCTIONS)) {
        const fnPath = `/v1/projects/${PROJECT}/locations/${REGION}/functions/${deployedName}`;

        // Check if function exists
        const existRes = await req('cloudfunctions.googleapis.com', fnPath, 'GET', token);
        const exists = existRes.status === 200;

        const fnConfig = {
            name: `projects/${PROJECT}/locations/${REGION}/functions/${deployedName}`,
            runtime: RUNTIME,
            entryPoint: cfg.entryPoint,
            timeout: '60s',
            availableMemoryMb: 256,
            serviceAccountEmail: SA_EMAIL,
            sourceUploadUrl,
            eventTrigger: cfg.trigger,
        };

        let opRes;
        if (exists) {
            console.log(`\n🔄 Updating ${deployedName} (entry: ${cfg.entryPoint})...`);
            opRes = await req(
                'cloudfunctions.googleapis.com',
                fnPath + '?updateMask=sourceUploadUrl,runtime,entryPoint,timeout,availableMemoryMb',
                'PATCH', token, fnConfig
            );
        } else {
            console.log(`\n🆕 Creating ${deployedName} (entry: ${cfg.entryPoint})...`);
            opRes = await req(
                'cloudfunctions.googleapis.com',
                `/v1/projects/${PROJECT}/locations/${REGION}/functions`,
                'POST', token, fnConfig
            );
        }

        if (opRes.status !== 200) {
            console.error(`❌ ${deployedName} failed HTTP ${opRes.status}:`, JSON.stringify(opRes.body));
            continue;
        }

        const opName = opRes.body.name;
        if (!opName) { console.log(`✅ ${deployedName} done`); continue; }

        process.stdout.write(`   Waiting`);
        await waitForOperation(opName, token);
        console.log(`\n✅ ${deployedName} deployed!`);
    }

    console.log('\n🎉 All functions deployed!');
}

main().catch(e => { console.error('\n❌', e.message); process.exit(1); });
