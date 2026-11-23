-- =============================================================================
-- Production-safe: add thumb_url columns for image thumbnails (PageSpeed).
-- Run ONCE per database. If a column already exists, skip that statement or
-- you will see "Duplicate column name" (safe to ignore).
--
-- Apply with (example):
--   mysql -h HOST -u USER -p DB_NAME < data-migration/sql/2026-03-21-add-thumb-url-columns.sql
--
-- Or use the TypeScript migration (recommended, idempotent):
--   cross-env NODE_ENV=production npx ts-node data-migration/2026-03-21-add-image-thumb-url-columns.ts
-- =============================================================================

ALTER TABLE product_images
  ADD COLUMN thumb_url VARCHAR(512) NULL AFTER image_url;

ALTER TABLE product_categories
  ADD COLUMN thumb_url VARCHAR(512) NULL AFTER image_url;

ALTER TABLE variant_type_values
  ADD COLUMN thumb_url VARCHAR(512) NULL AFTER image_url;
