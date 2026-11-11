# Data Files Documentation

This directory contains all JSON data files for the EMDC website project.

## Files Overview

### Core Data Files
- `pages.json` - Website pages content and SEO data
- `projects.json` - Project portfolio data with works and images
- `site-settings.json` - Global site configuration and settings
- `users.json` - Admin user accounts and authentication data
- `slider.json` - Homepage slider/banner configuration
- `admin-menu.json` - Admin panel navigation menu structure
- `theme-config.json` - Theme and styling configuration
- `project_analytics.json` - Project category analytics and statistics

### New: Project Photos Data
- `project-photos.json` - Extracted project photos from documentation folder

## Project Photos Data Structure

The `project-photos.json` file contains structured data extracted from the `docs/CONSULT EMDC Projects Photos/` directory.

### Data Structure

```json
{
  "categories": {
    "Category Name": {
      "name": "Category Name",
      "slug": "category-slug",
      "projects": [
        {
          "name": "Project Name",
          "filename": "project-image.jpg",
          "slug": "project-slug",
          "imagePath": "/docs/CONSULT EMDC Projects Photos/Category/project-image.jpg",
          "category": "Category Name",
          "fileSize": 123456,
          "fileExtension": ".jpg"
        }
      ],
      "totalProjects": 8
    }
  },
  "metadata": {
    "totalCategories": 6,
    "totalProjects": 47,
    "totalImages": 47,
    "extractedAt": "2025-07-22T23:27:12.519Z",
    "sourceDirectory": "path/to/source"
  }
}
```

### Categories Available
- **Airports & Stations** (8 projects) - Transportation infrastructure projects
- **Civic & Religious** (9 projects) - Government and religious buildings
- **Commercial** (7 projects) - Office buildings and commercial spaces
- **Education & Leisure** (9 projects) - Schools, universities, and recreational facilities
- **Healthcare** (6 projects) - Hospitals and medical facilities
- **Hospitality** (8 projects) - Hotels and hospitality venues

### Usage

The project photos data can be accessed through:
- **Service**: `src/services/projectPhotosService.ts`
- **Controller**: `src/controllers/projectPhotosController.ts`
- **API Endpoints**: Various REST endpoints for accessing the data

### Data Extraction

To re-extract the project photos data, run:
```bash
node scripts/extract-project-photos.js
```

To test the extracted data:
```bash
node scripts/test-project-photos.js
```

## Data Management

All data files follow the MVC pattern:
- **Models**: Data structures defined in TypeScript interfaces
- **Views**: JSON files containing the actual data
- **Controllers**: Business logic for data manipulation and API responses

## File Locations

All data file paths are centralized in `src/constants/data-paths.ts` for consistent access across the application. 