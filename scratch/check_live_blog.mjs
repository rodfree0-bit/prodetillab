import fs from 'fs';

const content = fs.readFileSync('C:\\Users\\cramr\\.gemini\\antigravity\\brain\\84de2f6b-430e-4771-ba21-15de0b7643e2\\.system_generated\\steps\\2561\\content.md', 'utf8');

console.log("Guidelines found?", content.includes("Guidelines"));
console.log("unclosed divs?", content.includes("Avoid unclosed divs"));
console.log("Sonax found?", content.includes("Sonax"));
console.log("Length of live content:", content.length);
