# JavaScript Modular Architecture

This project now uses a modular JavaScript architecture that combines the benefits of organized development with the simplicity of a single production file.

## File Structure

```
public/
├── js/                          # Individual modules for development
│   ├── menu.js                 # Menu functionality
│   ├── worldmap.js             # World map functionality  
│   ├── fancybox-manager.js     # Image gallery management
│   ├── parallax.js             # Parallax scroll effects
│   ├── slideshow.js            # WebGL slideshow (existing)
│   └── reveal-animation.js     # Reveal animations (existing)
├── script.js                   # Combined/built file for production
└── ...
```

## Development Workflow

### 1. Modular Development
Edit individual files in the `public/js/` directory:

- **`menu.js`** - All menu-related functionality (burger menu, dropdowns, mobile filters)
- **`worldmap.js`** - Interactive world map with project locations
- **`fancybox-manager.js`** - Image gallery management and configuration
- **`parallax.js`** - Smooth parallax scroll effects

### 2. Building for Production

#### Build once:
```bash
npm run js:build
# or
node build-script.js
```

#### Build and watch for changes:
```bash
npm run js:watch  
# or
node build-script.js --watch
```

### 3. Available Classes

#### Menu Class
```javascript
const menuInstance = new Menu();
menuInstance.init();              // Initialize all menu functionality
menuInstance.toggleMenu();        // Toggle fullscreen menu
menuInstance.closeMenu();         // Close menu
menuInstance.destroy();           // Cleanup
```

#### WorldMap Class
```javascript
const worldMapInstance = new WorldMap();
worldMapInstance.init();                    // Initialize map
worldMapInstance.updateStatistics(count);  // Update stats
worldMapInstance.slugifyCountry(name);      // Helper function
```

#### FancyboxManager Class
```javascript
const fancyboxManager = new FancyboxManager();
fancyboxManager.init();                     // Initialize with defaults
fancyboxManager.init(customOptions);        // Initialize with custom options
fancyboxManager.open(items, options);       // Open programmatically
fancyboxManager.close();                    // Close gallery
fancyboxManager.destroy();                  // Cleanup
```

#### Parallax Class
```javascript
const parallaxInstance = new Parallax();
parallaxInstance.init(0.25);               // Initialize with factor
parallaxInstance.setFactor(0.5);           // Change parallax intensity
parallaxInstance.pause();                  // Pause effects
parallaxInstance.resume();                 // Resume effects
parallaxInstance.destroy();                // Cleanup
```

## Benefits

### For Development:
- **Organized Code**: Each functionality is in its own file
- **Easy Debugging**: Find and fix issues in specific modules
- **Maintainable**: Clear separation of concerns
- **Extensible**: Easy to add new features to specific modules

### For Production:
- **Single File**: All functionality combined into one `script.js`
- **Performance**: Fewer HTTP requests
- **Compatibility**: Works with existing HTML structure
- **Global Instances**: Pre-initialized and ready to use

## Auto-Generated script.js

The `script.js` file is automatically generated and contains:

1. All class definitions from individual modules
2. Global instances pre-created:
   - `menuInstance`
   - `worldMapInstance` 
   - `fancyboxManager`
   - `parallaxInstance`
3. jQuery document ready initialization
4. Legacy compatibility functions

## Usage in HTML

Simply include the built script:

```html
<!-- Production -->
<script src="/script.js"></script>

<!-- Or for development, include individual modules -->
<script src="/js/menu.js"></script>
<script src="/js/worldmap.js"></script>
<script src="/js/fancybox-manager.js"></script>
<script src="/js/parallax.js"></script>
```

## Build Configuration

The build script (`build-script.js`) can be customized by modifying the config object:

```javascript
const config = {
  sourceDir: 'public/js',
  outputFile: 'public/script.js',
  modules: [
    'menu.js',
    'worldmap.js', 
    'fancybox-manager.js',
    'parallax.js'
  ]
};
```

## Watch Mode

Use watch mode during development to automatically rebuild when files change:

```bash
npm run js:watch
```

This will monitor all module files and rebuild `script.js` whenever you make changes.

## Integration with SCSS

This modular approach works alongside the existing SCSS workflow:

```bash
# Build both SCSS and JS
npm run scss-dev &   # SCSS watch mode
npm run js:watch     # JS watch mode
```

## Migration Notes

- Existing functionality remains unchanged
- All global instances are pre-created and initialized
- Legacy functions maintained for backward compatibility
- No changes needed to existing HTML/EJS templates
