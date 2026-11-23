# Brands OCR Script - Production Usage Instructions

This document provides instructions on how to run the Brands OCR (Optical Character Recognition) script on a production server to populate the brand carousel data from existing images.

## Prerequisites

1.  **Environment Variables**: Ensure your `.env.production` file (or equivalent environment settings) contains the correct database credentials:
    ```env
    NODE_ENV=production
    DB_HOST=your_production_db_host
    DB_USER=your_production_db_user
    DB_PASSWORD=your_production_db_password
    DB_NAME=your_db_name
    ```

2.  **Images**: Place all brand logo images in the following directory:
    `public/images/brands/`

3.  **Internet Access**: The first time the script runs, it will download necessary OCR training data (approx. 10-20MB) from the Tesseract.js data repository.

## Execution

You can run the script using the npm shortcut:

```bash
# Force production environment if not already set
cross-env NODE_ENV=production npm run brands:ocr
```

Or, if your environment is already configured for production:

```bash
npm run brands:ocr
```

## How it Works

1.  **Scanning**: The script scans the `public/images/brands` folder for `.png`, `.jpg`, `.jpeg`, and `.webp` files.
2.  **OCR Processing**: It uses `tesseract.js` to attempt to read the text directly from the logo images.
3.  **Data Cleaning**: It sanitizes the extracted text, removes noise, and generates a URL-friendly slug.
4.  **Database Upsert**: It inserts or updates records in the `brands` database table, setting the `logo_url` and marking the brand as active.
5.  **Fallback**: If OCR quality is too low to produce a valid name, the script falls back to using the filename (without extension) as the brand name.

## Troubleshooting

- **Database Errors**: Ensure the database user has permissions to `INSERT` and `UPDATE` the `brands` table.
- **Empty Names**: If logos are primarily graphical with no text, the script will use the filename. Rename your files to the brand name before running if OCR is struggling.
- **File Not Found**: Ensure the script is run from the project root directory.
