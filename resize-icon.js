import sharp from 'sharp';
import path from 'path';
import fs from 'fs';

// Absolute path to the generated icon in the artifacts directory
const inputPath = 'C:/Users/cramr/.gemini/antigravity/brain/f52d8f5a-e340-4dfd-9748-2a3867863d3e/app_icon_play_store_1770006143111.png';
const outputPath = 'C:/Users/cramr/.gemini/antigravity/brain/f52d8f5a-e340-4dfd-9748-2a3867863d3e/icon_512.png';

console.log(`Processing file: ${inputPath}`);

sharp(inputPath)
    .resize(512, 512)
    .toFile(outputPath)
    .then((info) => {
        console.log('Success! Image resized to 512x512.');
        console.log('Output saved to:', outputPath);
        console.log('Info:', info);
    })
    .catch(err => {
        console.error('Error resizing image:', err);
    });
