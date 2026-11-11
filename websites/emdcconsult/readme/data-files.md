# Data Files Documentation

This directory contains all JSON data files for the EMDC website project.

## Files Overview

### Core Data Files
- `pages.json` - Website pages content and SEO data
- `projects.json` - Project portfolio data with works and images
- `site-settings.json` - Global site configuration and settings (updated from PowerPoint)
- `users.json` - Admin user accounts and authentication data
- `slider.json` - Homepage slider/banner configuration
- `admin-menu.json` - Admin panel navigation menu structure
- `theme-config.json` - Theme and styling configuration
- `project_analytics.json` - Project category analytics and statistics

### New: Project Photos Data
- `project-photos.json` - Extracted project photos from documentation folder

### Updated: Pages Data
- `pages.json` - Completely replaced with new content extracted from PowerPoint slides (slides 2, 4, 5, 6, 7, 8, 9, 10, 11) - EMDC Group

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

## Pages Data Extraction

The `pages.json` file has been completely replaced with new content extracted from specific PowerPoint slides for **EMDC Group**:

### New Pages Structure
1. **Who We Are** (Slide 2) - Company information and highlights
2. **Our BIM Know-how** (Slide 4) - BIM capabilities and technology
3. **Project Categories** (Slide 5) - Project categories overview
4. **Airports & Stations Projects** (Slide 6) - Transportation infrastructure projects
5. **Commercial & Civic Projects** (Slide 7) - Commercial and government buildings
6. **Healthcare & Education Projects** (Slide 8) - Healthcare and educational facilities
7. **Hospitality Projects** (Slide 9) - Hotel and hospitality projects
8. **Our Approach & Methodology** (Slide 10) - Company approach and methodology
9. **Contact & Get In Touch** (Slide 11) - Contact information and inquiry details

### Features Added
- **Rich HTML Content** - Structured content with CSS classes for styling
- **Structured Data** - JSON data for each page with specific information
- **SEO Optimization** - Meta titles, descriptions, and keywords for each page
- **Menu Integration** - New pages added to navigation menu
- **Background Images** - Appropriate images for each page type

### Extraction Script
To replace pages from PowerPoint:
```bash
node scripts/replace-pages-from-pptx.js
```

To test the new pages:
```bash
node scripts/test-new-pages.js
```

## Site Settings Extraction

The `site-settings.json` file has been updated with data extracted from the PowerPoint portfolio file:

### Updated Information
- **Company Name**: CONSULT EMDC
- **Full Name**: CONSULT EMDC - Engineering, Management, Design & Construction
- **Tagline**: Engineering Excellence, Construction Innovation
- **Contact**: info@consultemdc.com, +961 1 234567
- **Address**: Beirut, Lebanon
- **Website**: https://consultemdc.com

### Services & Specializations
- **Services**: Steel Construction, Architectural Steelwork, Structural Engineering, Project Management, Design & Engineering, Construction Management
- **Specializations**: Airports & Stations, Civic & Religious Buildings, Commercial Projects, Education & Leisure Facilities, Healthcare Facilities, Hospitality Projects
- **Regions**: Lebanon, Saudi Arabia, Kuwait, Iraq, UAE, Qatar

### Extraction Script
To re-extract site settings from PowerPoint (EMDC Portfolio 2025.pptx):
```bash
node scripts/extract-pptx-site-settings.js
```

To test the updated settings:
```bash
node scripts/test-site-settings.js
```

## Data Management

All data files follow the MVC pattern:
- **Models**: Data structures defined in TypeScript interfaces
- **Views**: JSON files containing the actual data
- **Controllers**: Business logic for data manipulation and API responses

## File Locations

All data file paths are centralized in `src/constants/data-paths.ts` for consistent access across the application. 