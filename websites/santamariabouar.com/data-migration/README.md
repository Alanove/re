# Data Migration Scripts

This directory contains all database migration scripts for the Santa Maria Bouar CMS project.

## Purpose

All data migration scripts must be placed in this directory. This includes:
- Schema migrations (table structure changes)
- Data transformations
- Data imports/exports
- Database refactoring scripts
- Seeding scripts for production data changes

## Naming Convention

Migration scripts should follow this naming pattern:
```
YYYY-MM-DD-descriptive-name.ts
```

Examples:
- `2025-10-09-add-user-roles-table.ts`
- `2025-10-09-migrate-json-to-mysql.ts`
- `2025-10-10-update-apartment-schema.ts`

## Script Structure

Each migration script should include:

1. **Header Comment**: Describe what the migration does
2. **Rollback Instructions**: How to undo the migration if needed
3. **Main Migration Logic**: The actual migration code
4. **Error Handling**: Proper error handling and logging
5. **Verification**: Optional verification steps

### Example Template

```typescript
/**
 * Migration: [Brief Description]
 * Date: YYYY-MM-DD
 * Author: [Your Name]
 * 
 * Description:
 * [Detailed description of what this migration does]
 * 
 * Rollback:
 * [How to rollback this migration]
 */

import pool from '../src/config/database';

async function migrate() {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    // Migration logic here
    
    await connection.commit();
    console.log('Migration completed successfully');
  } catch (error) {
    await connection.rollback();
    console.error('Migration failed:', error);
    throw error;
  } finally {
    connection.release();
  }
}

// Run migration
migrate().catch(console.error);
```

## Best Practices

1. **Always Backup First**: Before running any migration in production, create a database backup
2. **Test Locally**: Run migrations on local/development environment first
3. **Use Transactions**: Wrap migrations in transactions when possible
4. **Be Idempotent**: Migrations should be safe to run multiple times
5. **Document Dependencies**: Note any prerequisites or dependencies
6. **Keep Atomic**: Each migration should do one thing well
7. **Version Control**: Always commit migration scripts to git

## Running Migrations

### Using npm scripts (recommended)

Migrations are tracked in the `migrations` table. Only pending migrations are executed.

```bash
# Development (.env.development)
npm run migrate
npm run migrate:status

# Production (.env.production)
npm run migrate:production
npm run migrate:status:production

# Run a single migration by name
npx ts-node data-migration/run-migrations.ts run --env=development --only=2026-07-27-access-request-apartment-role

# Run migrations from a date onward
npx ts-node data-migration/run-migrations.ts run --env=development --from=2026-06-01

# Mark a migration as applied without running (existing DBs)
npm run migrate:mark -- 2026-07-27-access-request-apartment-role

# Mark all pending migrations before a date as applied
npm run migrate:mark-before -- 2026-06-01
```

### TypeScript migrations

New `.ts` migrations must export:

```typescript
import { MigrationContext } from './lib/migrationTypes';

export async function runMigration(ctx: MigrationContext): Promise<void> {
  ctx.log('Doing something...');
}
```

One-off data fix scripts (e.g. `2025-01-17-*`) are excluded from automatic runs and should be executed manually when needed.

### Manual Migration Execution

To run a migration script manually (not tracked):

```bash
npx ts-node data-migration/YYYY-MM-DD-migration-name.ts
```

**Note**: Prefer `npm run migrate` so execution is recorded in the `migrations` table.

## Migration History

Keep a log of executed migrations and their results in this section:

| Date | Script Name | Status | Notes |
|------|------------|--------|-------|
| 2025-01-15 | 2025-01-15-create-migrations-table.sql | Success | Created migrations tracking table |
| 2025-10-10 | 2025-01-15-add-phone-to-users.sql | Success | Added phone number column to users table |
| 2025-10-10 | 2025-01-15-remove-owner-column-from-accounts.sql | Success | Removed owner column from accounts table |
| 2025-10-10 | 2025-10-09-add-receipt-image-to-transactions.sql | Success | Added receipt_image column to transactions table (idempotent) |
| 2025-10-10 | 2025-10-09-apartment-images.sql | Success | Created apartment_images table for storing apartment images |

## Migration Tracking System

The project includes an automated migration tracking system:

### Features
- **Automatic Tracking**: All migrations are automatically recorded in the `migrations` table
- **Status Monitoring**: Track success/failure status of each migration
- **Execution History**: Complete audit trail of when migrations were run
- **Idempotent**: Safe to run multiple times - only executes pending migrations
- **Rollback Support**: Each migration includes rollback instructions

### Database Schema
The `migrations` table tracks:
- `migration_name`: Unique identifier for each migration
- `executed_at`: Timestamp when migration was executed
- `executed_by`: User/system that executed the migration
- `status`: success/failed/rolled_back
- `notes`: Additional information about the migration

### Commands
```bash
npm run migrate                  # development — run pending migrations
npm run migrate:production         # production
npm run migrate:status             # show applied / pending
npm run migrate:mark -- <name>     # mark as applied without running
npm run migrate:mark-before -- YYYY-MM-DD
```

## Important Notes

- **Never delete migration scripts** after they've been run in production
- **Never modify migration scripts** after they've been executed
- If you need to make changes, create a new migration script
- Always coordinate with the team before running migrations in production
- Use the migration runner for all database changes to ensure proper tracking

