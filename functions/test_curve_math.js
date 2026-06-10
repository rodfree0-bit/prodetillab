const p = BigInt("0xffffffff00000001000000000000000000000000ffffffffffffffffffffffff");
const B = BigInt("0x5ac635d8aa3a93e7b3ebbd55769886bc651d06b0cc53b0f63bce3c3e27d2604b");

function checkPoint(xHex, yHex) {
    const X = BigInt("0x" + xHex);
    const Y = BigInt("0x" + yHex);

    const y2 = (Y * Y) % p;
    const x3_3x_b = (X * X * X - 3n * X + B) % p;

    // Make sure they are positive mod p
    const y2_pos = (y2 + p) % p;
    const x3_pos = (x3_3x_b + p) % p;

    console.log(`X: ${X.toString(16)}`);
    console.log(`Y: ${Y.toString(16)}`);
    console.log(`Y^2 mod p:     ${y2_pos.toString(16)}`);
    console.log(`X^3-3x+B mod p: ${x3_pos.toString(16)}`);
    console.log(`Diff: ${(y2_pos - x3_pos).toString()}`);
    return y2_pos === x3_pos;
}

// Let's extract X and Y hex from our decoded base64 strings:
const xHex = "732a4271aec09b0ab3f1011cca909c6bb026c2acfcb39866f9725a144835d352";
const yHex = "e391d5fca75d0de1911cb44902d51d5a4033d11a86675c96a1dce563a3d35b82";

console.log("Checking P-256 curve alignment...");
const ok = checkPoint(xHex, yHex);
console.log(`\nPoint is on curve: ${ok}`);
