const crypto = require('crypto');

// The lines from Notepad
const line1 = "MIGTAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBHkwdwIBAQQg3Xzok7+8ogznP+0s";
const line2 = "AhJc8QT7H2HUU7knALUNxd4t/zqgCgYIKoZIzj0DAQehRANCAARzKkJxrsCbCrPx";
const line3 = "s5hm+XJaFEg101LjkdX8p10N4ZEctEkC1R1aQDPRGoZnXJah3OVjo9Nbgud+BBf0";
const line4 = "5whzrPO6";

// We'll define possible variations for ambiguous characters:
const var_line1 = {
    "AgE": ["AgE", "Age", "agE", "age"],
    "3Xzok7": ["3Xzok7", "3XzOk7", "3Xz0k7"],
    "znP+0s": ["znP+0s", "znP+Os", "znP+os"]
};

const var_line2 = {
    "AhJc8": ["AhJc8", "AhJcB"],
    "H2HUU": ["H2HUU", "H2Huu"],
    "Izj0": ["Izj0", "IzjO", "Izjo"],
    "RANCA": ["RANCA", "RANcA", "RAnCA"],
    "CbCrPx": ["CbCrPx", "CbCrpx", "CbcrPx"]
};

const var_line3 = {
    "FEg": ["FEg", "Feg", "fEg", "feg"],
    "101L": ["101L", "10lL", "101l", "10ll", "l01L", "l0lL", "l01l", "l0ll", "I01L", "I0lL"],
    "10N4": ["10N4", "10n4", "l0N4", "l0n4", "I0N4", "I0n4"],
    "1R1a": ["1R1a", "1Rla", "lR1a", "lRla", "IR1a", "IRla"]
};

const var_line4 = {
    "5whzrPO6": ["5whzrPO6", "5whzrP06"]
};

// OID for id-ecPublicKey: 1.2.840.10045.2.1 -> Hex: 2a 86 48 ce 3d 02 01
// OID for secp256r1: 1.2.840.10045.3.1.7 -> Hex: 2a 86 48 ce 3d 03 01 07
const ecPublicKeyOID = Buffer.from([0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02, 0x01]);
const secp256r1OID = Buffer.from([0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07]);

console.log("Starting high-speed DER search...");

let tested = 0;
let validDer = 0;
let successKeys = [];

for (const l1_1 of var_line1["AgE"]) {
for (const l1_2 of var_line1["3Xzok7"]) {
for (const l1_3 of var_line1["znP+0s"]) {

    const reconstructedL1 = `MIGTAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBHkwdwIBAQQg${l1_2}+8og${l1_3}`;

for (const l2_1 of var_line2["AhJc8"]) {
for (const l2_2 of var_line2["H2HUU"]) {
for (const l2_3 of var_line2["Izj0"]) {
for (const l2_4 of var_line2["RANCA"]) {
for (const l2_5 of var_line2["CbCrPx"]) {

    const reconstructedL2 = `${l2_1}QT7${l2_2}7knALUNxd4t/zqgCgYIKoZ${l2_3}DAQeh${l2_4}ARzKkJxrs${l2_5}`;

for (const l3_1 of var_line3["FEg"]) {
for (const l3_2 of var_line3["101L"]) {
for (const l3_3 of var_line3["10N4"]) {
for (const l3_4 of var_line3["1R1a"]) {

    const reconstructedL3 = `s5hm+XJa${l3_1}g${l3_2}jkdX8p${l3_3}ZEctEkC${l3_4}QDPRGoZnXJah3OVjo9Nbgud+BBf0`;

for (const l4_1 of var_line4["5whzrPO6"]) {

    tested++;
    
    const base64Str = reconstructedL1 + reconstructedL2 + reconstructedL3 + l4_1;
    const buf = Buffer.from(base64Str, 'base64');
    
    // Quick checks:
    // 1. SEQUENCE header: buf[0] === 0x30
    if (buf[0] === 0x30) {
        // 2. Check if it contains ecPublicKey OID and secp256r1 OID
        if (buf.includes(ecPublicKeyOID) && buf.includes(secp256r1OID)) {
            validDer++;
            // Try parsing using crypto.createPrivateKey
            const pem = `-----BEGIN PRIVATE KEY-----
${reconstructedL1}
${reconstructedL2}
${reconstructedL3}
${l4_1}
-----END PRIVATE KEY-----`;
            try {
                crypto.createPrivateKey({
                    key: pem,
                    type: 'pkcs8',
                    format: 'pem'
                });
                successKeys.push(pem);
            } catch (e) {
                // Not mathematically valid
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
}
}
}
}
}

console.log(`\nSearch complete!`);
console.log(`Tested combinations: ${tested}`);
console.log(`DER-like matches: ${validDer}`);
console.log(`Successfully parsed private keys: ${successKeys.length}`);

if (successKeys.length > 0) {
    console.log(`\nValid PEM Key found!`);
    console.log(successKeys[0]);
}
