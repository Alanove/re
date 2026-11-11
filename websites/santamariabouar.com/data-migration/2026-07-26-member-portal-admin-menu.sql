-- Add admin menu items for member portal approval queues
-- Roles JSON must include Super Admin and Admin

INSERT INTO admin_menu (title, url, parent_id, order_index, icon, roles, is_visible)
SELECT 'Member Portal', '#', NULL, 90, 'fa fa-users', '["Super Admin","Admin"]', 1
FROM DUAL
WHERE NOT EXISTS (
  SELECT 1 FROM admin_menu WHERE title = 'Member Portal' AND url = '#'
);

SET @member_portal_parent := (
  SELECT id FROM admin_menu WHERE title = 'Member Portal' AND url = '#' ORDER BY id DESC LIMIT 1
);

INSERT INTO admin_menu (title, url, parent_id, order_index, icon, roles, is_visible)
SELECT 'Access Requests', '/admin/access-requests', @member_portal_parent, 1, 'fa fa-user-plus', '["Super Admin","Admin"]', 1
FROM DUAL
WHERE @member_portal_parent IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM admin_menu WHERE url = '/admin/access-requests');

INSERT INTO admin_menu (title, url, parent_id, order_index, icon, roles, is_visible)
SELECT 'Listing Requests', '/admin/listing-requests', @member_portal_parent, 2, 'fa fa-tags', '["Super Admin","Admin"]', 1
FROM DUAL
WHERE @member_portal_parent IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM admin_menu WHERE url = '/admin/listing-requests');

INSERT INTO admin_menu (title, url, parent_id, order_index, icon, roles, is_visible)
SELECT 'Gate Access Requests', '/admin/gate-access-requests', @member_portal_parent, 3, 'fa fa-key', '["Super Admin","Admin"]', 1
FROM DUAL
WHERE @member_portal_parent IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM admin_menu WHERE url = '/admin/gate-access-requests');

INSERT INTO admin_menu (title, url, parent_id, order_index, icon, roles, is_visible)
SELECT 'Photo Approvals', '/admin/photo-approvals', @member_portal_parent, 4, 'fa fa-image', '["Super Admin","Admin"]', 1
FROM DUAL
WHERE @member_portal_parent IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM admin_menu WHERE url = '/admin/photo-approvals');
