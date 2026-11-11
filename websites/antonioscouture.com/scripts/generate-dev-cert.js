/**
 * Generate a self-signed certificate for local HTTPS development.
 * Run: npm run cert:dev
 * No OpenSSL required — uses Node and the selfsigned package.
 */
const fs = require('fs');
const path = require('path');
const selfsigned = require('selfsigned');

const certDir = path.join(__dirname, '..', 'cert');
const keyPath = path.join(certDir, 'key.pem');
const certPath = path.join(certDir, 'cert.pem');

const attrs = [{ name: 'commonName', value: 'localhost' }];
const notAfter = new Date();
notAfter.setFullYear(notAfter.getFullYear() + 1);
const options = {
  keySize: 2048,
  algorithm: 'sha256',
  notAfterDate: notAfter,
  extensions: [
    {
      name: 'subjectAltName',
      altNames: [
        { type: 2, value: 'localhost' },
        { type: 7, ip: '127.0.0.1' }
      ]
    }
  ]
};

async function run() {
  const pems = await selfsigned.generate(attrs, options);
  if (!fs.existsSync(certDir)) {
    fs.mkdirSync(certDir, { recursive: true });
  }
  fs.writeFileSync(keyPath, pems.private, 'utf8');
  fs.writeFileSync(certPath, pems.cert, 'utf8');
  console.log('Created:');
  console.log('  cert/key.pem');
  console.log('  cert/cert.pem');
  console.log('');
  console.log('Enable HTTPS in .env.development:');
  console.log('  USE_HTTPS=true');
  console.log('  HTTPS_KEY_PATH=cert/key.pem');
  console.log('  HTTPS_CERT_PATH=cert/cert.pem');
  console.log('  APP_URL=https://localhost:3003');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
