-- Optional publish date for CMS pages (news, events, admin editor). Safe if column exists.

ALTER TABLE pages
  ADD COLUMN publish_date DATE NULL AFTER order_index,
  ADD INDEX idx_pages_publish_date (publish_date);
