# Database Migration from JSON to SQL Server

## Overview

This document describes the migration of the Santa Maria Bouar CMS from JSON file storage to SQL Server (MSSQL) database.

## Changes Made

### 1. Database Configuration

- **Location**: `src/config/database.config.ts`, `src/config/database.ts`
- **Connection String**: `Server=localhost;User ID=sa;Password=P@55w0rd;Database=smb`
- **Environment Support**: 
  - Development: Uses hardcoded connection string
  - Production: Uses environment variables (`DB_SERVER`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`)

### 2. Database Schema

- **Location**: `src/database/schema.sql`
- **Tables Created**:
  - `users` - User accounts and authentication
  - `accounts` - Financial accounts
  - `transaction_categories` - Transaction categories
  - `transactions` - Financial transactions
  - `apartments` - Apartment information
  - `payments` - Master payment records (includes price per meter)
  - `apartment_payments` - Individual apartment payment records
  - `projects` - Project portfolio
  - `pages` - CMS pages
  - `menu` - Public menu items
  - `admin_menu` - Admin panel menu
  - `slider` - Homepage slider
  - `site_settings` - Site configuration
  - `theme_config` - Theme settings

### 3. Auto-Increment IDs

All tables now use SQL Server `IDENTITY(1,1)` for auto-incrementing primary keys. No manual ID generation is required.

### 4. Migration Script

- **Location**: `src/database/migrate.ts`
- **Command**: `npm run migrate`
- **Features**:
  - Reads all JSON files from `data/` directory
  - Creates database schema
  - Migrates all data preserving original IDs using `SET IDENTITY_INSERT`
  - Provides detailed migration summary
  - Error handling for each table

### 5. Refactored Services

All services have been converted from JSON file operations to SQL Server operations:

#### Core Services (✅ Completed)
- `usersService.ts` - User management with authentication
- `accountsService.ts` - Financial account management
- `siteSettingsService.ts` - Site configuration

#### Apartment Services (✅ Completed)
- `apartmentsService.ts` - Apartment management
- `paymentsService.ts` - Price per meter management
- `apartmentPaymentsService.ts` - Payment tracking

#### Transaction Services (⏳ In Progress)
- `transactionsService.ts` - Transaction management
- `transactionCategoriesService.ts` - Category management

#### Content Services (⏳ In Progress)
- `pagesService.ts` - Page management
- `menuService.ts` - Menu management
- `sliderService.ts` - Slider management
- `projectsService.ts` - Project management

#### System Services (⏳ In Progress)
- `adminMenuService.ts` - Admin menu
- `themeService.ts` - Theme configuration

## Migration Steps

### 1. Install Dependencies

```bash
npm install mssql @types/mssql
```

### 2. Configure Database

Edit `src/config/database.config.ts` if you need different connection settings:

```typescript
development: {
  server: 'localhost',
  user: 'sa',
  password: 'P@55w0rd',
  database: 'smb',
  // ...
}
```

### 3. Create Database

```sql
CREATE DATABASE smb;
```

### 4. Run Migration

```bash
npm run migrate
```

This will:
- Create all database tables
- Create indexes and triggers
- Migrate all data from JSON files
- Display migration summary

### 5. Start Application

```bash
npm run dev
```

## API Changes

### Service Methods

All service methods are now **asynchronous** and return **Promises**. Update all controller code accordingly:

#### Before (JSON):
```typescript
const users = usersService.getAllUsers();
const user = usersService.getUserById(id);
```

#### After (SQL):
```typescript
const users = await usersService.getAllUsers();
const user = await usersService.getUserById(id);
```

### Controllers Update Required

All controllers using these services must be updated to use `async/await`:

```typescript
// Example
export const getAllUsers = async (req: Request, res: Response) => {
  const users = await usersService.getAllUsers();
  res.render('users/list', { users });
};
```

## Environment Variables

For production, set these environment variables:

```bash
NODE_ENV=production
DB_SERVER=your-server.database.windows.net
DB_USER=your-username
DB_PASSWORD=your-password
DB_NAME=smb
```

## Database Connection Pooling

The application uses connection pooling for optimal performance:

- Single connection pool instance (singleton pattern)
- Automatic reconnection on connection errors
- Connection reuse across requests

## Triggers and Timestamps

All tables have automatic `updated_at` timestamp triggers that fire on UPDATE operations.

## Data Types

### Key Mappings

| JSON Type | SQL Server Type | Notes |
|-----------|----------------|--------|
| string | NVARCHAR(255/500/MAX) | Variable length based on content |
| number | INT or DECIMAL(18,2) | INT for IDs, DECIMAL for currency |
| boolean | BIT | true = 1, false = 0 |
| date | DATE or DATETIME2 | DATETIME2 for timestamps |
| array/object | NVARCHAR(MAX) | Stored as JSON string |

### JSON Fields

Some complex fields are stored as JSON strings and need parsing:

- `projects.images` - Array of image paths
- `projects.tags` - Array of tags
- `admin_menu.roles` - Array of allowed roles
- `site_settings.setting_value` - Various types stored as JSON

## Performance Considerations

### Indexes

The following indexes are created for optimal query performance:

- Transaction lookups by account and category
- Apartment payment lookups by apartment and payment
- Project and page lookups by slug
- Menu hierarchical queries

### Query Optimization

- Use parameterized queries to prevent SQL injection
- Connection pooling reduces overhead
- Indexes on frequently queried columns
- Avoid SELECT * in production code

## Rollback Plan

If you need to rollback to JSON files:

1. Stop the application
2. Restore the `data/` directory from backup
3. Checkout the previous commit before migration
4. Run `npm install` to restore dependencies
5. Restart the application

## Backup Strategy

### Before Migration
- Backup all JSON files in `data/` directory
- Commit all changes to version control

### After Migration
- Regular SQL Server backups
- Keep JSON files as backup for 30 days
- Export data periodically:
  ```bash
  sqlcmd -S localhost -U sa -P P@55w0rd -d smb -Q "SELECT * FROM users" -o users_backup.txt
  ```

## Troubleshooting

### Connection Issues

If you get connection errors:

1. Check SQL Server is running
2. Verify connection string in `database.config.ts`
3. Ensure firewall allows connections
4. Check SQL Server authentication mode (mixed mode required for SQL authentication)

### Migration Errors

If migration fails:

1. Drop the database and recreate it
2. Check JSON file format is valid
3. Review error messages in console
4. Run migration again

### Query Errors

If you get query errors:

1. Check parameter names match between input() and query
2. Verify data types are correct
3. Ensure table and column names are correct
4. Check for SQL syntax errors

## Testing

After migration, test all functionality:

- [ ] User login and authentication
- [ ] Create/Read/Update/Delete operations for all entities
- [ ] Financial transactions and reporting
- [ ] Apartment payment generation and tracking
- [ ] Content management (pages, projects, menu)
- [ ] Site settings updates
- [ ] Admin panel navigation

## Support

For issues or questions:

1. Check this documentation
2. Review SQL Server logs
3. Check application logs
4. Verify database schema matches `schema.sql`

## Future Enhancements

Potential improvements:

1. Add database migrations system (e.g., Knex.js, TypeORM)
2. Implement caching layer (Redis)
3. Add full-text search capabilities
4. Implement audit logging
5. Add database query logging for debugging
6. Create database backup automation
7. Implement read replicas for scaling


