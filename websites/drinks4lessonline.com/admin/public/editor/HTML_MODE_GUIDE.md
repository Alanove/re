# HTML Source Mode Guide

## Overview
The Quill editor now supports an unrestricted HTML mode that allows you to paste and edit any HTML content without sanitization restrictions.

## How to Use

### 1. Access HTML Source Mode
- In the page editor, look for the **HTML** button in the toolbar
- Click the **HTML** button to switch to HTML Source Mode
- The editor will switch to a plain textarea where you can paste any HTML

### 2. Paste HTML Content
- In HTML Source Mode, you can paste any HTML content directly
- All HTML elements, attributes, and styles will be preserved
- No sanitization or filtering is applied

### 3. Switch Back to Rich Text
- Click the **Rich** button to switch back to the visual editor
- Your HTML content will be preserved and displayed

### 4. Save Your Content
- The HTML content is automatically saved when you submit the form
- Both modes (Rich Text and HTML Source) will save the same content

## Example Usage

### Pasting Complex HTML
You can paste complex HTML like this:

```html
<div class="diagram">
    <div class="cloud-services">
        <div class="cloud">Private Cloud (USA)</div>
        <div class="cloud main">Internet</div>
    </div>
    <div class="offices">
        <div class="office">
            <div class="office-icon"></div>
            <span>Cairo Office</span>
        </div>
    </div>
</div>
```

### Including CSS and JavaScript
You can also include inline styles and scripts:

```html
<div style="background: linear-gradient(45deg, #ff6b6b, #4ecdc4); padding: 20px;">
    <h2 style="color: white;">Custom Styled Content</h2>
    <script>
        console.log('Custom JavaScript');
    </script>
</div>
```

## Features

- ✅ **Unrestricted HTML**: Paste any HTML without sanitization
- ✅ **Preserve Attributes**: All HTML attributes are maintained
- ✅ **CSS Support**: Inline styles and classes are preserved
- ✅ **JavaScript Support**: Script tags are allowed
- ✅ **Dual Mode**: Switch between Rich Text and HTML Source
- ✅ **Auto-save**: Content is automatically saved
- ✅ **Dark Theme**: Supports both light and dark themes

## Security Note
This mode allows unrestricted HTML, which means:
- All HTML elements are allowed
- All attributes are preserved
- Script tags are not filtered
- Use with caution in public-facing content

## Troubleshooting

### Content Not Saving
- Make sure you're in the correct mode when saving
- Check that the form is properly submitted
- Verify the content in the hidden textarea

### HTML Not Displaying
- Switch to HTML Source Mode to see the raw HTML
- Check for syntax errors in your HTML
- Ensure all tags are properly closed

### Switching Between Modes
- Use the HTML/Rich buttons in the toolbar
- Content is automatically synced between modes
- Changes are preserved when switching

## Support
If you encounter any issues with the HTML Source Mode, please check:
1. Browser console for JavaScript errors
2. Network tab for any failed requests
3. That you're using a modern browser
