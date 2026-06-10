import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootDir = path.resolve(__dirname, '..');
const landingDir = path.join(rootDir, 'landing');
const distDir = path.join(rootDir, 'dist');

// Make sure dist exists
if (!fs.existsSync(distDir)) {
    console.warn("dist directory doesn't exist, Vite might not have finished building or failed.");
    process.exit(1);
}

// 1. Copy the cities directory
const citiesSource = path.join(landingDir, 'cities');
const citiesDest = path.join(distDir, 'cities');

if (!fs.existsSync(citiesDest)) {
    fs.mkdirSync(citiesDest, { recursive: true });
}

if (fs.existsSync(citiesSource)) {
    const cityFiles = fs.readdirSync(citiesSource);
    cityFiles.forEach(file => {
        fs.copyFileSync(path.join(citiesSource, file), path.join(citiesDest, file));
    });
    console.log(`✅ Copied ${cityFiles.length} city SEO pages to dist/cities/`);
}

// 2. Copy standalone HTML files
const htmlFiles = ['rv_detail.html', 'fleet_index.html', 'blog.html', 'blog-admin.html'];
let copiedHtml = 0;
htmlFiles.forEach(file => {
    if (fs.existsSync(path.join(landingDir, file))) {
        fs.copyFileSync(path.join(landingDir, file), path.join(distDir, file));
        copiedHtml++;
    }
});
console.log(`✅ Copied ${copiedHtml} standalone HTML pages to dist/`);

// 3. Copy Assets (CSS, JS)
const assetFiles = ['styles.css', 'promo.css', 'script.js'];
assetFiles.forEach(file => {
    if (fs.existsSync(path.join(landingDir, file))) {
        fs.copyFileSync(path.join(landingDir, file), path.join(distDir, file));
    }
});
console.log(`✅ Copied CSS & JS assets to dist/`);

// Helper to recursively copy directories
function copyRecursiveSync(src, dest) {
    const exists = fs.existsSync(src);
    const stats = exists && fs.statSync(src);
    const isDirectory = exists && stats.isDirectory();
    if (isDirectory) {
        if (!fs.existsSync(dest)) {
            fs.mkdirSync(dest, { recursive: true });
        }
        fs.readdirSync(src).forEach(childItemName => {
            copyRecursiveSync(path.join(src, childItemName), path.join(dest, childItemName));
        });
    } else {
        fs.copyFileSync(src, dest);
    }
}

// 4. Copy Images
const landingFiles = fs.readdirSync(landingDir);
const images = landingFiles.filter(file => file.endsWith('.png') || file.endsWith('.webp') || file.endsWith('.jpg') || file.endsWith('.svg'));
images.forEach(file => {
    fs.copyFileSync(path.join(landingDir, file), path.join(distDir, file));
});
console.log(`✅ Copied ${images.length} image assets to dist/`);

// Copy landing/assets recursively to dist/assets
const assetsSource = path.join(landingDir, 'assets');
const assetsDest = path.join(distDir, 'assets');
if (fs.existsSync(assetsSource)) {
    copyRecursiveSync(assetsSource, assetsDest);
    console.log(`✅ Recursively copied landing/assets/ to dist/assets/`);
}

// 5. Copy and process Sitemap & Robots
if (fs.existsSync(path.join(landingDir, 'robots.txt'))) {
    fs.copyFileSync(path.join(landingDir, 'robots.txt'), path.join(distDir, 'robots.txt'));
}

if (fs.existsSync(path.join(landingDir, 'sitemap.xml'))) {
    // Read and fix sitemap to use clean URLs (remove .html from all locations)
    let sitemapContent = fs.readFileSync(path.join(landingDir, 'sitemap.xml'), 'utf8');
    
    // Globally replace .html inside <loc> tags
    sitemapContent = sitemapContent.replace(/\.html<\/loc>/g, '</loc>');

    fs.writeFileSync(path.join(distDir, 'sitemap.xml'), sitemapContent);
    console.log(`✅ Copied and optimized sitemap.xml to dist/`);
}

// 6. Copy Fleet Portal
const fleetPortalSrc = path.join(rootDir, 'fleet-portal');
const fleetPortalDest = path.join(distDir, 'fleet');

if (fs.existsSync(fleetPortalSrc)) {
    if (!fs.existsSync(fleetPortalDest)) {
        fs.mkdirSync(fleetPortalDest, { recursive: true });
    }
    const fleetFiles = fs.readdirSync(fleetPortalSrc);
    fleetFiles.forEach(file => {
        fs.copyFileSync(path.join(fleetPortalSrc, file), path.join(fleetPortalDest, file));
    });
    console.log(`✅ Copied Fleet Portal to dist/fleet/ (${fleetFiles.length} file${fleetFiles.length !== 1 ? 's' : ''})`);
} else {
    console.warn('⚠️ fleet-portal/ folder not found, skipping Fleet Portal copy.');
}

console.log("🚀 Post-build SEO integration completed successfully!");
