-- Add thumb_url for page gallery images (listing / grid). Run once.
-- Safe to ignore if column already exists.

ALTER TABLE page_photos
  ADD COLUMN thumb_url VARCHAR(512) NULL AFTER file_path;
