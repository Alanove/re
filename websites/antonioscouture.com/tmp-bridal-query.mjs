import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config({ path: '.env' });

const c = await mysql.createConnection({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});

const [catCols] = await c.query(`SHOW COLUMNS FROM product_categories`);
console.log(
  'product_categories cols',
  catCols.map((x) => x.Field).join(', ')
);

const [cats] = await c.query(
  `SELECT *
   FROM product_categories
   WHERE slug LIKE '%bridal%2026%' OR name LIKE '%bridal%2026%'
   LIMIT 5`
);
console.log('cats', JSON.stringify(cats, null, 2));

if (cats[0]) {
  const id = cats[0].id;
  const [imgCols] = await c.query(`SHOW COLUMNS FROM product_images`);
  console.log(
    'product_images cols',
    imgCols.map((x) => x.Field).join(', ')
  );
  const [prods] = await c.query(
    `SELECT p.id, p.name, p.slug, pi.image_url, pi.thumb_url, pi.is_primary, pi.order_index
     FROM products p
     JOIN product_category_relations pcr ON pcr.product_id = p.id
     LEFT JOIN product_images pi ON pi.product_id = p.id
     WHERE pcr.category_id = ?
     ORDER BY p.id, COALESCE(pi.is_primary,0) DESC, pi.order_index
     LIMIT 40`,
    [id]
  );
  console.log('products', JSON.stringify(prods, null, 2));
}

const [blocks] = await c.query(
  `SELECT id, type, sort_order, config FROM home_page_blocks ORDER BY sort_order`
);
console.log(
  'blocks',
  JSON.stringify(
    blocks.map((b) => ({
      id: b.id,
      type: b.type,
      sort_order: b.sort_order,
      config: typeof b.config === 'string' ? JSON.parse(b.config) : b.config
    })),
    null,
    2
  )
);

await c.end();
