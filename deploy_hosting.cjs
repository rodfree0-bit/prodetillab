/**
 * Deploy Firebase Hosting (landing) con service account + REST API
 * Sube TODO el directorio landing/ recursivamente
 */
const jwt    = require('jsonwebtoken');
const https  = require('https');
const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');
const zlib   = require('zlib');

const KEY     = require('C:\\Users\\Carlitos6\\firebase-key.json');
const SITE_ID = 'mycarwash-landing';
const DIR     = path.join(__dirname, 'landing');

const MIME = {
    '.html':  'text/html; charset=utf-8',
    '.css':   'text/css',
    '.js':    'application/javascript',
    '.json':  'application/json',
    '.png':   'image/png',
    '.jpg':   'image/jpeg',
    '.jpeg':  'image/jpeg',
    '.svg':   'image/svg+xml',
    '.webp':  'image/webp',
    '.ico':   'image/x-icon',
    '.txt':   'text/plain',
    '.xml':   'application/xml',
    '.woff':  'font/woff',
    '.woff2': 'font/woff2',
};

// Archivos/directorios a NO subir
const SKIP_DIRS  = new Set(['.claude', '__pycache__', 'node_modules']);
const SKIP_FILES = new Set([
    'firebase.json', 'README.md', 'walkthrough.md',
    'seed-seo-tip.js', 'inject-callbar.ps1',
    'generate_seo_pages.py', 'regen_city_pages.py',
    'test_path_fix.py', 'process_slider_images.py',
    'seo_keyword_bot.py',
    'seo_daily_bank.json', 'seo_local_data.json',
    'seo_metadata.json', 'seo_rankings_report.json',
    'seo_trending_keywords.json',
]);

function listFiles(dir, base) {
    const results = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.name.startsWith('.')) continue;
        if (SKIP_DIRS.has(entry.name))  continue;
        const webPath  = base + '/' + entry.name;
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            results.push(...listFiles(fullPath, webPath));
        } else {
            if (SKIP_FILES.has(entry.name)) continue;
            const ext = path.extname(entry.name).toLowerCase();
            if (!MIME[ext]) continue; // salta .py .ps1 .md .pyc etc.
            results.push({ fullPath, webPath });
        }
    }
    return results;
}

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
    return req({
        hostname: 'firebasehosting.googleapis.com',
        path: path_, method,
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    }, body || undefined);
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

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
    console.log('🔑 Getting access token...');
    const token = await getToken();
    console.log('✅ Token OK');

    // 1. Create version
    const vRes = await hosting(`/v1beta1/sites/${SITE_ID}/versions`, 'POST', token, {
        config: { cleanUrls: true, trailingSlashBehavior: 'REMOVE' }
    });
    if (vRes.status !== 200) throw new Error('Create version: ' + JSON.stringify(vRes.body));
    const versionName = vRes.body.name;
    console.log('📦 Version:', versionName.split('/').pop());

    // 2. Listar y hashear todos los archivos
    const files = listFiles(DIR, '');
    console.log(`   Encontrados ${files.length} archivos`);

    const fileMap = {};
    const gzBufs  = {};
    for (const { fullPath, webPath } of files) {
        const raw  = fs.readFileSync(fullPath);
        const gz   = await new Promise((res, rej) => zlib.gzip(raw, (e, d) => e ? rej(e) : res(d)));
        const hash = sha256hex(gz);
        fileMap[webPath] = hash;
        gzBufs[webPath]  = gz;
    }

    // 3. Populate files
    const pRes = await hosting(`/v1beta1/${versionName}:populateFiles`, 'POST', token, { files: fileMap });
    if (pRes.status !== 200) throw new Error('Populate: ' + JSON.stringify(pRes.body));
    const uploadUrl = pRes.body.uploadUrl;
    const required  = pRes.body.uploadRequiredHashes || [];
    console.log(`📤 Subiendo ${required.length}/${files.length} archivo(s) nuevos...`);

    // 4. Upload solo los que no están en caché
    for (const { webPath } of files) {
        const hash = fileMap[webPath];
        if (!required.includes(hash)) { process.stdout.write('.'); continue; }
        const st = await uploadFile(`${uploadUrl}/${hash}`, token, gzBufs[webPath]);
        if (st !== 200) console.warn(`\n⚠️  ${webPath} → ${st}`);
        else process.stdout.write('↑');
    }

    // 5. Finalize
    const fRes = await hosting(`/v1beta1/${versionName}?updateMask=status`, 'PATCH', token, { status: 'FINALIZED' });
    if (fRes.status !== 200) throw new Error('Finalize: ' + JSON.stringify(fRes.body));
    console.log('\n✅ Version finalizada');

    // 6. Release
    const rRes = await hosting(`/v1beta1/sites/${SITE_ID}/releases?versionName=${versionName}`, 'POST', token, {});
    if (rRes.status !== 200) throw new Error('Release: ' + JSON.stringify(rRes.body));
    console.log('🎉 Landing desplegada → https://prodetaillab.com');
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
