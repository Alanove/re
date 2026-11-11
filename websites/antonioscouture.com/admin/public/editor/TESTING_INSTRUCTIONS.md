# Testing HTML Source Mode

## Quick Test Steps

1. **Start the server** (if not already running):
   ```bash
   npm start
   ```

2. **Open the test page**:
   - Go to: `http://localhost:3000/admin/editor/test-html-mode.html`
   - Or go to: `http://localhost:3000/admin/pages/create`

3. **Check for the HTML button**:
   - Look for a button labeled "HTML" in the toolbar
   - It should be visible in the toolbar with other formatting buttons

4. **Test the functionality**:
   - Click the "HTML" button
   - The editor should switch to a textarea
   - Paste any HTML content
   - Click "Rich" to switch back

## Debug Information

### Console Logs to Look For:
- "Adding view source button..."
- "Adding view source button to toolbar: [element]"
- "Found formats container, adding button" or "No formats container found, adding to toolbar directly"
- "View source button added successfully"
- "HTML button clicked" (when you click the button)
- "toggleSourceView called"
- "Switching to HTML source view"

### If the HTML Button is Missing:
1. Check the browser console for errors
2. Look for the debug information in the test page
3. Check if the toolbar is loading properly

### If the Button is There But Not Working:
1. Check if clicking it produces console logs
2. Verify the CSS is loading properly
3. Check for JavaScript errors

## Common Issues

### Button Not Visible:
- CSS not loading
- Toolbar not initialized properly
- Button added to wrong container

### Button Click Not Working:
- Event listener not attached
- JavaScript errors preventing execution
- Method not found

### HTML Not Preserved:
- Quill sanitization still active
- Content not syncing between modes
- Form submission not handling source view

## Manual Fix

If the button is not appearing automatically, the test page includes a fallback that will manually add the button after 1 second.

## Browser Compatibility

Test in:
- Chrome (recommended)
- Firefox
- Safari
- Edge

## File Locations

- Main Quill file: `admin/public/editor/quill.js`
- CSS file: `admin/public/editor/quill.css`
- Test page: `admin/public/editor/test-html-mode.html`
- This guide: `admin/public/editor/TESTING_INSTRUCTIONS.md`
