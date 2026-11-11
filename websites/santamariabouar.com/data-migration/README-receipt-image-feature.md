# Receipt Image Upload Feature for Transactions

## Overview
Added the ability to upload receipt images to transactions. Users can now attach an image or PDF of the receipt when creating or editing a transaction.

## Database Changes

### Migration Script
**File:** `data-migration/2025-10-09-add-receipt-image-to-transactions.sql`

**What it does:**
- Adds a `receipt_image` column to the `transactions` table (VARCHAR(500), nullable)
- Creates an index on the `receipt_image` column for better query performance

**To run the migration:**
```bash
mysql -u root -p santamariabouar < data-migration/2025-10-09-add-receipt-image-to-transactions.sql
```

Or manually in MySQL:
```sql
ALTER TABLE transactions 
ADD COLUMN receipt_image VARCHAR(500) NULL AFTER receipt_generated;

CREATE INDEX idx_receipt_image ON transactions(receipt_image);
```

**Rollback (if needed):**
```sql
ALTER TABLE transactions DROP COLUMN receipt_image;
DROP INDEX idx_receipt_image ON transactions;
```

## Features Implemented

### 1. Upload Directory
- Receipt images are stored in: `public/uploads/receipts/`
- Filename format: `receipt-{timestamp}-{random}.{ext}`
- Maximum file size: 5MB
- Supported formats: JPEG, JPG, PNG, GIF, PDF

### 2. Create Transaction Form
**Location:** `admin/views/transactions/create.ejs`

**Features:**
- Optional file upload field
- Real-time image preview for uploaded images
- PDF placeholder for uploaded PDFs
- File type and size validation

### 3. Edit Transaction Form
**Location:** `admin/views/transactions/edit.ejs`

**Features:**
- View current receipt image (if exists)
- Upload a new receipt to replace existing one
- Delete existing receipt image
- Real-time preview for new uploads
- Click on image/PDF to open in new window

### 4. Transactions List
**Location:** `admin/views/transactions/list.ejs`

**Features:**
- New "Image" column showing receipt thumbnails
- Thumbnail preview (40x40px) for images
- PDF icon button for PDF files
- Click on image/icon opens in new window
- Shows "-" if no receipt image attached

## Technical Implementation

### Backend Changes

1. **Multer Configuration** (`admin/controllers/transactionsController.ts`)
   - Configured storage destination and filename generation
   - File type filtering (images and PDFs only)
   - Size limit enforcement (5MB)
   - Exported `upload` middleware for routes

2. **Routes** (`admin/routes/index.ts`)
   - Updated create route: `transactionUpload.single('receiptImage')`
   - Updated edit route: `transactionUpload.single('receiptImage')`

3. **Controller** (`admin/controllers/transactionsController.ts`)
   - Handles file upload in `createTransactionPost`
   - Handles file replacement/deletion in `editTransactionPost`
   - Stores file path relative to public directory

4. **Service** (`admin/services/transactionsService.ts`)
   - Updated `Transaction` interface to include `receiptImage?: string | null`
   - Updated all SQL queries to include `receipt_image` field
   - Updated `createTransaction` to handle receipt image
   - Updated `updateTransaction` to handle receipt image
   - Updated `CommonExpensePaymentRequest` interface

### Frontend Changes

1. **Form Encoding**
   - Changed forms to use `enctype="multipart/form-data"`
   - Updated JavaScript to use FormData instead of URLSearchParams
   - Removed Content-Type header to allow browser to set multipart boundary

2. **Image Preview**
   - Real-time preview for image files
   - PDF placeholder for PDF files
   - Preview shown before upload

3. **Edit Form Features**
   - Display current receipt with delete option
   - Replace existing receipt with new upload
   - Confirmation dialog for deletion

## Usage

### Creating a Transaction with Receipt
1. Navigate to **Transactions > Create Transaction**
2. Fill in required fields
3. Click **"Choose File"** under "Receipt Image (Optional)"
4. Select an image or PDF file (max 5MB)
5. Preview will appear below the file input
6. Click **"Create Transaction"** to save

### Editing a Transaction's Receipt
1. Navigate to **Transactions** list
2. Click **Edit** button on any transaction
3. View existing receipt (if any)
4. To replace: Click **"Choose File"** and select new file
5. To delete: Click **"Delete Receipt"** button
6. Click **"Update Transaction"** to save changes

### Viewing Receipt Images
**From Transaction List:**
- Click on the thumbnail image to open full size in new window
- Click on the PDF button to open PDF in new window

**From Edit Form:**
- Click on the displayed image/PDF button to open in new window

## File Management

### Storage Location
- Physical path: `public/uploads/receipts/`
- URL path: `/uploads/receipts/{filename}`
- Files are web-accessible

### File Deletion
- When deleting from edit form: File is removed from filesystem
- When replacing with new file: Old file is automatically deleted
- Manual deletion: Remove files from `public/uploads/receipts/` directory

### Backup Considerations
- Include `public/uploads/receipts/` in your backup strategy
- Receipts are not stored in database (only file path)
- Broken links may occur if files are deleted from filesystem

## Security Considerations

1. **File Type Validation**
   - Only accepts: JPEG, JPG, PNG, GIF, PDF
   - Validates both extension and MIME type
   - Rejects all other file types

2. **File Size Limit**
   - Maximum 5MB per file
   - Enforced at middleware level

3. **Filename Sanitization**
   - Generated filenames use timestamp + random number
   - Original filename is not preserved (security)
   - No user input in filename

4. **Access Control**
   - Upload requires authentication
   - Requires Super Admin, Admin, or Accounting role
   - Same permissions as creating/editing transactions

## Troubleshooting

### Upload Directory Not Created
**Solution:** The directory is created automatically when the controller loads. If it fails:
```bash
mkdir -p public/uploads/receipts
chmod 755 public/uploads/receipts
```

### Images Not Displaying
**Check:**
1. File exists in `public/uploads/receipts/`
2. File path in database starts with `/uploads/receipts/`
3. Web server has permission to serve static files from `public/`

### File Upload Fails
**Check:**
1. File size is under 5MB
2. File type is supported (JPEG, PNG, GIF, PDF)
3. Upload directory exists and is writable
4. Multer middleware is properly configured in routes

### Migration Not Applied
**Solution:**
Run the migration manually or check if column already exists:
```sql
SHOW COLUMNS FROM transactions LIKE 'receipt_image';
```

## Future Enhancements (Optional)

1. **Image Optimization**
   - Compress images on upload
   - Generate thumbnails automatically
   - Convert to WebP format

2. **Multiple Images**
   - Allow multiple receipt images per transaction
   - Image gallery view

3. **Cloud Storage**
   - Store receipts in S3/Azure/GCS
   - CDN integration

4. **OCR Integration**
   - Extract transaction details from receipt
   - Auto-fill amount, date, description

5. **Receipt Gallery**
   - View all receipts in a gallery
   - Filter/search receipts
   - Bulk download

## Notes

- The receipt image feature is **optional** - transactions can be created without uploading a receipt
- Existing transactions are not affected - they simply won't have a receipt image
- The feature integrates seamlessly with both regular transactions and common expense payments
- Receipt images are separate from the auto-generated receipt PDFs (which are dynamically generated)

