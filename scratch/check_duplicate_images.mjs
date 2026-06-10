import fs from 'fs';
import crypto from 'crypto';
import path from 'path';

const landingDir = './landing';

function getMd5(filePath) {
    const content = fs.readFileSync(filePath);
    return crypto.createHash('md5').update(content).digest('hex');
}

async function checkDuplicates() {
    const files = fs.readdirSync(landingDir);
    const imageExtensions = ['.png', '.webp', '.jpg', '.jpeg', '.svg'];
    const images = files.filter(f => imageExtensions.includes(path.extname(f).toLowerCase()));
    
    console.log(`Checking ${images.length} images for duplicates...`);
    const hashes = {};
    
    images.forEach(img => {
        const filePath = path.join(landingDir, img);
        const md5 = getMd5(filePath);
        if (hashes[md5]) {
            hashes[md5].push(img);
        } else {
            hashes[md5] = [img];
        }
    });
    
    let duplicatesFound = false;
    for (const [md5, list] of Object.entries(hashes)) {
        if (list.length > 1) {
            console.log(`Duplicate found (MD5: ${md5}):`);
            console.log(`  Files: ${list.join(', ')}`);
            duplicatesFound = true;
        }
    }
    
    if (!duplicatesFound) {
        console.log('No duplicates found!');
    }
}

checkDuplicates().catch(console.error);
