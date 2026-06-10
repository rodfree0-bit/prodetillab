import sharp from 'sharp';
import path from 'path';
import fs from 'fs';

const logoSource = "C:/Users/cramr/.gemini/antigravity/brain/04eb0123-5b46-40d6-b4fc-a8c8f06482ea/logo_transparent.png";
const projectDir = "C:/Users/cramr/OneDrive/Documents/My-Carwash-app-";

// List of targets with width, height, format, and destination path
const targets = [
    // Web assets
    { dest: 'public/logo.png', w: 512, h: 512, format: 'png' },
    { dest: 'public/logo.webp', w: 512, h: 512, format: 'webp' },
    { dest: 'public/logoasset.png', w: 512, h: 512, format: 'png' },
    { dest: 'public/icon-192.png', w: 192, h: 192, format: 'png' },
    { dest: 'public/icon-512.png', w: 512, h: 512, format: 'png' },
    { dest: 'assets/logo.png', w: 512, h: 512, format: 'png' },
    { dest: 'assets/icon-only.png', w: 512, h: 512, format: 'png' },
    { dest: 'landing/logo.png', w: 512, h: 512, format: 'png' },
    { dest: 'landing/logo.webp', w: 512, h: 512, format: 'webp' },
    { dest: 'landing/logo-og.webp', w: 512, h: 512, format: 'webp' },
    { dest: 'landing/logoasset.png', w: 512, h: 512, format: 'png' },

    // Android Launcher Icons
    { dest: 'android/app/src/main/ic_launcher-playstore.png', w: 512, h: 512, format: 'png' },
    
    // Mipmap MDPI
    { dest: 'android/app/src/main/res/mipmap-mdpi/ic_launcher.webp', w: 48, h: 48, format: 'webp', isLegacy: true },
    { dest: 'android/app/src/main/res/mipmap-mdpi/ic_launcher_round.webp', w: 48, h: 48, format: 'webp', isLegacy: true },
    { dest: 'android/app/src/main/res/mipmap-mdpi/ic_launcher_foreground.webp', w: 108, h: 108, format: 'webp', isForeground: true },
    
    // Mipmap HDPI
    { dest: 'android/app/src/main/res/mipmap-hdpi/ic_launcher.webp', w: 72, h: 72, format: 'webp', isLegacy: true },
    { dest: 'android/app/src/main/res/mipmap-hdpi/ic_launcher_round.webp', w: 72, h: 72, format: 'webp', isLegacy: true },
    { dest: 'android/app/src/main/res/mipmap-hdpi/ic_launcher_foreground.webp', w: 162, h: 162, format: 'webp', isForeground: true },
    
    // Mipmap XHDPI
    { dest: 'android/app/src/main/res/mipmap-xhdpi/ic_launcher.webp', w: 96, h: 96, format: 'webp', isLegacy: true },
    { dest: 'android/app/src/main/res/mipmap-xhdpi/ic_launcher_round.webp', w: 96, h: 96, format: 'webp', isLegacy: true },
    { dest: 'android/app/src/main/res/mipmap-xhdpi/ic_launcher_foreground.webp', w: 216, h: 216, format: 'webp', isForeground: true },
    
    // Mipmap XXHDPI
    { dest: 'android/app/src/main/res/mipmap-xxhdpi/ic_launcher.webp', w: 144, h: 144, format: 'webp', isLegacy: true },
    { dest: 'android/app/src/main/res/mipmap-xxhdpi/ic_launcher_round.webp', w: 144, h: 144, format: 'webp', isLegacy: true },
    { dest: 'android/app/src/main/res/mipmap-xxhdpi/ic_launcher_foreground.webp', w: 324, h: 324, format: 'webp', isForeground: true },
    
    // Mipmap XXXHDPI
    { dest: 'android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.webp', w: 192, h: 192, format: 'webp', isLegacy: true },
    { dest: 'android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_round.webp', w: 192, h: 192, format: 'webp', isLegacy: true },
    { dest: 'android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_foreground.webp', w: 432, h: 432, format: 'webp', isForeground: true },

    // iOS Launcher Icon
    { dest: 'ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png', w: 1024, h: 1024, format: 'png' }
];

async function generate() {
    console.log(`Starting asset generation with safe padding from source: ${logoSource}`);
    
    for (const t of targets) {
        const fullDest = path.join(projectDir, t.dest);
        const dir = path.dirname(fullDest);
        
        // Ensure directory exists
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        
        try {
            let s;
            
            if (t.isForeground) {
                // Adaptive foregrounds need padding to prevent clipping by system shapes.
                // Fit inside a centered area (approx 68% of the canvas) for perfect sizing matching standard apps
                const logoSize = Math.round(t.w * 0.68);
                const padding = Math.round((t.w - logoSize) / 2);
                
                s = sharp(logoSource)
                    .resize(logoSize, logoSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
                    .extend({
                        top: padding,
                        bottom: t.h - (logoSize + padding),
                        left: padding,
                        right: t.w - (logoSize + padding),
                        background: { r: 0, g: 0, b: 0, alpha: 0 }
                    });
            } else if (t.isLegacy) {
                // Legacy icons look huge when filled 100%. Fit inside a centered area (75% of canvas) with transparent margin
                const logoSize = Math.round(t.w * 0.75);
                const padding = Math.round((t.w - logoSize) / 2);
                
                s = sharp(logoSource)
                    .resize(logoSize, logoSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
                    .extend({
                        top: padding,
                        bottom: t.h - (logoSize + padding),
                        left: padding,
                        right: t.w - (logoSize + padding),
                        background: { r: 0, g: 0, b: 0, alpha: 0 }
                    });
            } else {
                s = sharp(logoSource).resize(t.w, t.h);
            }
            
            if (t.format === 'webp') {
                s = s.webp({ quality: 90 });
            } else if (t.format === 'png') {
                s = s.png({ compressionLevel: 9 });
            }
            
            await s.toFile(fullDest);
            console.log(`Generated: ${t.dest} (${t.w}x${t.h})`);
        } catch (err) {
            console.error(`Error generating ${t.dest}:`, err.message);
        }
    }
    console.log("Asset generation completed successfully!");
}

generate();
