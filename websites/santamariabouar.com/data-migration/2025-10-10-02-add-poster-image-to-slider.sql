-- Migration: Add poster_image field to slider for video fallback
-- Date: 2025-10-10
-- Description: Adds poster_image column to store a fallback/poster image for video slides

-- Add poster_image column for video poster/fallback
ALTER TABLE slider 
ADD COLUMN poster_image VARCHAR(500) NULL AFTER video_url;

-- Rollback Instructions:
-- To rollback this migration, run:
-- ALTER TABLE slider DROP COLUMN poster_image;

