-- Migration: Add video support to slider
-- Date: 2025-10-10
-- Description: Adds media_type and video_url columns to support video slides

-- Add media_type column (can be 'image' or 'video')
ALTER TABLE slider 
ADD COLUMN media_type VARCHAR(20) DEFAULT 'image' AFTER image_url;

-- Add video_url column for video file path
ALTER TABLE slider 
ADD COLUMN video_url VARCHAR(500) NULL AFTER media_type;

-- Update existing records to have media_type = 'image'
UPDATE slider SET media_type = 'image' WHERE media_type IS NULL OR media_type = '';

-- Add index for better query performance
CREATE INDEX idx_media_type ON slider(media_type);

-- Rollback Instructions:
-- To rollback this migration, run:
-- ALTER TABLE slider DROP COLUMN media_type;
-- ALTER TABLE slider DROP COLUMN video_url;
-- DROP INDEX idx_media_type ON slider;

