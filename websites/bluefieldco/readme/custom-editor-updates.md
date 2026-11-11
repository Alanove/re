# Custom Editor Updates

## Overview
The custom editor has been enhanced with improved image upload functionality and a new image management panel.

## Key Changes

### 1. Image Upload Path Changes
- **Before**: When no page key was found, images uploaded to `public/pages/generic-uploads`
- **After**: When no page key is found, images now upload to `public/images/generic`

### 2. New Image Management Panel
A right column has been added to the custom editor that provides:
- **Current Page Images**: Shows images specific to the current page
- **Public Images**: Shows images from various public directories
- **Toggle Functionality**: Switch between page images and public images
- **Click to Insert**: Click on any image in the panel to insert it into the editor

## Technical Implementation

### Backend Changes

#### 1. Modified Upload Endpoint (`admin/controllers/pagesController.ts`)
- Updated `uploadImage` method to handle generic uploads
- Added logic to save images to `public/images/generic` when no page key is provided
- Added proper error handling and file validation

#### 2. New API Endpoints
- `GET /admin/api/page-images` - Get images for a specific page
- `GET /admin/api/public-images` - Get images from public directories

#### 3. New Routes (`admin/routes/index.ts`)
- Added routes for the new image management API endpoints

### Frontend Changes

#### 1. Enhanced Custom Editor (`admin/public/editor/custom-editor.js`)
- Added image panel functionality with toggle between page and public images
- Improved layout with flexbox design
- Added image card components with hover effects
- Enhanced upload functionality to handle generic uploads

#### 2. Updated CSS (`admin/public/css/custom.css`)
- Added styles for the image panel
- Responsive design for different screen sizes
- Hover effects and transitions for better UX

## Features

### Image Panel Features
1. **Page Images View**: Shows images uploaded specifically for the current page
2. **Public Images View**: Shows images from:
   - `public/images/` (main images directory)
   - `public/images/generic/` (generic uploads)
   - `public/images/slide/` (slider images)
3. **Image Information**: Displays image name, size, and modification date
4. **Click to Insert**: Click any image to insert it into the editor at cursor position

### Upload Features
1. **Smart Path Detection**: Automatically detects page key from URL, form data, or generates one
2. **Generic Upload**: When no page key is found, uploads to `public/images/generic`
3. **Page-Specific Upload**: When page key is found, uploads to page-specific directory
4. **Error Handling**: Proper error messages and loading states

### Editor Features
1. **Rich Text Mode**: Full formatting toolbar with active state tracking
2. **Source Mode**: Raw HTML editing capability
3. **Word Count**: Real-time word and character counting
4. **Image Insertion**: Multiple ways to insert images (upload, panel, URL)

## Usage

### Testing the Editor
1. Navigate to `/admin/public/editor/test-editor.html` to test the functionality
2. Try uploading images with and without a page key
3. Test the image panel toggle functionality
4. Verify image insertion from the panel

### In Production
The custom editor automatically initializes on pages with a `textarea[name="content"]` element and includes the custom editor script.

## File Structure
```
admin/
├── controllers/
│   └── pagesController.ts          # Updated with new upload logic and API endpoints
├── routes/
│   └── index.ts                    # Added new image management routes
├── public/
│   ├── css/
│   │   └── custom.css              # Added custom editor styles
│   └── editor/
│       ├── custom-editor.js        # Enhanced with image panel
│       └── test-editor.html        # Test page for functionality
└── services/
    └── storageService.ts           # Existing service used for file operations
```

## API Endpoints

### Upload Image
- **URL**: `POST /admin/api/upload-image`
- **Body**: FormData with `image` file and optional `pageKey`
- **Response**: JSON with success status and image URL

### Get Page Images
- **URL**: `GET /admin/api/page-images?pageKey={pageKey}`
- **Response**: JSON with array of image objects

### Get Public Images
- **URL**: `GET /admin/api/public-images`
- **Response**: JSON with array of image objects from public directories

## Image Object Structure
```json
{
  "name": "image.jpg",
  "url": "/images/generic/image.jpg",
  "size": 12345,
  "modified": "2024-01-01T00:00:00.000Z",
  "path": "/absolute/path/to/image.jpg"
}
```

## Browser Compatibility
- Modern browsers with ES6+ support
- Responsive design for mobile and desktop
- Graceful degradation for older browsers

## Future Enhancements
- Image search and filtering
- Image categories and tags
- Bulk image operations
- Image optimization and resizing
- Drag and drop image upload
