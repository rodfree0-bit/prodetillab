const crypto = require('crypto');

const baseStrLines = [
    "MIGTAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBHkwdwIBAQQg3Xzok7+8ogznP+0s",
    "AhJc8QT7H2HUU7knALUNxd4t/zqgCgYIKoZIzj0DAQehRANCAARzKkJxrsCbCrPx",
    "s5hm+XJaFEg101LjkdX8p10N4ZEctEkC1R1aQDPRGoZnXJah3OVjo9Nbgud+BBf0",
    "5whzrPO6"
];

// Let's identify the parts of line 3 (index 2) that could have OCR errors:
// 1. "FEg" vs "Feg" or "fEg" or "feg"
// 2. "101Ljkd" -> combinations of '1', 'l', 'I' and '0', 'O', 'o'
// 3. "X8p10N4" -> combinations of '1', 'l', 'I' and '0', 'O'
// 4. "1R1a" -> combinations of '1', 'l', 'I'

const variations = {
    line2_part1: ["FEg", "Feg", "fEg", "feg"],
    line2_part2: ["101L", "10lL", "101l", "10ll", "l01L", "l0lL", "l01l", "l0ll", "I01L", "I0lL"],
    line2_part3: ["10N4", "10n4", "l0N4", "l0n4", "I0N4", "I0n4"],
    line2_part4: ["1R1a", "1Rla", "lR1a", "lRla", "IR1a", "IRla"]
};

// We will reconstruct Line 3 as:
// "s5hm+XJa" + part1 + "g" + part2 + "jkdX8p" + part3 + "ZEctEkC" + part4 + "QDPRGoZnXJah3OVjo9Nbgud+BBf0"

const partStart = "s5hm+XJa";
const partMid1 = "g";
const partMid2 = "jkdX8p";
const partMid3 = "ZEctEkC";
const partEnd = "QDPRGoZnXJah3OVjo9Nbgud+BBf0";

let found = [];

for (const p1 of variations.line2_part1) {
    for (const p2 of variations.line2_part2) {
        for (const p3 of variations.line2_part3) {
            for (const p4 of variations.line2_part4) {
                const reconstructedLine2 = partStart + p1 + partMid1 + p2 + partMid2 + p3 + partMid3 + p4 + partEnd;
                
                const pem = `-----BEGIN PRIVATE KEY-----
${baseStrLines[0]}
${baseStrLines[1]}
${reconstructedLine2}
${baseStrLines[3]}
-----END PRIVATE KEY-----`;

                try {
                    crypto.createPrivateKey({
                        key: pem,
                        type: 'pkcs8',
                        format: 'pem'
                    });
                    found.push({ p1, p2, p3, p4, pem });
                } catch (e) {
                    // Fail silent
                }
            }
        }
    }
}

console.log(`Tested combinations. Found ${found.length} valid private keys:`);
found.forEach((item, index) => {
    console.log(`\nOption ${index + 1}:`);
    console.log(`p1: ${item.p1}, p2: ${item.p2}, p3: ${item.p3}, p4: ${item.p4}`);
    console.log(item.pem);
});
