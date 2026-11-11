-- Admin menu item for compound amenities management

INSERT INTO admin_menu (title, url, parent_id, order_index, icon, roles, is_visible)
SELECT 'Compound Amenities', '/admin/compound-amenities', NULL, 91, 'fa fa-building', '["Super Admin","Admin"]', 1
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM admin_menu WHERE url = '/admin/compound-amenities');
