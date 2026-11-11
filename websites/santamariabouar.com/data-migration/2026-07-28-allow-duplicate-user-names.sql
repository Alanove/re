-- Allow duplicate display names on users (username stores full name).
-- Email remains unique. Phone uniqueness is enforced in application code
-- (normalized digits) because formatting variants would bypass a raw UNIQUE index.
--
-- Rollback:
--   ALTER TABLE users ADD UNIQUE KEY username (username);

ALTER TABLE users DROP INDEX username;
