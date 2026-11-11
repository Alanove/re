#!/usr/bin/env node

/**
 * Simple migration runner script
 * Usage: node data-migration/migrate.js [command]
 * 
 * Commands:
 *   run     - Run all pending migrations (default)
 *   status  - Show migration status
 */

const { execSync } = require('child_process');
const path = require('path');

const command = process.argv[2] || 'run';

try {
  console.log(`🔄 Running migration command: ${command}`);
  
  const scriptPath = path.join(__dirname, 'run-migrations.ts');
  execSync(`npx ts-node "${scriptPath}" ${command}`, { 
    stdio: 'inherit',
    cwd: path.join(__dirname, '..')
  });
  
  console.log('✅ Migration command completed');
} catch (error) {
  console.error('❌ Migration command failed:', error.message);
  process.exit(1);
}
