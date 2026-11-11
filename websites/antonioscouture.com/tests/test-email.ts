/**
 * Email Configuration Test Script
 *
 * Uses the same emailService as the app (src/services/emailService.ts). Port 465
 * uses implicit TLS (secure: true); 587/25 use STARTTLS (secure: false).
 *
 * Run with: npm run test:email  (development) or npm run test:email:prod  (production)
 * Or: ts-node tests/test-email.ts  (or node dist/tests/test-email.js after build)
 *
 * This script will:
 * 1. Load environment variables from .env files
 * 2. Display current SMTP configuration
 * 3. Test SMTP connection
 * 4. Send a test email (optional)
 *
 * On deployment: run "npm run build" and restart the Node process so the server
 * uses the built emailService in dist/; otherwise the old code may still run.
 */

// Load environment variables from .env file (must be before email service import)
import dotenv from 'dotenv';
import * as path from 'path';

// Determine environment (default to development)
const nodeEnv = process.env.NODE_ENV || 'development';

// Load environment-specific .env file
const envFile = `.env.${nodeEnv}`;
const envPath = path.resolve(process.cwd(), envFile);

console.log(`\n📧 Email Configuration Test`);
console.log(`============================\n`);
console.log(`Environment: ${nodeEnv}`);
console.log(`Loading env file: ${envFile}\n`);

// Try to load environment-specific file, fallback to .env if not found
const envResult = dotenv.config({ path: envPath });
if (envResult.error && nodeEnv !== 'development') {
  console.warn(`⚠️  Warning: Could not load ${envFile}, trying .env...`);
  dotenv.config({ path: path.resolve(process.cwd(), '.env') });
} else if (!envResult.error) {
  console.log(`✅ Loaded environment variables from ${envFile}`);
}

// Also load base .env if it exists (for overrides)
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// Now import email service after environment is loaded
import emailService from '../src/services/emailService';

/** Same logic as emailService: port 465 => secure (implicit TLS), else STARTTLS. */
function getSecureFlag(): boolean {
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  return process.env.SMTP_SECURE !== undefined
    ? process.env.SMTP_SECURE === 'true'
    : port === 465;
}

/**
 * Display current SMTP configuration
 */
function displaySMTPConfig(): void {
  console.log(`\n📋 Current SMTP Configuration:`);
  console.log(`─────────────────────────────────`);
  
  const secure = getSecureFlag();
  const config = {
    host: process.env.SMTP_HOST || 'localhost (default)',
    port: process.env.SMTP_PORT || '587 (default)',
    secure: secure ? 'true (SSL/TLS, port 465)' : 'false (STARTTLS)',
    user: process.env.SMTP_USER || 'Not set',
    password: process.env.SMTP_PASSWORD ? '***' + process.env.SMTP_PASSWORD.slice(-4) : 'Not set',
    from: process.env.SMTP_FROM || 'noreply@example.com (default)',
    rejectUnauthorized: process.env.SMTP_REJECT_UNAUTHORIZED !== 'false' ? 'true' : 'false'
  };

  console.log(`  Host: ${config.host}`);
  console.log(`  Port: ${config.port}`);
  console.log(`  Secure: ${config.secure}`);
  console.log(`  User: ${config.user}`);
  console.log(`  Password: ${config.password}`);
  console.log(`  From Address: ${config.from}`);
  console.log(`  Reject Unauthorized: ${config.rejectUnauthorized}`);
  console.log(``);
}

/**
 * Test SMTP connection
 */
async function testConnection(): Promise<boolean> {
  console.log(`🔌 Testing SMTP Connection...`);
  console.log(`─────────────────────────────────`);
  
  try {
    const isConnected = await emailService.testConnection();
    
    if (isConnected) {
      console.log(`✅ SMTP connection successful!\n`);
      return true;
    } else {
      console.log(`❌ SMTP connection failed!\n`);
      console.log(`💡 If the error above mentions IMAP or Dovecot: you are using the wrong port. Use SMTP port 587 or 465 (not IMAP 143 or 993).\n`);
      return false;
    }
  } catch (error: any) {
    console.log(`❌ SMTP connection error:`);
    console.log(`   ${error.message}\n`);
    
    if (error.code === 'EAUTH') {
      console.log(`💡 Tip: Check your SMTP_USER and SMTP_PASSWORD credentials`);
    } else if (error.code === 'ECONNECTION' || error.code === 'ETIMEDOUT') {
      console.log(`💡 Tip: Check your SMTP_HOST and SMTP_PORT settings`);
    } else if (error.code === 'EPROTOCOL') {
      console.log(`💡 Tip: Wrong protocol. Use SMTP port 587 or 465 for sending email, not IMAP port 143 or 993.`);
    } else if (error.code === 'ESOCKET') {
      console.log(`💡 Tip: Check your network connection and firewall settings`);
    }
    console.log(``);
    return false;
  }
}

/**
 * Send test email
 */
async function sendTestEmail(): Promise<boolean> {
  console.log(`📨 Sending Test Email...`);
  console.log(`─────────────────────────────────`);
  
  // Get test email recipient from environment or use SMTP_USER
  const testEmail = process.env.TEST_EMAIL || process.env.SMTP_USER;
  
  if (!testEmail) {
    console.log(`⚠️  No test email address configured.`);
    console.log(`   Set TEST_EMAIL in your .env file or use SMTP_USER as recipient.\n`);
    return false;
  }

  const secure = getSecureFlag();
  try {
    const result = await emailService.sendEmail({
      to: testEmail,
      subject: 'Test Email - SMTP Configuration',
      html: `
        <h2>Email Configuration Test</h2>
        <p>This is a test email to verify your SMTP settings are working correctly.</p>
        <p><strong>Configuration Details:</strong></p>
        <ul>
          <li>Host: ${process.env.SMTP_HOST || 'localhost'}</li>
          <li>Port: ${process.env.SMTP_PORT || '587'}</li>
          <li>Secure: ${secure ? 'Yes (SSL/TLS)' : 'No (STARTTLS)'}</li>
          <li>User: ${process.env.SMTP_USER || 'Not set'}</li>
        </ul>
        <p>If you received this email, your SMTP configuration is working! ✅</p>
        <hr>
        <p style="color: #666; font-size: 12px;">Sent at: ${new Date().toISOString()}</p>
      `,
      text: `
Email Configuration Test

This is a test email to verify your SMTP settings are working correctly.

Configuration Details:
- Host: ${process.env.SMTP_HOST || 'localhost'}
- Port: ${process.env.SMTP_PORT || '587'}
- Secure: ${secure ? 'Yes (SSL/TLS)' : 'No (STARTTLS)'}
- User: ${process.env.SMTP_USER || 'Not set'}

If you received this email, your SMTP configuration is working!

Sent at: ${new Date().toISOString()}
      `
    });

    if (result) {
      console.log(`✅ Test email sent successfully to: ${testEmail}\n`);
      return true;
    } else {
      console.log(`❌ Failed to send test email\n`);
      return false;
    }
  } catch (error: any) {
    console.log(`❌ Error sending test email:`);
    console.log(`   ${error.message}\n`);
    return false;
  }
}

/**
 * Main test function
 */
async function runTests(): Promise<void> {
  // Display configuration
  displaySMTPConfig();

  // Check if required settings are present
  const requiredSettings = ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASSWORD'];
  const missingSettings = requiredSettings.filter(setting => !process.env[setting]);
  
  if (missingSettings.length > 0) {
    console.log(`⚠️  Missing required SMTP settings:`);
    missingSettings.forEach(setting => console.log(`   - ${setting}`));
    console.log(`\nPlease add these to your .env file.\n`);
    process.exit(1);
  }

  // Test connection
  const connectionSuccess = await testConnection();
  
  if (!connectionSuccess) {
    console.log(`❌ Connection test failed. Please check your SMTP settings.\n`);
    process.exit(1);
  }

  // Ask if user wants to send test email (if TEST_EMAIL is not set, prompt)
  const testEmail = process.env.TEST_EMAIL || process.env.SMTP_USER;
  
  if (testEmail) {
    // Send test email
    const emailSuccess = await sendTestEmail();
    
    if (emailSuccess) {
      console.log(`✅ All tests passed! Your email configuration is working correctly.\n`);
      process.exit(0);
    } else {
      console.log(`⚠️  Connection test passed, but email sending failed.\n`);
      process.exit(1);
    }
  } else {
    console.log(`✅ Connection test passed!`);
    console.log(`💡 To test email sending, set TEST_EMAIL in your .env file.\n`);
    process.exit(0);
  }
}

// Run tests
runTests().catch((error) => {
  console.error(`\n❌ Unexpected error:`, error);
  process.exit(1);
});
