# Project Data Extraction Scripts

This folder contains all scripts for extracting and processing project data from slides and photos.

## Scripts Overview

### Data Extraction Scripts

1. **extract-project-data-pptx.py** - Extract from PowerPoint files (RECOMMENDED - 100% accurate)
   - Extracts text directly from .pptx files (no OCR errors!)
   - Extracts: bau, area, size, quantity, contractor, architect, client, scope, country
   - Requirements: `pip install python-pptx`
   - Run: `python extract-project-data-pptx.py`
   - **Best option if you have PowerPoint source files**

2. **extract-project-data-ocr.py** - Python script using pytesseract (OCR from images)
   - Extracts from JPG/PNG images using OCR
   - Better accuracy with image preprocessing
   - Requirements: `pip install pytesseract pillow opencv-python`
   - Requires Tesseract OCR installed on system
   - Run: `python extract-project-data-ocr.py`
   - **Use this if you only have image files**

3. **extract-project-data-ocr.js** - Node.js script using Tesseract.js for OCR extraction
   - Extracts: bau, area, size, quantity, contractor, architect, client, scope, country
   - Requirements: `npm install tesseract.js`
   - Run: `node extract-project-data-ocr.js`

### Image Processing Scripts

3. **update-project-images.js** - Comprehensive script for batch updating all project images
   - Matches projects with photos from source folder
   - Updates project_image fields in projects.json
   - Copies images to public/projects/{folder_name}/
   - Run: `node update-project-images.js`

4. **analyze-project-slides.js** - Node.js script for analyzing and updating projects
   - Analyzes project slides structure
   - Matches projects with photos
   - Generates analysis report
   - Run: `node analyze-project-slides.js`

5. **process-project-slides.mjs** - ES6 module version of the analysis script
   - Same functionality as analyze-project-slides.js
   - Uses ES6 modules
   - Run: `node process-project-slides.mjs`

6. **analyze_project_slides.py** - Python version of the analysis script
   - Same functionality as Node.js versions
   - Run: `python analyze_project_slides.py`

## Usage

### Step 1: Update Project Images

```bash
cd "docs/Project Slides/extract-data"
node update-project-images.js
```

### Step 2: Extract Data from Slides

**Option A: PowerPoint Files (RECOMMENDED - 100% Accurate)**
```bash
cd "docs/Project Slides/extract-data"
pip install python-pptx
python extract-project-data-pptx.py
```
**Note:** Place your .pptx files in `docs/Project Slides/` folder. See `INSTALL_PPTX.md` for details.

**Option B: OCR from Images (Python)**
```bash
cd "docs/Project Slides/extract-data"
python extract-project-data-ocr.py
```

**Option C: OCR from Images (Node.js)**
```bash
cd "docs/Project Slides/extract-data"
node extract-project-data-ocr.js
```

## Output Files

All scripts generate output files in their respective locations:

- **OCR Results**: `ocr-extraction-results.txt` (in this folder)
- **OCR Report**: `../ocr_extraction_report.md` (in Project Slides folder)
- **Image Update Results**: `project-update-results.txt` (in this folder)
- **Analysis Report**: `../analysis_report.md` (in Project Slides folder)
- **Log Files**: Various log files in this folder

## Notes

- All scripts automatically adjust paths to work from this subdirectory
- Scripts reference the project root (3 levels up) for data files
- Make sure to run scripts from this directory or adjust paths accordingly






