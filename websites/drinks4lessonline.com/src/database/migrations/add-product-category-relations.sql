CREATE TABLE IF NOT EXISTS product_category_relations (
    product_id INT NOT NULL,
    category_id INT NOT NULL,
    PRIMARY KEY (product_id, category_id),
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES product_categories(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Migrate existing relationships
INSERT IGNORE INTO product_category_relations (product_id, category_id)
SELECT id, category_id FROM products WHERE category_id IS NOT NULL;
