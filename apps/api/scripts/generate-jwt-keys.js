#!/usr/bin/env node
/**
 * Generates a local RS256 keypair for JWT signing and prints the base64
 * .env lines to stdout. Run once per developer machine; never commit the
 * output. Staging/production use AWS KMS-managed keys instead.
 */
const { generateKeyPairSync } = require('node:crypto');

const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs1', format: 'pem' },
  publicKeyEncoding: { type: 'pkcs1', format: 'pem' },
});

const b64 = (value) => Buffer.from(value).toString('base64');

console.log(`JWT_PRIVATE_KEY_B64=${b64(privateKey)}`);
console.log(`JWT_PUBLIC_KEY_B64=${b64(publicKey)}`);
