/**
 * Homepage static blocks: tagline under hero, editorial poster banner, three service columns.
 */
import dotenv from 'dotenv';
import * as path from 'path';

const nodeEnv = process.env.NODE_ENV || 'development';
const envFile = `.env.${nodeEnv}`;
dotenv.config({ path: path.resolve(process.cwd(), envFile) });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { db } from '../src/config/database';

/** Default tagline: same visual structure as legacy three-block layout, editable as one field. */
const DEFAULT_TAGLINE_HTML = [
  '<div class="luxury-hero-tagline-intro"><p>Introducing</p></div>',
  '<div class="luxury-hero-tagline-headline"><p>Pre-Fall 2026</p></div>',
  '<div class="luxury-hero-tagline-shop"><p><a href="/products" rel="noopener noreferrer">Discover</a></p></div>'
].join('');

const DEFAULTS = {
  tagline_html: DEFAULT_TAGLINE_HTML,
  poster_image_url: '/images/Firefly-2.jpg',
  poster_button_text: 'SHOP THE COLLECTION',
  poster_button_link: '/products',
  care_title: 'Customer Care',
  care_body_html:
    '<p>Our Client Services team is available to assist with online orders, returns, and other enquiries.</p>',
  care_button_text: 'Learn More',
  care_button_link: '/contact-us',
  appointments_title: 'Appointments',
  appointments_body_html:
    '<p>Connect with an in-house stylist for a shopping experience tailored for you.</p>',
  appointments_button_text: 'Request an Appointment',
  appointments_button_link: '/contact-us',
  bridal_title: 'Bridal Services',
  bridal_body_html:
    '<p>Say &ldquo;I do&rdquo; to our bespoke bridal services, available by appointment only.</p>',
  bridal_button_text: 'Learn More',
  bridal_button_link: '/contact-us'
};

async function run(): Promise<void> {
  console.log('Creating home_page_content table...');
  await db.query(`
    CREATE TABLE IF NOT EXISTS home_page_content (
      id INT NOT NULL PRIMARY KEY,
      tagline_html MEDIUMTEXT,
      poster_image_url VARCHAR(512) NOT NULL DEFAULT '',
      poster_button_text VARCHAR(255) NOT NULL DEFAULT '',
      poster_button_link VARCHAR(512) NOT NULL DEFAULT '',
      care_title VARCHAR(255) NOT NULL DEFAULT '',
      care_body_html MEDIUMTEXT,
      care_button_text VARCHAR(255) NOT NULL DEFAULT '',
      care_button_link VARCHAR(512) NOT NULL DEFAULT '',
      appointments_title VARCHAR(255) NOT NULL DEFAULT '',
      appointments_body_html MEDIUMTEXT,
      appointments_button_text VARCHAR(255) NOT NULL DEFAULT '',
      appointments_button_link VARCHAR(512) NOT NULL DEFAULT '',
      bridal_title VARCHAR(255) NOT NULL DEFAULT '',
      bridal_body_html MEDIUMTEXT,
      bridal_button_text VARCHAR(255) NOT NULL DEFAULT '',
      bridal_button_link VARCHAR(512) NOT NULL DEFAULT '',
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  const [existing] = await db.query(`SELECT COUNT(*) AS cnt FROM home_page_content WHERE id = 1`);
  const cnt = Number((existing as { cnt: number }[])?.[0]?.cnt ?? 0);
  if (cnt === 0) {
    console.log('Seeding default homepage content (row id = 1)...');
    await db.execute(
      `INSERT INTO home_page_content (
        id,
        tagline_html,
        poster_image_url, poster_button_text, poster_button_link,
        care_title, care_body_html, care_button_text, care_button_link,
        appointments_title, appointments_body_html, appointments_button_text, appointments_button_link,
        bridal_title, bridal_body_html, bridal_button_text, bridal_button_link
      ) VALUES (
        1,
        ?,
        ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?
      )`,
      [
        DEFAULTS.tagline_html,
        DEFAULTS.poster_image_url,
        DEFAULTS.poster_button_text,
        DEFAULTS.poster_button_link,
        DEFAULTS.care_title,
        DEFAULTS.care_body_html,
        DEFAULTS.care_button_text,
        DEFAULTS.care_button_link,
        DEFAULTS.appointments_title,
        DEFAULTS.appointments_body_html,
        DEFAULTS.appointments_button_text,
        DEFAULTS.appointments_button_link,
        DEFAULTS.bridal_title,
        DEFAULTS.bridal_body_html,
        DEFAULTS.bridal_button_text,
        DEFAULTS.bridal_button_link
      ]
    );
    console.log('  ✓ Default homepage content inserted');
  } else {
    console.log('  homepage content row already present, skipping seed');
  }

  console.log('  ✓ home_page_content ready');
}

export default run;

if (require.main === module) {
  run()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
