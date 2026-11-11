# Deploy: client CMS feedback (2026-10-20)

The package mirrors the project folder. Copy everything under `files/` into the project root on the server, keeping the folder structure, then follow the steps below.

## What is in the package

- Compiled server code in `dist/` (what `npm start` runs), plus the matching `.ts` sources in `admin/` and `src/` so the server can also be rebuilt with `npm run build`.
- Views (`views/`, `admin/views/`) and `public/theme/solu.css`.
- Data migration scripts in `scripts/`.

`data/pages.json` and `data/home-sections.json` are **not** included on purpose, so live content (including the client's test news and slide) is not overwritten. The scripts below update the live files in place.

No new npm packages are required.

## Steps

1. Back up the live data folder:

   ```bash
   cp -r data data-backup-$(date +%Y%m%d)
   ```

2. Copy the contents of `files/` over the project root.

3. Run the data migrations from the project root (both are safe to run more than once):

   ```bash
   node scripts/remove-legacy-pages.js
   node scripts/contact-placeholders.js
   ```

4. Restart the app so the new code and views load (views are cached in production), for example:

   ```bash
   pm2 restart all
   ```

5. In **Admin → Site Settings**:
   - **reCAPTCHA Site Key / Secret Key**: Google reCAPTCHA v2 "Invisible" keys for the live domain. Contact forms reject submissions until both are saved.
   - **Outgoing Mail (SMTP)**: for Resend use host `smtp.resend.com`, port `465` with SSL, username `resend`, password = Resend API key, From = address on a domain verified in Resend. Save, then click **Send test email**.

## Check after deploy

- `/investor-relations` and `/about-us/sustainability` return 404.
- Home page banner comes from **Admin → Slider** (the client's test slide should appear).
- The client's test news item shows on `/category/news`.
- **Admin → Products → Add Product** and **Product Categories → Add Category** open an empty form.
- **Admin → Pages → Contact Us** opens in the visual editor; the form and map show as `[contact-form]` and `[map]`.
- Contact form on `/` and `/contact-us` sends a message to the Contact Email.
