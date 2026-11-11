const crypto = require('crypto');

// Function to hash password with salt using SHA-256
function hashPassword(password, salt) {
  return crypto.createHash('sha256').update(password + salt).digest('hex');
}

// Test the admin@admin.com user
const email = 'admin@admin.com';
const salt = '54cf39e82021f8c942e0993d1bf88c29';
const storedHash = '09ed790d05b172382e06d33cad2ecf1383b98eaea0df9d1a43eec14fed5601ca';

console.log('Testing password for admin@admin.com');
console.log('Salt:', salt);
console.log('Stored hash:', storedHash);

// Try common passwords
const testPasswords = ['admin', 'admin123', 'password', '123456', 'admin@admin.com'];

testPasswords.forEach(password => {
  const hash = hashPassword(password, salt);
  const matches = hash === storedHash;
  console.log(`Password "${password}": ${hash} ${matches ? '✓ MATCHES' : '✗'}`);
});

// Also test the test@test.com user
console.log('\nTesting password for test@test.com');
const testSalt = 'gebco_admin_salt_2024';
const testStoredHash = 'ae732ae6a064cd81d8dc2b11e97a9fca40ad73013fcaaec97bb80f8cf1f43930';

testPasswords.forEach(password => {
  const hash = hashPassword(password, testSalt);
  const matches = hash === testStoredHash;
  console.log(`Password "${password}": ${hash} ${matches ? '✓ MATCHES' : '✗'}`);
});
