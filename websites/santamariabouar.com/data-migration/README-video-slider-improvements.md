# Video Slider Feature Improvements Documentation

## Overview
This document describes the improvements made to the video slider feature, specifically addressing file size validation and separate image/video upload fields.

## Date: October 10, 2025

## Issues Addressed

1. **File Upload Error Handling**: Files that exceeded size limits caused a `MulterError` without user-friendly feedback
2. **Single Upload Field**: Previous implementation had only one upload field that accepted both images and videos
3. **Missing Poster Image Support**: Videos didn't have a way to specify a separate poster/fallback image

## Database Changes

### Migration: `2025-10-10-add-poster-image-to-slider.sql`

Added one new column to the `slider` table:

**`poster_image`** (VARCHAR(500), nullable)
- Stores the poster/fallback image for video slides
- Displayed before video loads or when video fails to load
- Null for image-only slides

### Rollback Instructions
```sql
ALTER TABLE slider DROP COLUMN poster_image;
```

## Backend Improvements

### 1. SliderController (`admin/controllers/sliderController.ts`)

**Added Error Handling Middleware:**
```typescript
public static handleSliderUpload(req: Request, res: Response, next: NextFunction): void
```

Features:
- Catches Multer errors before they reach the route handler
- Provides user-friendly error messages based on error codes:
  - `LIMIT_FILE_SIZE`: Shows specific size limits (10MB for images, 100MB for videos)
  - `LIMIT_UNEXPECTED_FILE`: Indicates incorrect file field usage
  - Generic errors: Shows the error message
- Redirects back to the form with error parameter
- Works for both create and edit operations

**Updated File Handling:**
- Now uses `upload.fields()` to handle separate image and video uploads
- Supports three upload scenarios:
  1. **Image Only**: Creates an image slide
  2. **Video Only**: Creates a video slide (uses video as image field for backward compatibility)
  3. **Image + Video**: Creates a video slide with the image as poster

**Validation Logic:**
- Requires at least one file (image or video) for new slides
- Properly determines media type based on which files are uploaded
- Sets `posterImage` when both files are provided

### 2. SliderService (`admin/services/sliderService.ts`)

**Updated Interface:**
```typescript
export interface Slide {
  id: string;
  image: string;
  alt: string;
  order: number;
  active: boolean;
  title?: string;
  link?: string;
  buttonText?: string;
  mediaType?: 'image' | 'video';
  videoUrl?: string;
  posterImage?: string;  // NEW
}
```

**Updated Methods:**
- All SQL queries now include `poster_image` field
- `addSlide()` accepts `posterImage` parameter
- `updateSlide()` handles `posterImage` updates

### 3. Routes (`admin/routes/index.ts`)

Changed from:
```typescript
sliderUpload.single('image')
```

To:
```typescript
SliderController.handleSliderUpload
```

This provides:
- Better error handling
- Support for multiple file fields
- Consistent error messages

## Admin Interface Improvements

### 1. Edit Slide Form (`admin/views/slider/edit-slide.ejs`)

**Separate Upload Fields:**

```html
<!-- Image Field -->
<input type="file" id="image" name="image" accept="image/*" />

<!-- Video Field -->
<input type="file" id="video" name="video" accept="video/*" />
```

**Benefits:**
- Clear separation between image and video uploads
- Specific file type restrictions per field
- Clear labeling with size limits and format support
- Helpful notes explaining poster image functionality

**Client-Side Validation:**
- Validates that at least one file is uploaded for new slides
- Separate preview handlers for image and video
- Link field validation still enforced

**Error Display:**
- Friendly error messages displayed at the top of the form
- Validation errors shown in Bootstrap modals
- Real-time preview of uploaded media

### 2. File Size Validation

**User-Friendly Messages:**
- Instead of raw Multer errors, users see:
  > "File is too large. Maximum size: 10MB for images, 100MB for videos"

**Validation Happens:**
1. Server-side (Multer configuration)
2. Caught by middleware
3. Displayed as query parameter
4. Shown in alert at top of form

## Public Frontend Improvements

### 1. Homepage View (`views/index.ejs`)

**Video Poster Support:**
```html
<video poster="/images/slide/[posterImage]">
  <source src="/images/slide/[videoUrl]" />
  <!-- Fallback image -->
  <img src="/images/slide/[posterImage]" />
</video>
```

**Benefits:**
- Shows poster image while video loads
- Provides fallback if video fails to play
- Better user experience, especially on slow connections
- SEO benefits from having an image fallback

## Usage Guide

### For Administrators

#### Creating a Video Slide with Poster Image

1. Go to Admin → Slider → Add New Slide
2. Fill in the slide information (title, alt text, etc.)
3. **Upload Image**: Select a poster image (shows before video loads)
4. **Upload Video**: Select a video file
5. Click "Create Slide"

The system will:
- Use the video for playback
- Use the image as the poster
- Fall back to the image if video fails

#### Creating an Image-Only Slide

1. Go to Admin → Slider → Add New Slide
2. Fill in the slide information
3. **Upload Image**: Select an image
4. Leave video field empty
5. Click "Create Slide"

#### Creating a Video-Only Slide

1. Go to Admin → Slider → Add New Slide
2. Fill in the slide information
3. Leave image field empty
4. **Upload Video**: Select a video
5. Click "Create Slide"

Note: The video will be used as both the video and the image field (for backward compatibility)

### Error Handling

**File Too Large:**
```
❌ File is too large. Maximum size: 10MB for images, 100MB for videos
```
**Solution**: Compress your file or use a smaller file

**No Files Uploaded:**
```
❌ Please upload at least an image or video
```
**Solution**: Select at least one file before submitting

**Wrong File Type:**
```
❌ Only image files (JPEG, PNG, GIF, WebP) and video files (MP4, WebM, OGG, MOV) are allowed
```
**Solution**: Convert your file to a supported format

## Technical Implementation

### File Upload Flow

1. User submits form with files
2. `handleSliderUpload` middleware processes the request
3. If error occurs:
   - Error is caught
   - User-friendly message is generated
   - User is redirected with error message
4. If successful:
   - Files are saved to `/public/images/slide/`
   - Request continues to controller
5. Controller determines media type:
   - Video file present → `mediaType = 'video'`
   - Only image present → `mediaType = 'image'`
6. Controller saves to database:
   - `image_url`: Image filename (or video if no image)
   - `video_url`: Video filename (if video uploaded)
   - `poster_image`: Image filename (if both uploaded)
   - `media_type`: 'image' or 'video'

### Database Schema

```sql
CREATE TABLE slider (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(500),
  subtitle VARCHAR(500),
  description TEXT,
  image_url VARCHAR(500) NOT NULL,      -- Image or fallback
  link_url VARCHAR(500),
  link_text VARCHAR(255),
  order_index INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  media_type VARCHAR(20) DEFAULT 'image', -- 'image' or 'video'
  video_url VARCHAR(500) NULL,            -- Video file path
  poster_image VARCHAR(500) NULL,         -- Poster/fallback image
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

## Best Practices

### Image Specifications
- **Format**: JPEG, PNG, WebP (JPEG recommended for photos)
- **Size**: Up to 10MB
- **Dimensions**: 1920x1080 recommended (16:9 aspect ratio)
- **Optimization**: Compress images before upload for best performance

### Video Specifications
- **Format**: MP4 (H.264 codec recommended), WebM, OGG
- **Size**: Up to 100MB
- **Dimensions**: 1920x1080 recommended (Full HD)
- **Duration**: 5-15 seconds for optimal user experience
- **Optimization**: Use video compression tools before upload

### Poster Image Best Practices
- Use a representative frame from the video
- Ensure the poster matches the video's aspect ratio
- Optimize the poster image (should be smaller than 1MB)
- Consider using a branded or captioned poster for better engagement

## Browser Compatibility

- ✅ Chrome/Edge: Full support for all features
- ✅ Firefox: Full support for all features
- ✅ Safari: Full support (poster images work perfectly)
- ✅ Mobile browsers: Full support with poster images

## Files Modified

1. `data-migration/2025-10-10-add-poster-image-to-slider.sql` (NEW)
2. `admin/controllers/sliderController.ts` (UPDATED)
3. `admin/services/sliderService.ts` (UPDATED)
4. `admin/routes/index.ts` (UPDATED)
5. `admin/views/slider/edit-slide.ejs` (UPDATED)
6. `views/index.ejs` (UPDATED)

## Testing Checklist

- [x] File size validation displays user-friendly messages
- [x] Image-only slides work correctly
- [x] Video-only slides work correctly
- [x] Image + Video slides use image as poster
- [x] Poster images display before video loads
- [x] Fallback images work when video fails
- [x] Error messages are clear and helpful
- [x] Separate upload fields work as expected
- [x] Edit functionality preserves existing files
- [x] Mobile compatibility verified

## Summary

These improvements provide:
1. **Better User Experience**: Clear error messages instead of cryptic errors
2. **More Control**: Separate fields for image and video uploads
3. **Better Performance**: Poster images improve perceived load time
4. **Reliability**: Fallback images when videos fail to load
5. **Flexibility**: Three upload scenarios (image, video, or both)

The slider feature is now more robust, user-friendly, and provides better control over video content presentation.

