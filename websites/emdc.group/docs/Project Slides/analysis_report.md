# Project Slides Analysis Report

Generated: 2025-01-27

## Summary

This report documents the analysis of project slides and the matching of project photos with projects.json entries.

### Process Overview

1. **Project Slides Analysis**: Analyzed project slides in `docs/Project Slides/` folder
2. **Photo Matching**: Matched project photos from `docs/CONSULT EMDC Projects Photos/` with projects in `projects.json`
3. **Image Updates**: Updated `project_image` fields in projects.json to match source photos
4. **Image Copying**: Copied project images to `public/projects/{folder_name}/{project_image}`

## Available Photos by Category

### Airports & Stations
- Abha Airport.jpg
- ATCL Yacht Club & Marina.jpg
- Haramain High Speed Rail KAEC Station.jpg
- Jezan Airport.jpg
- King AbdulAziz International Airport.jpg
- Middle Euphrates International Airport.jpg
- Riyadh Metro Park & Ride.jpg
- Riyadh Metro Stations, Line 5 & 6.jpg

### Civic & Religious
- Al-Maamour Mosque.jpg
- Baghdad Council of Ministers.jpg
- Cite Marie.jpg
- GACA Headquarters.jpeg
- King Abdullah Economic City.jpg
- King Abdullah International Gardens.jpg
- King Salman Park Grand Mosque.jpg
- Our Lady of Joy.jpg
- Samawah Cultural Center.png
- UYO Convention Center.jpg

### Commercial
- Crystal Tower.jpg
- EKO Tower I (TOTAL Headquarters).jpg
- Jeddah Corniche Park Tower.jpg
- Kingsway Tower.jpg
- Marchés Urbains et Régionaux.jpg
- Otunba Offices.jpg
- Zouhour Baghdad Mall.jpg

### Education & Leisure
- Al Furat TV Broadcasting Station.jpg
- American International School.jpg
- Bayelsa Auditorium.jpg
- Dhahran Expo Convention Center.jpg
- GEMS World Academy.jpg
- JAX Multistory Car Parks.jpg
- Princess Noura University.jpg
- Qiddiya Speed Park.jpg
- Road & Transport Research Center.jpg
- Roca del Este Hotel I.jpg
- Tripoli International Olympic Stadium.jpg

### Healthcare
- Baaqouba Teaching Hospital.jpg
- Baghdad Teaching Hospital.jpg
- Clinical Skills Development Center.jpg
- CMRC Hospital II.png
- Ibn Sina Hospital.jpg
- Ibn Sina Hospital.webp
- Picture4.jpg
- Picture5.jpg
- PNU Medical Hospital.jpg
- Savior Medical Center.jpg

### Hospitality
- Hampton S7 Hotel.jpg
- Hotel Complex Oasis (1001 Keys).jpg
- King Abdullah WAQF Tower Hotel.jpg
- MAAD Complex Hospitality Towers.jpg
- roca del estate hotel 1.png
- Roca del Este Hotel I.jpg
- Sheraton Lagos Hotel.jpg
- Sheraton Lagos Hotel.webp
- Shura Island - Hotel West #1.jpeg
- Shura Island - Hotel West #1.jpg
- VOCO - IHG Hotel (234 Keys).jpg

### Industrial
- Algorithm Pharmaceuticals.jpg
- Cervecería Cubana.jpg
- Eni Center of Excellence.jpg
- Industrial Biofuel Agri Hub.jpg
- New Jet Propulsion Center.jpg
- Vertical Indoor Farms.jpg

### Infrastructure
- Jannat Baghdad Development.png
- Riyadh Metro – Line 4, 5 & 6.jpg
- Saafat El Basra City.jpg
- Venan Housing Project.jpg

### Mixed Use
- Azuri Peninsula.jpg
- Carplex Mixed Use.jpg
- EKO Tower II.jpg
- Karbala Oasis Development.jpg
- Lawyers & Notaries Tower.jpg
- Palm Towers.jpg

### Offices
- Crystal Tower.jpeg
- EKO Tower I.jpeg
- Kingsway Tower.jpg
- Otunba Offices.jpg
- World Bank.jpg

### Power Plants & Data Centers
- Africa Data Centers.jpg
- AGL Substations.jpg
- Al-Qassim PP Extension #2.jpg
- Al-Qassim PP Extension #3.jpg
- eStruxture Data Center.jpg
- KAIA Data Centers 1&2.jpeg
- Riyadh Power Plant PP10.jpg

### Residential
- Bin Mahfouz Residential Compound.jpg
- Darco Shatea Residences.jpg
- Garden Heights.jpg
- Kuramo Beach Residence.jpg
- Meydan I Staff Accommodation.jpeg
- Roshn Show Villas.jpg
- Sky Tower.jpg
- The Carnelian.jpg
- Twin Tower.jpeg

### Retail
- Al Rafidain Mall.png
- Kirkuk Landmark Mall.jpg
- Kirkuk Mall.jpg
- Marchés Urbains et Régionaux.png
- Patchi Waterway.png
- Sultan Boulevard Commercial Center.jpg
- Villaggio II.jpg
- Zouhour Baghdad Mall.jpg

## Updates Made

### Image Updates
- **GACA Headquarters**: Updated project_image from `project-1764722509286-67887149.jpeg` to `GACA Headquarters.jpeg` and copied image to public folder

### Scripts Created

#### Image Processing Scripts
1. **analyze-project-slides.js**: Node.js script for analyzing and updating projects
2. **process-project-slides.mjs**: ES6 module version of the analysis script
3. **update-project-images.js**: Comprehensive script for batch updating all project images
4. **analyze_project_slides.py**: Python version of the analysis script

#### OCR Data Extraction Scripts
5. **extract-project-data-ocr.js**: Node.js script using Tesseract.js for OCR extraction
6. **extract-project-data-ocr.py**: Python script using pytesseract for OCR extraction (recommended for better accuracy)

### OCR Extraction Features

The OCR scripts extract the following project data fields from slide images:
- **bau**: Built area/floor area
- **area**: Site area
- **size**: Project size
- **quantity**: Number of units/stations/etc.
- **contractor**: Contractor name
- **architect**: Architect name
- **client**: Client name
- **scope**: Project scope/description
- **country**: Project location/country

## Processing Instructions

### Step 1: Update Project Images

To process all projects and update images:

1. **Run the Node.js script**:
   ```bash
   node update-project-images.js
   ```

2. **Check the output file**: `project-update-results.txt` will contain detailed results

### Step 2: Extract Project Data from Slides using OCR

To extract project data (bau, area, size, quantity, contractor, architect, client, scope, country) from slide images:

#### Option A: Using Python (Recommended - Better OCR accuracy)

1. **Install dependencies**:
   ```bash
   pip install pytesseract pillow opencv-python
   ```

2. **Install Tesseract OCR**:
   - Windows: Download from https://github.com/UB-Mannheim/tesseract/wiki
   - Mac: `brew install tesseract`
   - Linux: `apt-get install tesseract-ocr`

3. **Run the Python OCR script**:
   ```bash
   cd "docs/Project Slides/extract-data"
   python extract-project-data-ocr.py
   ```

#### Option B: Using Node.js

1. **Install dependencies**:
   ```bash
   npm install tesseract.js
   ```

2. **Run the Node.js OCR script**:
   ```bash
   cd "docs/Project Slides/extract-data"
   node extract-project-data-ocr.js
   ```

3. **Check the output files**:
   - `ocr-extraction-results.txt` - Detailed extraction log
   - `docs/Project Slides/ocr_extraction_report.md` - Extraction report

### Step 3: Review Results

1. **Review the OCR extraction report**: `docs/Project Slides/ocr_extraction_report.md`
2. **Verify extracted data**: Check that all fields (bau, area, size, quantity, contractor, architect, client, scope, country) are correctly extracted
3. **Manual review**: Some data may need manual correction due to OCR limitations

## Known Issues

### Projects That May Need Manual Review

1. **Projects with generic image names**: Some projects use generic names like `project-{timestamp}-{id}.jpg` which may need to be matched manually
2. **Projects in multiple categories**: Some projects appear in multiple category folders
3. **Image format variations**: Some projects have both .jpg and .webp versions
4. **Missing photos**: Some projects in projects.json may not have corresponding photos in the source folder

### Projects Requiring Attention

- Projects with `project-{timestamp}` image names should be matched with source photos
- Projects without folder_name need slug generation
- Projects missing from source photos folder need investigation

## Notes

### Image Matching Strategy
Projects are matched with photos using:
1. Exact name matching (normalized)
2. Partial name matching
3. Common word matching

### Image Naming
- Source photos maintain their original filenames
- Project images are copied to `public/projects/{folder_name}/{project_image}`
- Original filenames from source photos are used as `project_image` values

### Categories Verification
Project categories are verified against:
- Slide filenames in `docs/Project Slides/`
- Folder names in `docs/CONSULT EMDC Projects Photos/`

## Recommendations

1. **Review Unmatched Projects**: Some projects in projects.json may not have corresponding photos in the source folder
2. **Verify Image Quality**: Ensure all copied images are of acceptable quality
3. **Update Missing Projects**: Projects appearing in slides but not in projects.json should be added
4. **Standardize Naming**: Consider standardizing image filenames for consistency

## Next Steps

1. Run the automated script (`process-project-slides.mjs`) to process all projects
2. Review the report for any missing images or unclear data
3. Manually verify projects that couldn't be automatically matched
4. Update projects.json with any additional information from the slides






