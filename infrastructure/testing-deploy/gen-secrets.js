// Run on the server by 03-deploy-app.sh — generates a fresh RS256 keypair +
// AES key for this test deploy. Never reuse these for anything beyond
// testing; they're only ever written to the instance's own apps/api/.env.
const crypto = require('node:crypto');

const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'pkcs1', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs1', format: 'pem' },
});

console.log(`ENCRYPTION_KEY=${crypto.randomBytes(32).toString('base64')}`);
console.log(`JWT_PRIVATE_KEY_B64=${Buffer.from(privateKey).toString('base64')}`);
console.log(`JWT_PUBLIC_KEY_B64=${Buffer.from(publicKey).toString('base64')}`);
