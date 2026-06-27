/**
 * Deploy React app (dist/) to Firebase Hosting — site: my-carwashapp-e6aba
 */
const jwt    = require('jsonwebtoken');
const https  = require('https');
const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');
const zlib   = require('zlib');

const KEY     = require('C:\\Users\\Carlitos6\\firebase-key.json');
const SITE_ID = 'my-carwashapp-e6aba';
const DIST    = path.join(__dirname, 'dist');

const MIME = {
    '.html':  'text/html; charset=utf-8',
    '.css':   'text/css',
    '.js':    'application/javascript',
    '.json':  'application/json',
    '.png':   'image/png',
    '.jpg':   'image/jpeg',
    '.jpeg':  'image/jpeg',
    '.svg':   'image/svg+xml',
    '.ico':   'image/x-icon',
    '.woff':  'font/woff',
    '.woff2': 'font/woff2',
    '.txt':   'text/plain',
    '.xml':   'application/xml',
    '.webp':  'image/webp',
    '.map':   'application/json',
};

// ── Helpers ────────────────────────────────────────────────────────────────

function makeJWT() {
    const now = Math.floor(Date.now() / 1000);
    return jwt.sign({
        iss: KEY.client_email, sub: KEY.client_email,
        aud: 'https://oauth2.googleapis.com/token',
        iat: now, exp: now + 3600,
        scope: 'https://www.googleapis.com/auth/firebase',
    }, KEY.private_key, { algorithm: 'RS256' });
}

function req(options, body) {
    return new Promise((resolve, reject) => {
        const r = https.request(options, res => {
            let d = '';
            res.on('data', c => d += c);
            res.on('end', () => {
                try { resolve({ status: res.statusCode, body: JSON.parse(d) }); }
                catch { resolve({ status: res.statusCode, body: d }); }
            });
        });
        r.on('error', reject);
        if (body) r.write(typeof body === 'string' ? body : JSON.stringify(body));
        r.end();
    });
}

async function getToken() {
    const assertion = makeJWT();
    const payload = `grant_type=${encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer')}&assertion=${encodeURIComponent(assertion)}`;
    const res = await req({
        hostname: 'oauth2.googleapis.com',
        path: '/token', method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(payload) },
    }, payload);
    if (!res.body.access_token) throw new Error('Token error: ' + JSON.stringify(res.body));
    return res.body.access_token;
}

function sha256hex(buf) {
    return crypto.createHash('sha256').update(buf).digest('hex');
}

function hosting(path_, method, token, body) {
    const opts = {
        hostname: 'firebasehosting.googleapis.com',
        path: path_, method,
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    };
    return req(opts, body || undefined);
}

async function uploadFile(uploadUrl, token, gzBuf) {
    const u = new URL(uploadUrl);
    return new Promise((resolve, reject) => {
        const r = https.request({
            hostname: u.hostname,
            path: u.pathname + u.search,
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/octet-stream',
                'Content-Length': gzBuf.length,
            },
        }, res => { res.resume(); res.on('end', () => resolve(res.statusCode)); });
        r.on('error', reject);
        r.write(gzBuf);
        r.end();
    });
}

function listFiles(dir, base) {
    const results = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const webPath = base + '/' + entry.name;
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            results.push(...listFiles(fullPath, webPath));
        } else {
            results.push({ fullPath, webPath });
        }
    }
    return results;
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
    console.log('🔑 Getting access token...');
    const token = await getToken();
    console.log('✅ Token OK');

    // 1. Create version with SPA rewrite config
    const vRes = await hosting(`/v1beta1/sites/${SITE_ID}/versions`, 'POST', token, {
        config: {
            rewrites: [
                { glob: '/fleet/**', path: '/index.html' },
                { glob: '**',       path: '/index.html' },
            ],
            headers: [
                {
                    glob: '**',
                    headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' },
                },
                {
                    glob: '**/*.@(js|css|woff|woff2|png|jpg|jpeg|svg|webp)',
                    headers: { 'Cache-Control': 'max-age=31536000' },
                },
            ],
        },
    });
    if (vRes.status !== 200) throw new Error('Create version: ' + JSON.stringify(vRes.body));
    const versionName = vRes.body.name;
    console.log('📦 Version:', versionName.split('/').pop());

    // 2. Hash all files in dist/
    const files = listFiles(DIST, '');
    console.log(`   Found ${files.length} files`);

    const fileMap = {};
    const gzBufs  = {};

    for (const { fullPath, webPath } of files) {
        const raw = fs.readFileSync(fullPath);
        const gz  = await new Promise((res, rej) => zlib.gzip(raw, (e, d) => e ? rej(e) : res(d)));
        const hash = sha256hex(gz);
        fileMap[webPath] = hash;
        gzBufs[webPath]  = gz;
    }

    // 3. Populate files
    const pRes = await hosting(`/v1beta1/${versionName}:populateFiles`, 'POST', token, { files: fileMap });
    if (pRes.status !== 200) throw new Error('Populate: ' + JSON.stringify(pRes.body));
    const uploadUrl = pRes.body.uploadUrl;
    const required  = pRes.body.uploadRequiredHashes || [];
    console.log(`📤 Uploading ${required.length}/${files.length} file(s)...`);

    // 4. Upload only uncached files
    for (const { webPath } of files) {
        const hash = fileMap[webPath];
        if (!required.includes(hash)) { process.stdout.write('.'); continue; }
        const st = await uploadFile(`${uploadUrl}/${hash}`, token, gzBufs[webPath]);
        if (st !== 200) console.warn(`\n⚠️  ${webPath} → ${st}`);
    }

    // 5. Finalize
    const fRes = await hosting(`/v1beta1/${versionName}?updateMask=status`, 'PATCH', token, { status: 'FINALIZED' });
    if (fRes.status !== 200) throw new Error('Finalize: ' + JSON.stringify(fRes.body));
    console.log('\n✅ Version finalized');

    // 6. Release
    const rRes = await hosting(`/v1beta1/sites/${SITE_ID}/releases?versionName=${versionName}`, 'POST', token, {});
    if (rRes.status !== 200) throw new Error('Release: ' + JSON.stringify(rRes.body));
    console.log('🎉 App deployed → https://' + SITE_ID + '.web.app');
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
