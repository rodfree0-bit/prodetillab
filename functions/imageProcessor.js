
const sharp = require('sharp');
const admin = require('firebase-admin');

/**
 * Applies a "Cinematic Detailing" filter to a buffer
 * Enhances contrast, saturation, and applies a premium color grade.
 */
async function applyCinematicFilter(inputBuffer) {
    try {
        console.log('🎨 Applying Cinematic Detailing filter...');
        
        // 1. Basic enhancement (Contrast, Saturation, Sharpness)
        const processed = await sharp(inputBuffer)
            .resize({
                width: 1080,
                height: 1350, // Instagram 4:5 ratio
                fit: 'cover'
            })
            .modulate({
                brightness: 1.05,
                saturation: 1.15,
            })
            .gamma(1.1) // Boost shadows slightly for detail
            .sharpen({
                sigma: 1.5,
                m1: 1.0,
                m2: 2.0
            })
            .toBuffer();

        return processed;
    } catch (error) {
        console.error('❌ Error processing image:', error);
        return inputBuffer; // Return original on failure
    }
}

/**
 * Downloads an image from Storage, processes it, and uploads the enhanced version
 */
async function enhanceImage(imagePath) {
    const bucket = admin.storage().bucket();
    const file = bucket.file(imagePath);
    
    try {
        const [buffer] = await file.download();
        const enhancedBuffer = await applyCinematicFilter(buffer);
        
        const enhancedPath = imagePath.replace('.', '_enhanced.');
        const enhancedFile = bucket.file(enhancedPath);
        
        await enhancedFile.save(enhancedBuffer, {
            metadata: { contentType: 'image/jpeg' }
        });
        
        // Get public URL
        const [url] = await enhancedFile.getSignedUrl({
            action: 'read',
            expires: '03-01-2500'
        });
        
        return { path: enhancedPath, url };
    } catch (error) {
        console.error('❌ Failed to enhance image:', error);
        return null;
    }
}

module.exports = { enhanceImage, applyCinematicFilter };
