# Enhanced Menu Background System

## Overview

The Enhanced Menu Background System creates a dynamic, visually appealing fullscreen menu with an extremely faded slideshow background and rotating geometric mask overlay. This system integrates seamlessly with the existing WebGL slideshow to provide a cohesive visual experience.

## Features

### Core Functionality
- **Dynamic Background**: Automatically updates menu background to match the current slideshow image
- **Enhanced Visibility**: Background opacity set to 0.15 (15%) for clearly visible effect while maintaining readability
- **Rotating Mask**: Animated geometric patterns that rotate slowly over the background
- **Smooth Transitions**: 0.8s transition between different slideshow backgrounds
- **Performance Optimized**: Slideshow pauses when menu is open, throttled updates and image preloading
- **Clean Interface**: No background surrounding the menu list for a minimalist look

### Visual Effects
1. **Basic Rotating Mask**: Subtle conic and radial gradients that rotate every 60 seconds
2. **Enhanced Mask** (Optional): More complex multi-layered patterns with pulsing animation
3. **Backdrop Blur**: Optional backdrop-filter for enhanced menu content visibility
4. **Responsive Design**: Works seamlessly across all device sizes

## Technical Implementation

### Files Modified
```
public/js/slideshow.js          # Added callback system for slide changes
public/script.js                # Menu background integration logic
public/css/menu.scss           # Enhanced menu styling with rotating masks
views/partials/menu.ejs        # Existing menu structure (unchanged)
```

### CSS Classes
- `.fullscreen-menu`: Base menu container with background system
- `.enhanced-mask`: Optional advanced mask effects
- `.menu-bg-{index}`: Dynamic classes for specific slide backgrounds

### JavaScript API
```javascript
// Access the menu background system
window.slideshowInstance.addSlideChangeCallback(callback);
window.slideshowInstance.getCurrentSlideData();

// Slideshow control for performance
window.slideshowInstance.pauseSlideshow();
window.slideshowInstance.resumeSlideshow();
window.slideshowInstance.isPausedState();

// Enable/disable enhanced mask
enableEnhancedMask();
disableEnhancedMask();
```

## Configuration Options

### Background Opacity
```scss
// In menu.scss - adjust background visibility
&::before {
  opacity: 0.15; // Current value (0.05 - 0.25 recommended range)
}

// Also adjust the main menu background
background: rgba(0, 0, 0, 0.7); // Reduced to show background better
```

### Rotation Speed
```scss
// Adjust mask rotation speed
animation: menu-mask-rotate 60s linear infinite; // Change 60s to desired speed
```

### Enhanced Mask Toggle
```javascript
// Auto-enable enhanced mask (in script.js)
setTimeout(enableEnhancedMask, 1000); // Comment out to disable by default
```

### Performance Settings
```javascript
// Throttle background updates (in script.js)
const UPDATE_THROTTLE = 300; // Minimum time between updates in ms
```

## Usage Instructions

### Basic Setup
The enhanced menu background system is automatically initialized when the page loads. No additional setup is required.

### Customization
1. **Adjust Background Opacity**: Modify the `opacity` value in the `.fullscreen-menu::before` selector
2. **Change Rotation Speed**: Adjust the animation duration in the `menu-mask-rotate` animation
3. **Toggle Enhanced Effects**: Call `enableEnhancedMask()` or `disableEnhancedMask()` in the browser console or add to your page scripts

### Performance Considerations
- Background updates are throttled to prevent excessive DOM manipulation
- Images are preloaded before applying to ensure smooth transitions
- Enhanced mask can be disabled on lower-performance devices

## Browser Compatibility

### Supported Features
- **CSS Transforms**: All modern browsers
- **Conic Gradients**: Chrome 69+, Firefox 83+, Safari 12.1+
- **Backdrop Filter**: Chrome 76+, Firefox 103+, Safari 9+

### Fallbacks
- Basic gradients fall back to simpler patterns on older browsers
- System gracefully degrades without breaking functionality

## Troubleshooting

### Common Issues

1. **Background Not Updating**
   - Check console for slideshow initialization messages
   - Ensure slideshow images are loading correctly
   - Verify callback registration with `window.slideshowInstance`

2. **Performance Issues**
   - Increase `UPDATE_THROTTLE` value
   - Disable enhanced mask with `disableEnhancedMask()`
   - Check for console errors

3. **Mask Not Rotating**
   - Verify CSS animations are supported
   - Check for CSS syntax errors in browser developer tools
   - Ensure the menu has the correct classes applied

### Debug Console Commands
```javascript
// Check slideshow status
console.log(window.slideshowInstance.getCurrentSlideData());

// Manually update background
updateMenuBackground(window.slideshowInstance.getCurrentSlideData());

// Toggle enhanced effects
enableEnhancedMask();  // or disableEnhancedMask();
```

## Future Enhancements

### Planned Features
- Admin panel controls for opacity and rotation speed
- Multiple mask pattern options
- WebGL-based particle effects for premium visual experience
- Touch gesture controls for mask manipulation
- Automatic performance detection and optimization

### Integration Options
- Theme-based mask patterns
- Color temperature matching with slideshow
- Seasonal or project-specific background effects
- User preference storage for enhanced features

## Security Considerations

- Dynamic CSS generation is sanitized and scoped
- Image URLs are validated before loading
- No external resources loaded without user consent
- Performance monitoring prevents resource exhaustion

---

*This system enhances the user experience while maintaining the professional aesthetic of the EMDC website. The extremely subtle background ensures menu readability while the rotating masks add visual interest without distraction.*
