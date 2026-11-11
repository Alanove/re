# Video Slider Feature Documentation

## Overview
This document describes the video slider feature added to the Santa Maria Bouar CMS. The slider now supports both images and videos, allowing administrators to upload video content that plays directly in the homepage slider.

## Date: October 10, 2025

## Database Changes

### Migration: `2025-10-10-add-video-support-to-slider.sql`

Added two new columns to the `slider` table:

1. **`media_type`** (VARCHAR(20), default: 'image')
   - Indicates whether the slide is an image or video
   - Possible values: 'image', 'video'
   - Includes an index for better query performance

2. **`video_url`** (VARCHAR(500), nullable)
   - Stores the video file path for video slides
   - Null for image slides

### Rollback Instructions
```sql
ALTER TABLE slider DROP COLUMN media_type;
ALTER TABLE slider DROP COLUMN video_url;
DROP INDEX idx_media_type ON slider;
```

## Backend Changes

### 1. StorageService (`admin/services/storageService.ts`)
- Updated `createSliderUploadConfig()` to accept video files
- Increased file size limit from 10MB to 100MB to accommodate videos
- Added support for video MIME types:
  - video/mp4
  - video/webm
  - video/ogg
  - video/quicktime (MOV)

### 2. SliderService (`admin/services/sliderService.ts`)
- Updated `Slide` interface to include:
  - `mediaType?: 'image' | 'video'`
  - `videoUrl?: string`
- Modified all SQL queries to include media_type and video_url fields
- Updated `addSlide()` and `updateSlide()` methods to handle video data

### 3. SliderController (`admin/controllers/sliderController.ts`)
- Updated `createSlidePost()` to detect file type (image/video) based on MIME type
- Modified `editSlidePost()` to handle video uploads and properly update media_type
- When switching from video to image, the videoUrl is cleared

## Admin Interface Changes

### 1. Edit Slide Form (`admin/views/slider/edit-slide.ejs`)
- Updated file input to accept both images and videos: `accept="image/*,video/*"`
- Added video preview support in the preview panel
- Updated help text to indicate both image and video specifications:
  - Images: Max 10MB, recommended 1920x1080
  - Videos: Max 100MB, formats: MP4, WebM, OGG

### 2. Slider List (`admin/views/slider/slider.ejs`)
- Added "Type" column to display media type (Image/Video)
- Video thumbnails display with a play icon overlay
- Badge indicators show media type:
  - Blue badge with video icon for videos
  - Gray badge with image icon for images

## Public Frontend Changes

### 1. Homepage View (`views/index.ejs`)
- Updated slide markup to render video elements for video slides
- Video attributes:
  - `autoplay`: Videos play automatically
  - `muted`: Required for autoplay to work in most browsers
  - `loop`: Videos loop continuously
  - `playsinline`: Ensures proper playback on mobile devices
  - `preload`: Set to "auto" for first slide, "metadata" for others

### 2. CSS Styles (`public/css/slideshow.scss`)
- Added `.slide-video` class with proper sizing and transitions
- Video slides use opacity transitions instead of WebGL effects
- Videos are positioned absolutely and fill the container
- Smooth fade-in/out transitions for video slides

### 3. JavaScript (`public/js/slideshow.js`)
- Updated `goToSlide()` method to detect video slides
- Added `playVideo()` method to start video playback
- Added `pauseVideo()` method to pause and reset videos
- Video slides skip WebGL processing (only applied to images)
- Automatic video playback when slide becomes active
- Video pausing when slide transitions away

## Usage Instructions

### For Administrators

1. **Upload a Video Slide**:
   - Go to Admin → Slider
   - Click "Add New Slide"
   - Fill in the slide information (title, description, etc.)
   - Click "Choose File" and select a video file (MP4, WebM, or OGG)
   - Add any overlay text, link, and button text as needed
   - Click "Create Slide"

2. **Edit Existing Slide**:
   - Go to Admin → Slider
   - Click the edit icon on any slide
   - Upload a new video to replace an image (or vice versa)
   - The system automatically detects the media type

3. **Supported Video Formats**:
   - MP4 (recommended for best browser compatibility)
   - WebM
   - OGG
   - MOV/QuickTime

4. **File Size Limits**:
   - Videos: Up to 100MB
   - Images: Up to 10MB

### Best Practices

1. **Video Optimization**:
   - Use H.264 codec for MP4 files for best compatibility
   - Recommended resolution: 1920x1080 (Full HD)
   - Keep video file sizes as small as possible for faster loading
   - Videos should be 5-15 seconds for optimal user experience

2. **Accessibility**:
   - Always provide meaningful alt text/descriptions
   - Videos autoplay muted (users can't control volume)
   - Consider adding important information as overlay text

3. **Performance**:
   - Mix video and image slides for better performance
   - Use video sparingly (1-2 video slides max recommended)
   - Test on mobile devices to ensure smooth playback

## Technical Notes

- Videos autoplay muted due to browser autoplay policies
- Videos are paused and reset when not visible
- WebGL effects only apply to image slides (videos use CSS transitions)
- Videos loop continuously while active
- The slider automatically handles both media types seamlessly

## Browser Compatibility

- Chrome/Edge: Full support
- Firefox: Full support
- Safari: Full support (with playsinline attribute)
- Mobile browsers: Full support with autoplay muted

## Files Modified

1. `data-migration/2025-10-10-add-video-support-to-slider.sql`
2. `admin/services/storageService.ts`
3. `admin/services/sliderService.ts`
4. `admin/controllers/sliderController.ts`
5. `admin/views/slider/edit-slide.ejs`
6. `admin/views/slider/slider.ejs`
7. `views/index.ejs`
8. `public/css/slideshow.scss`
9. `public/js/slideshow.js`

## Testing Checklist

- [x] Database migration runs successfully
- [x] Video upload works in admin
- [x] Video preview displays in admin edit form
- [x] Video thumbnails display in admin slider list
- [x] Videos play automatically on public homepage
- [x] Videos pause when transitioning to other slides
- [x] Mixed image/video slides work correctly
- [x] Mobile compatibility verified
- [x] File size validation works
- [x] Overlay content displays properly on videos

## Future Enhancements

Potential improvements for future versions:

1. Video thumbnail extraction for better admin preview
2. Support for video posters (cover images)
3. Video upload progress indicator
4. Video format conversion/optimization
5. Support for external video URLs (YouTube, Vimeo)
6. Video playback controls option (mute/unmute toggle)

