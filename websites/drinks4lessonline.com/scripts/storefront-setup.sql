DELETE FROM menu;
INSERT INTO menu (title, url, parent_id, order_index, is_visible) VALUES
('Main Menu', '', NULL, 0, 1),
('Footer Menu', '', NULL, 10, 1);
SET @main = (SELECT id FROM menu WHERE title = 'Main Menu' AND parent_id IS NULL LIMIT 1);
SET @foot = (SELECT id FROM menu WHERE title = 'Footer Menu' AND parent_id IS NULL LIMIT 1);
INSERT INTO menu (title, url, parent_id, order_index, is_visible) VALUES
('Cigarettes', '/shop/category/cigarettes', @main, 10, 1),
('Cigars', '/shop/category/cigars', @main, 20, 1),
('Shisha', '/shop/category/shisha', @main, 30, 1),
('Spirits', '/shop/category/spirits', @main, 40, 1),
('Wines', '/shop/category/wines', @main, 50, 1),
('Gifts', '/shop/category/gifts', @main, 60, 1),
('Help', '/contact-us', @main, 70, 1);
SET @cig = (SELECT id FROM menu WHERE title = 'Cigarettes' AND parent_id = @main);
SET @cgr = (SELECT id FROM menu WHERE title = 'Cigars' AND parent_id = @main);
SET @shi = (SELECT id FROM menu WHERE title = 'Shisha' AND parent_id = @main);
SET @spi = (SELECT id FROM menu WHERE title = 'Spirits' AND parent_id = @main);
SET @win = (SELECT id FROM menu WHERE title = 'Wines' AND parent_id = @main);
SET @gif = (SELECT id FROM menu WHERE title = 'Gifts' AND parent_id = @main);
SET @help = (SELECT id FROM menu WHERE title = 'Help' AND parent_id = @main);
INSERT INTO menu (title, url, parent_id, order_index, is_visible) VALUES
('Classic', '/shop/category/classic', @cig, 10, 1),
('E-Cigarettes', '/shop/category/e-cigarettes', @cig, 20, 1),
('Cigarette Accessories', '/shop/category/cigarette-accessories', @cig, 30, 1),
('Cuban', '/shop/category/cuban', @cgr, 10, 1),
('Non-Cuban', '/shop/category/non-cuban', @cgr, 20, 1),
('Cigar Accessories', '/shop/category/cigar-accessories', @cgr, 30, 1),
('Molasses', '/shop/category/molasses', @shi, 10, 1),
('Shisha Accessories', '/shop/category/shisha-accessories', @shi, 20, 1),
('Whisky', '/shop/category/whisky', @spi, 10, 1),
('Vodka', '/shop/category/vodka', @spi, 20, 1),
('Gin', '/shop/category/gin', @spi, 30, 1),
('Rum', '/shop/category/rum', @spi, 40, 1),
('Tequila', '/shop/category/tequila', @spi, 50, 1),
('Arak', '/shop/category/arak', @spi, 60, 1),
('Prosecco', '/shop/category/prosecco', @spi, 70, 1),
('Champagne', '/shop/category/champagne', @spi, 80, 1),
('Non-Alcoholic', '/shop/category/non-alcoholic', @spi, 90, 1),
('Spirit Accessories', '/shop/category/spirit-accessories', @spi, 100, 1),
('Red', '/shop/category/red', @win, 10, 1),
('White', '/shop/category/white', @win, 20, 1),
('Rose', '/shop/category/rose', @win, 30, 1),
('Wine Accessories', '/shop/category/wine-accessories', @win, 40, 1),
('Gift Baskets', '/shop/category/gift-baskets', @gif, 10, 1),
('Gift Vouchers', '/shop/category/gift-vouchers', @gif, 20, 1),
('Contact us', '/contact-us', @help, 10, 1),
('FAQs', '/faqs', @help, 20, 1),
('Our Story', '/our-story', @foot, 10, 1),
('Contact us', '/contact-us', @foot, 20, 1),
('Shop Now', '/our-categories', @foot, 30, 1),
('Privacy Policy', '/privacy-policy', @foot, 40, 1),
('Terms and Conditions', '/terms-and-conditions', @foot, 50, 1),
('FAQs', '/faqs', @foot, 60, 1),
('Careers', '/careers', @foot, 70, 1);

UPDATE payment_methods SET is_active = 0 WHERE code = 'netcommerce';
UPDATE payment_methods SET is_active = 1 WHERE code = 'cash_on_delivery';

INSERT INTO site_settings (setting_key, setting_value, setting_type) VALUES
('logo', '/images/logo.png', 'string'),
('favicon', '/images/favicon.png', 'string'),
('socialMedia', '{"facebook":"https://www.facebook.com/profile.php?id=100083022354012","instagram":"https://www.instagram.com/explore/locations/105417708876633/drinks4less-lb/","twitter":"","linkedin":"","youtube":""}', 'object')
ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value);

UPDATE pages SET content = '<p>Originally focused on wholesale, Wadihco adapted to the challenges brought by the COVID-19 pandemic and the Lebanese economic crisis by launching Drinks4Less, offering a direct-to-consumer shop with better prices across Lebanon.</p><p>At Drinks4Less, value comes first: more for less, whether you are stocking up at home or buying on the go.</p><p>The range covers local and imported cigarettes, cigars, shisha, spirits, wines, and non-alcoholic drinks.</p>' WHERE slug = 'our-story';

INSERT INTO shipping_zones (name, description, countries, is_active) VALUES
('Lebanon delivery 2', 'Keserwan and Matn below 100m', '["LB:K1","LB:MTN1"]', 1),
('Lebanon delivery 3', 'Mid elevation and Achrafieh', '["LB:ACH","LB:BD1","LB:MTN2","LB:K2","LB:JB1","LB:BAT1"]', 1),
('Lebanon delivery 5', 'Beirut and the rest of Lebanon', '["LB:AK","LB:BH","LB:BEY","LB:BQ","LB:JB2","LB:K3","LB:ML","LB:MTN3","LB:BD2","LB:NB","LB:NR","LB:BAT2","LB:STH"]', 1);
SET @z2 = (SELECT id FROM shipping_zones WHERE name = 'Lebanon delivery 2');
SET @z3 = (SELECT id FROM shipping_zones WHERE name = 'Lebanon delivery 3');
SET @z5 = (SELECT id FROM shipping_zones WHERE name = 'Lebanon delivery 5');
INSERT INTO shipping_rates (zone_id, name, method, base_rate, estimated_days, order_index) VALUES
(@z2, 'Deliver', 'flat_rate', 2, 1, 1),
(@z2, 'Store Pickup', 'flat_rate', 0, 0, 2),
(@z3, 'Deliver', 'flat_rate', 3, 1, 1),
(@z3, 'Store Pickup', 'flat_rate', 0, 0, 2),
(@z5, 'Deliver', 'flat_rate', 5, 2, 1),
(@z5, 'Store Pickup', 'flat_rate', 0, 0, 2);

UPDATE product_categories SET is_active = 1 WHERE slug IN ('gifts', 'gift-baskets', 'gift-vouchers');

-- Ensure users.language exists (admin login selects it). Run once if missing:
-- ALTER TABLE users ADD COLUMN language VARCHAR(10) NOT NULL DEFAULT 'en' AFTER role;
