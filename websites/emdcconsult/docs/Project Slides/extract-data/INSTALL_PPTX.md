# Installing python-pptx for PowerPoint Text Extraction

## Why Use PowerPoint Directly?

Extracting text directly from PowerPoint (.pptx) files is **much more accurate** than OCR because:
- ✅ Gets actual text content (100% accurate)
- ✅ No OCR errors or concatenated text
- ✅ Preserves formatting and structure
- ✅ Faster processing

## Installation

### Windows

```powershell
pip install python-pptx
```

### Mac/Linux

```bash
pip install python-pptx
```

## Usage

1. **Convert your slides to PowerPoint format** (if you have images):
   - Open PowerPoint
   - Insert your slide images
   - Save as .pptx files
   - Name files by category (e.g., "Airports & Stations.pptx")

2. **Place .pptx files in Project Slides folder**:
   ```
   docs/Project Slides/
     - Airports & Stations.pptx
     - Civic & Religious.pptx
     - etc.
   ```

3. **Run the extraction script**:
   ```bash
   cd "docs/Project Slides/extract-data"
   python extract-project-data-pptx.py
   ```

## Alternative: Export PowerPoint to Text

If you prefer, you can also:
1. Open PowerPoint
2. File → Save As → Plain Text (.txt)
3. Use the text files with a modified script

## Troubleshooting

### "No module named 'pptx'"
- Make sure you installed: `pip install python-pptx`
- Check Python environment: `python --version`
- Try: `python -m pip install python-pptx`

### "No PowerPoint files found"
- Ensure .pptx files are in `docs/Project Slides/` folder
- Check file extensions (.pptx or .ppt)
- Verify file names match category names






