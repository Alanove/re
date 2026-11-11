# Menu Management System

## Overview

The Menu Management System is a comprehensive CMS feature that allows administrators to create, manage, and organize website navigation menus. It supports hierarchical menu structures with drag-and-drop functionality for easy reordering.

## Features

### Core Functionality
- **Menu Creation**: Create multiple menus (e.g., Main Navigation, Footer Menu, Sidebar Menu)
- **Menu Items**: Add, edit, and delete menu items
- **Hierarchical Structure**: Support for parent-child menu relationships
- **Drag & Drop**: Reorder menu items using intuitive drag-and-drop interface
- **Multiple Link Types**: Support for pages, files, and external links
- **Active/Inactive Status**: Toggle menu items on/off
- **Sort Order**: Manual control over menu item ordering

### Link Types
1. **Page Links**: Link to internal pages using page keys
2. **File Links**: Link to downloadable files or documents
3. **External Links**: Link to external websites or resources

### User Interface
- **Responsive Design**: Works on desktop and mobile devices
- **Modern UI**: Clean, intuitive interface with Bootstrap styling
- **Real-time Updates**: AJAX-powered interactions for smooth user experience
- **Visual Feedback**: Clear indicators for menu item types and status

## File Structure

### Data Files
```
data/
├── menu.json                    # Main menu data file
└── admin-menu.json             # Admin panel navigation menu
```

### Backend Files
```
admin/
├── services/
│   ├── menuService.ts          # Menu business logic
│   └── adminMenuService.ts     # Admin menu service
├── controllers/
│   └── menuController.ts       # Menu controller
├── routes/
│   └── index.ts               # Menu routes
└── views/menus/
    ├── menus.ejs              # Menu listing page
    ├── create-menu.ejs        # Create menu form
    └── edit-menu.ejs          # Edit menu with drag-drop
```

### Frontend Assets
```
admin/public/
├── css/
│   └── custom.css             # Menu management styles
└── js/
    └── custom.js              # Menu JavaScript functionality
```

## Data Structure

### Menu JSON Format
```json
{
  "menus": [
    {
      "id": "main-menu",
      "name": "Main Menu",
      "description": "Primary navigation menu",
      "items": [
        {
          "id": "home",
          "title": "Home",
          "type": "page",
          "link": "home",
          "sort": 1,
          "active": true,
          "children": []
        }
      ]
    }
  ]
}
```

### Menu Item Properties
- `id`: Unique identifier for the menu item
- `title`: Display text for the menu item
- `type`: Link type (`page`, `file`, or `external`)
- `link`: The actual link value (page key, file path, or URL)
- `sort`: Numeric order for sorting
- `active`: Boolean indicating if the item is active
- `children`: Array of child menu items

## API Endpoints

### Menu Management
- `GET /admin/menus` - List all menus
- `GET /admin/menus/create` - Show create menu form
- `POST /admin/menus/create` - Create new menu
- `GET /admin/menus/:id/edit` - Show edit menu form
- `POST /admin/menus/:id/edit` - Update menu
- `DELETE /admin/menus/:id` - Delete menu

### Menu Items Management (AJAX)
- `POST /admin/menus/:menuId/items` - Add menu item
- `PUT /admin/menus/:menuId/items/:itemId` - Update menu item
- `DELETE /admin/menus/:menuId/items/:itemId` - Delete menu item
- `POST /admin/menus/:menuId/items/:itemId/move` - Move menu item (drag & drop)
- `GET /admin/menus/:menuId/items` - Get menu items
- `GET /admin/api/pages` - Get available pages for linking

## Usage Instructions

### Creating a Menu
1. Navigate to Admin Panel → Menus
2. Click "Add New Menu"
3. Enter menu name and description
4. Click "Create Menu"

### Adding Menu Items
1. Edit an existing menu
2. Fill in the "Add Menu Item" form:
   - **Title**: Display text for the menu item
   - **Type**: Choose from Page, File, or External Link
   - **Link**: Enter the appropriate link value
   - **Sort Order**: Numeric position in the menu
   - **Active**: Check to enable the menu item
   - **Parent Item**: Select parent for hierarchical structure
3. Click "Add Item"

### Managing Menu Items
- **Edit**: Click the edit icon to modify menu item properties
- **Delete**: Click the delete icon to remove menu items
- **Reorder**: Drag and drop menu items to change their order
- **Hierarchy**: Drag items into other items to create parent-child relationships

### Link Types Explained
- **Page**: Enter the page key (e.g., "about", "contact")
- **File**: Enter the file path (e.g., "/downloads/brochure.pdf")
- **External**: Enter the full URL (e.g., "https://example.com")

## Technical Implementation

### Services
- **MenuService**: Handles menu CRUD operations and business logic
- **AdminMenuService**: Manages admin panel navigation menu

### Controllers
- **MenuController**: Handles HTTP requests and responses for menu management

### Frontend Technologies
- **Sortable.js**: Drag-and-drop functionality
- **Bootstrap**: UI framework and styling
- **AJAX**: Asynchronous data operations
- **EJS**: Server-side templating

### Key Features
- **Singleton Pattern**: Services use singleton pattern for data consistency
- **Validation**: Comprehensive input validation for all menu operations
- **Error Handling**: Robust error handling with user-friendly messages
- **Responsive Design**: Mobile-friendly interface
- **Real-time Updates**: Immediate UI updates without page refresh

## Configuration

### Adding Menu to Admin Navigation
The menu section is automatically added to the admin navigation. To modify the admin menu, edit `data/admin-menu.json`:

```json
{
  "id": "menus",
  "text": "Menus",
  "icon": "fa fa-bars",
  "url": "/admin/menus"
}
```

### Customizing Styles
Menu-specific styles are defined in `admin/public/css/custom.css`. Key classes:
- `.menu-item`: Individual menu item styling
- `.menu-item-children`: Child menu items container
- `.sortable-*`: Drag-and-drop visual feedback classes

## Testing

Run the menu functionality test:
```bash
node tests/menu-test.js
```

This test verifies:
- Menu data file structure
- Service method availability
- Controller functionality
- Route configuration

## Future Enhancements

Potential improvements for the menu system:
- **Menu Templates**: Pre-built menu templates
- **Menu Import/Export**: Backup and restore functionality
- **Menu Analytics**: Track menu usage and performance
- **Multi-language Support**: Internationalization for menu items
- **Menu Permissions**: Role-based menu access control
- **Menu Caching**: Performance optimization for large menus
- **Menu Search**: Search functionality within menu items
- **Bulk Operations**: Select and modify multiple menu items at once

## Troubleshooting

### Common Issues
1. **Drag & Drop Not Working**: Ensure Sortable.js is loaded
2. **Menu Items Not Saving**: Check file permissions for `data/menu.json`
3. **AJAX Errors**: Verify all required routes are properly configured
4. **Styling Issues**: Ensure custom CSS is loaded correctly

### Debug Mode
Enable debug logging by checking browser console for JavaScript errors and server logs for backend issues.
