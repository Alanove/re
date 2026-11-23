-- =============================================================================
-- Production-safe: add include_in_auto_ads to products (Meta product feed toggle).
-- Run ONCE per database. Safe to ignore "Duplicate column name" if already applied.
--
-- Apply with (example):
--   mysql -h HOST -u USER -p DB_NAME < data-migration/sql/2026-06-14-add-include-in-auto-ads-to-products.sql
--
-- Or use the TypeScript migration (recommended, idempotent):
--   npm run migrate:include-in-auto-ads:production
-- Or run all pending migrations:
--   npm run migrate:production
--   npm run migrate:production:built   (after npm run build)
-- =============================================================================

ALTER TABLE products
  ADD COLUMN include_in_auto_ads BOOLEAN NOT NULL DEFAULT TRUE AFTER is_active;
