const crypto = require('crypto');

const p = BigInt("0xffffffff00000001000000000000000000000000ffffffffffffffffffffffff");
const B = BigInt("0x5ac635d8aa3a93e7b3ebbd55769886bc651d06b0cc53b0f63bce3c3e27d2604b");

function isPointOnCurve(xHex, yHex) {
    const X = BigInt("0x" + xHex);
    const Y = BigInt("0x" + yHex);

    const y2 = (Y * Y) % p;
    const x3_3x_b = (X * X * X - 3n * X + B) % p;

    const y2_pos = (y2 + p) % p;
    const x3_pos = (x3_3x_b + p) % p;

    return y2_pos === x3_pos;
}

// Fixed parts:
const l1 = "MIGTAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBHkwdwIBAQQg3Xzok7+8ogznP+0s";
const l4 = "5whzrPO6";

// Ambiguous parts in Line 2:
// AhJc8 vs AhJcB
// RANCA vs RANcA vs RAnCA
// CbCrPx vs CbCrpx vs CbcrPx vs cbCrPx vs cbcrpx
const var_l2 = {
    part1: ["AhJc8", "AhJcB"],
    part2: ["RANCA", "RANcA", "RAnCA"],
    part3: ["CbCrPx", "CbCrpx", "CbcrPx", "cbCrPx", "cbcrpx"]
};

// Ambiguous parts in Line 3:
// FEg vs Feg vs fEg vs feg
// 101L vs 10lL vs 101l vs 10ll vs l01L vs l0lL vs l01l vs l0ll vs I01L vs I0lL
// 10N4 vs 10n4 vs l0N4 vs l0n4 vs I0N4 vs I0n4
// 1R1a vs 1Rla vs lR1a vs lRla vs IR1a vs IRla
const var_l3 = {
    part1: ["FEg", "Feg", "fEg", "feg"],
    part2: ["101L", "10lL", "101l", "10ll", "l01L", "l0lL", "l01l", "l0ll", "I01L", "I0lL"],
    part3: ["10N4", "10n4", "l0N4", "l0n4", "I0N4", "I0n4"],
    part4: ["1R1a", "1Rla", "lR1a", "lRla", "IR1a", "IRla"]
};

console.log("Starting elliptic curve mathematical brute force...");

let tested = 0;

for (const l2_1 of var_l2.part1) {
for (const l2_2 of var_l2.part2) {
for (const l2_3 of var_l2.part3) {
    const reconstructedL2 = `${l2_1}QT7H2HUU7knALUNxd4t/zqgCgYIKoZIzj0DAQeh${l2_2}ARzKkJxrs${l2_3}`;

for (const l3_1 of var_l3.part1) {
for (const l3_2 of var_l3.part2) {
for (const l3_3 of var_l3.part3) {
for (const l3_4 of var_l3.part4) {
    const reconstructedL3 = `s5hm+XJa${l3_1}g${l3_2}jkdX8p${l3_3}ZEctEkC${l3_4}QDPRGoZnXJah3OVjo9Nbgud+BBf0`;

    tested++;
    
    // Decode base64 to extract X and Y
    const base64Str = l1 + reconstructedL2 + reconstructedL3 + l4;
    const buf = Buffer.from(base64Str, 'base64');
    
    // The public key coordinates start at byte 10 + 32 (private key) + parameters OID size.
    // In our decoded hex:
    // Outer sequence: 30 81 93
    // Inner sequence and version: 02 01 00
    // Algorithm ID sequence: 30 13 06 07 2a 86 48 ce 3d 02 01 06 08 2a 86 48 ce 3d 03 01 07
    // Private Key Octet String: 04 79 30 77 02 01 01 04 20 [32 bytes private key]
    // Parameters tag [0] OID: a0 0a 06 08 2a 86 48 ce 3d 03 01 07
    // Public Key BIT STRING: a1 44 03 42 00 04 [64 bytes public key]
    
    // Let's locate the public key coordinates dynamically.
    // The public key starts with uncompressed format byte 0x04.
    // Let's find 0x04 after the BIT STRING tag `03 42 00 04`.
    const offset = buf.indexOf(Buffer.from([0x03, 0x42, 0x00, 0x04]));
    if (offset !== -1) {
        const pubKeyOffset = offset + 4; // Skip tag 03, length 42, 00 padding, and 04 uncompressed header
        if (pubKeyOffset + 64 <= buf.length) {
            const xHex = buf.toString('hex', pubKeyOffset, pubKeyOffset + 32);
            const yHex = buf.toString('hex', pubKeyOffset + 32, pubKeyOffset + 64);
            
            if (isPointOnCurve(xHex, yHex)) {
                console.log(`\n🎉 Success! Mathematically valid EC point found after ${tested} tests!`);
                console.log(`L2 Part 1: ${l2_1}`);
                console.log(`L2 Part 2: ${l2_2}`);
                console.log(`L2 Part 3: ${l2_3}`);
                console.log(`L3 Part 1: ${l3_1}`);
                console.log(`L3 Part 2: ${l3_2}`);
                console.log(`L3 Part 3: ${l3_3}`);
                console.log(`L3 Part 4: ${l3_4}`);
                console.log(`\nPEM Private Key:`);
                console.log(`-----BEGIN PRIVATE KEY-----
${l1}
${reconstructedL2}
${reconstructedL3}
${l4}
-----END PRIVATE KEY-----`);
                
                // Double check validity using OpenSSL/crypto
                try {
                    const pem = `-----BEGIN PRIVATE KEY-----
${l1}
${reconstructedL2}
${reconstructedL3}
${l4}
-----END PRIVATE KEY-----`;
                    crypto.createPrivateKey({
                        key: pem,
                        type: 'pkcs8',
                        format: 'pem'
                    });
                    console.log("✅ Verified by OpenSSL!");
                    process.exit(0);
                } catch (err) {
                    console.error("❌ OpenSSL verification failed despite math validation:", err);
                }
            }
        }
    }
}
}
}
}
}
}
}

console.log(`Tested ${tested} combinations. No valid EC points found.`);
process.exit(1);
