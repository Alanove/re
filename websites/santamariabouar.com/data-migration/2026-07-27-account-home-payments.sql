-- Account home: wallet flag, welcome CMS page, default payment method settings
-- Rollback:
--   ALTER TABLE users DROP COLUMN wallet_enabled;
--   DELETE FROM pages WHERE slug = 'account-welcome';
--   DELETE FROM site_settings WHERE setting_key = 'payments';

-- Per-user wallet visibility in member portal
ALTER TABLE users
  ADD COLUMN wallet_enabled TINYINT(1) NOT NULL DEFAULT 0
  AFTER role;

-- Editable welcome content for /account (Admin → Pages)
INSERT INTO pages (title, slug, content, meta_description, meta_keywords, status, template, parent_id, order_index)
SELECT
  'Welcome to Santa Maria Bouar',
  'account-welcome',
  '<p>Welcome to Santa Maria Bouar. Here you can view your account profile, your apartments, any payments that are due, and your payment history.</p><p>You can also browse compound payment reports to see how common expenses are managed across the compound.</p>',
  'Member account welcome message',
  'account, welcome, member',
  'published',
  NULL,
  NULL,
  0
WHERE NOT EXISTS (
  SELECT 1 FROM pages WHERE slug = 'account-welcome'
);

-- Default payment methods (editable in Admin → Settings → Payments)
INSERT INTO site_settings (setting_key, setting_value, setting_type, description)
SELECT
  'payments',
  '{"whishEnabled":false,"whishDetails":"","omtEnabled":false,"omtDetails":"","bankTransferEnabled":false,"bankInfo":""}',
  'object',
  'Member portal payment method instructions'
WHERE NOT EXISTS (
  SELECT 1 FROM site_settings WHERE setting_key = 'payments'
);
