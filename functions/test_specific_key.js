const crypto = require('crypto');

const line1 = "MIGTAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBHkwdwIBAQQg3Xzok7+8ogznP+0s";
const line4 = "5whzrPO6";

const line2_variations = [
    "AhJc8QT7H2HUU7knALUNxd4t/zqgCgYIKoZIzj0DAQehRANCAARzKkJxrsCbCrPx",
    "AhJcBQT7H2HUU7knALUNxd4t/zqgCgYIKoZIzj0DAQehRANCAARzKkJxrsCbCrPx",
    "AhJc8QT7H2HUU7knALUNxd4t/zqgCgYIKoZIzj0DAQehRANcAARzKkJxrsCbCrPx",
    "AhJcBQT7H2HUU7knALUNxd4t/zqgCgYIKoZIzj0DAQehRANcAARzKkJxrsCbCrPx",
    "AhJc8QT7H2HUU7knALUNxd4t/zqgCgYIKoZIzj0DAQehRAnCAARzKkJxrsCbCrPx",
    "AhJcBQT7H2HUU7knALUNxd4t/zqgCgYIKoZIzj0DAQehRAnCAARzKkJxrsCbCrPx"
];

const line3_variations = [
    "s5hm+XJaFEg101LjkdX8p10N4ZEctEkC1R1aQDPRGoZnXJah3OVjo9Nbgud+BBf0",
    "s5hm+XJaFeg101LjkdX8p10N4ZEctEkC1R1aQDPRGoZnXJah3OVjo9Nbgud+BBf0",
    "s5hm+XJaFEg10lLjkdX8p10N4ZEctEkC1R1aQDPRGoZnXJah3OVjo9Nbgud+BBf0",
    "s5hm+XJaFeg10lLjkdX8p10N4ZEctEkC1R1aQDPRGoZnXJah3OVjo9Nbgud+BBf0",
    "s5hm+XJaFEg101LjkdX8p10N4ZEctEkClR1aQDPRGoZnXJah3OVjo9Nbgud+BBf0",
    "s5hm+XJaFeg101LjkdX8p10N4ZEctEkClR1aQDPRGoZnXJah3OVjo9Nbgud+BBf0"
];

for (const l2 of line2_variations) {
    for (const l3 of line3_variations) {
        const pem = `-----BEGIN PRIVATE KEY-----
${line1}
${l2}
${l3}
${line4}
-----END PRIVATE KEY-----`;

        try {
            crypto.createPrivateKey({
                key: pem,
                type: 'pkcs8',
                format: 'pem'
            });
            console.log("✅ Success!");
            console.log("L2:", l2);
            console.log("L3:", l3);
            console.log(pem);
            process.exit(0);
        } catch (e) {
            // Fail
        }
    }
}

console.log("❌ No combinations succeeded in targeted test.");
