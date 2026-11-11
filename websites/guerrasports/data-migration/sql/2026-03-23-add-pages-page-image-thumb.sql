-- Featured page image thumbnail (listings: home Events, etc.)
ALTER TABLE pages
  ADD COLUMN page_image_thumb VARCHAR(512) NULL AFTER page_image;
