# Quill Rich Text Editor Implementation

This directory contains the custom implementation of the Quill rich text editor for the Gebco Steel admin panel.

## Files

- `quill.css` - Custom styling for the Quill editor
- `quill.js` - JavaScript initialization and customization
- `README.md` - This documentation file
- `HTML_MODE_GUIDE.md` - Guide for using the unrestricted HTML mode

## Features

### Rich Text Editing
- **Text Formatting**: Bold, italic, underline, strikethrough
- **Headings**: H1-H6 support
- **Lists**: Ordered and unordered lists
- **Alignment**: Left, center, right, justify
- **Colors**: Text and background colors
- **Fonts**: Font family and size selection
- **Links**: URL insertion with validation
- **Images**: Upload and embed images
- **Code**: Inline code and code blocks
- **Quotes**: Blockquote support
- **Indentation**: Increase/decrease indentation
- **Subscript/Superscript**: Text positioning

### Custom Features
- **Word Count**: Real-time word and character counting
- **Auto-save**: Automatic content saving to localStorage
- **Image Upload**: Server-side image upload with progress indication
- **Dark Theme Support**: Automatic theme detection and styling
- **Responsive Design**: Mobile-friendly toolbar and editor
- **Form Integration**: Seamless integration with existing forms
- **HTML Source Mode**: Unrestricted HTML editing with no sanitization

## Usage

### In EJS Templates
The Quill editor is automatically initialized when the `includeQuill` flag is set to `true` in the page data:

```javascript
res.render('pages/edit-page', {
  // ... other data
  includeQuill: true
});
```

### HTML Structure
The editor replaces a textarea with the following structure:

```html
<textarea name="content" style="display: none;">Existing content</textarea>
<div id="quill-editor" style="height: 300px;"></div>
```

### JavaScript API
The editor provides several methods for programmatic control:

```javascript
// Get HTML content
const html = quillEditor.getHTML();

// Set HTML content
quillEditor.setHTML('<p>New content</p>');

// Get plain text
const text = quillEditor.getText();

// Enable/disable editor
quillEditor.enable();
quillEditor.disable();

// Focus the editor
quillEditor.focus();
```

## Configuration

### Toolbar Options
The toolbar includes the following modules:
- Text formatting (bold, italic, underline, strike)
- Headings (H1-H6)
- Text alignment
- Lists (ordered, unordered)
- Text color and background
- Font family and size
- Links and images
- Code blocks and quotes
- Indentation controls
- Subscript/superscript

### Customization
To customize the editor, modify the `getDefaultOptions` method in `quill.js`:

```javascript
getDefaultOptions(customOptions) {
  const defaultOptions = {
    theme: 'snow',
    modules: {
      toolbar: [
        // Customize toolbar here
      ]
    },
    placeholder: 'Enter your content...',
    readOnly: false
  };
  
  return { ...defaultOptions, ...customOptions };
}
```

## Image Upload

### Server Endpoint
Images are uploaded to `/admin/api/upload-image` and stored in `/public/images/quill-uploads/`.

### File Handling
- **Supported formats**: All image types (jpg, png, gif, webp, etc.)
- **File size limit**: 5MB
- **Naming**: Unique filenames with timestamps
- **Storage**: Organized in dedicated quill-uploads directory

### Upload Process
1. User clicks image button in toolbar
2. File picker opens
3. Selected file is uploaded via AJAX
4. Server processes and stores the image
5. Image URL is returned and embedded in editor

## Styling

### CSS Classes
- `.ql-editor` - Main editor container
- `.ql-toolbar` - Toolbar styling
- `.ql-container` - Editor container
- `.ql-word-count` - Word count display

### Theme Support
The editor automatically adapts to light/dark themes using CSS custom properties and data attributes.

### Responsive Design
- Mobile-optimized toolbar
- Flexible editor height
- Touch-friendly controls

## Browser Support

- Chrome 60+
- Firefox 55+
- Safari 12+
- Edge 79+

## Dependencies

- Quill.js 1.3.6 (CDN)
- Express.js (server)
- Multer (file uploads)

## Troubleshooting

### Common Issues

1. **Editor not loading**: Check if Quill library is loaded before custom script
2. **Image upload fails**: Verify server endpoint and file permissions
3. **Styling issues**: Ensure custom CSS is loaded after Quill's CSS
4. **Form submission**: Content is automatically synced to hidden textarea

### Debug Mode
Enable console logging by setting `console.log` statements in the JavaScript file.

## HTML Source Mode

The editor includes an unrestricted HTML mode that allows users to paste and edit any HTML content without sanitization restrictions.

### Features
- **Unrestricted HTML**: Paste any HTML without sanitization
- **Dual Mode**: Switch between Rich Text and HTML Source views
- **Preserve All Elements**: All HTML elements, attributes, and styles are maintained
- **Auto-sync**: Content is automatically synced between modes
- **Dark Theme Support**: HTML source view supports both light and dark themes

### Usage
1. Click the **HTML** button in the toolbar to switch to HTML Source Mode
2. Paste any HTML content directly into the textarea
3. Click the **Rich** button to switch back to visual editing
4. Content is automatically saved when the form is submitted

For detailed instructions, see `HTML_MODE_GUIDE.md`.

## Future Enhancements

- **Spell Check**: Integration with browser spell check
- **Auto-complete**: Smart text suggestions
- **Collaboration**: Real-time collaborative editing
- **Version History**: Content versioning and rollback
- **Export Options**: PDF, Word document export
- **Custom Blocks**: Custom content blocks and templates 