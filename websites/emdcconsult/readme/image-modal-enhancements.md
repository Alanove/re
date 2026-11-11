# Image Modal Enhancements

This document describes the enhancements made to the custom editor's image modal functionality.

## Overview

The image modal has been significantly enhanced to provide a better user experience with improved workflow and additional features.

## New Features

### 1. Enhanced Form Layout
- **CSS Class Name Field**: Added a new field for specifying CSS classes for images
- **Align Dropdown**: Added a dropdown field with options for Left, Center, Right, and Default alignment
- **Width and Height on Same Row**: Reorganized the form layout to display width and height fields side by side for better space utilization

### 2. Improved Image Selection Workflow
- **Click to Populate URL**: When clicking on an image in the list, the image URL is now populated in the "Image URL" field instead of being directly inserted into the editor
- **Manual Insertion**: Users must click the "Insert" button to actually insert the image, giving them control over the insertion process

### 3. Enhanced Upload Functionality
- **URL Population**: After uploading an image, the URL is automatically populated in the "Image URL" field
- **Image List Refresh**: The upload process automatically refreshes the image list to show the newly uploaded image
- **Manual Insertion**: Users still need to click "Insert" to add the uploaded image to the editor

### 4. Image Editing Capability
- **Double-Click to Edit**: Users can now double-click on any image in the editor to open the modal in edit mode
- **Prefilled Form**: The modal opens with all the image's current properties (URL, alt text, class, width, height, align) pre-filled
- **Update Button**: The modal shows an "Update" button instead of "Insert" when in edit mode
- **Dynamic Updates**: The selected image is updated in place, even if the source URL is changed

## Technical Implementation

### Modified Methods

#### `createImageModal(savedRange, editMode = false, existingImage = null)`
- Added support for edit mode with prefilled form data
- Reorganized form layout with width/height on same row
- Added CSS class name field
- Updated button text based on mode (Insert/Update)

#### `showImageEditModal(imageElement)`
- New method to handle double-click events on images
- Opens the modal in edit mode with the selected image's data

#### `updateImageInEditor(existingImage, url, alt, className, width, height, align)`
- New method to update existing images in the editor
- Modifies the image element's properties directly including alignment

#### `uploadImage(file, modal, savedRange, editMode = false, existingImage = null)`
- Updated to populate URL field instead of inserting directly
- Added image list refresh functionality
- Added support for edit mode

### Event Handlers

#### Double-Click Handler
```javascript
this.richTextEditor.addEventListener('dblclick', (e) => {
    if (e.target.tagName === 'IMG') {
        e.preventDefault();
        e.stopPropagation();
        this.showImageEditModal(e.target);
    }
});
```

#### Image Card Click Handler
```javascript
card.addEventListener('click', () => {
    const modal = document.querySelector('.custom-editor-modal');
    if (modal) {
        const urlInput = modal.querySelector('#imageUrl');
        if (urlInput) {
            urlInput.value = image.url;
        }
    }
});
```

## User Workflow

### Inserting Images
1. Click the image button in the toolbar
2. Modal opens with form fields
3. Either:
   - Click on an image in the list to populate the URL field
   - Upload a new image (URL field gets populated automatically)
   - Manually enter an image URL
4. Fill in other fields (alt text, class, width, height, align)
5. Click "Insert" to add the image to the editor

### Editing Images
1. Double-click on any image in the editor
2. Modal opens with all current image properties pre-filled
3. Modify any properties as needed
4. Click "Update" to apply changes

## Benefits

1. **Better Control**: Users have full control over when images are inserted
2. **Improved UX**: More intuitive workflow with clear separation between selection and insertion
3. **Enhanced Editing**: Easy editing of existing images without manual property copying
4. **Consistent Interface**: Unified modal for both inserting and editing images
5. **Real-time Updates**: Image list refreshes automatically after uploads

## Testing

A test file `test-image-modal.html` has been created to verify all functionality:
- Image modal opening
- Image selection and URL population
- Upload functionality
- Double-click editing
- Form validation and submission

## Compatibility

All changes are backward compatible and don't affect existing functionality. The enhanced modal provides additional features while maintaining the same core behavior.
