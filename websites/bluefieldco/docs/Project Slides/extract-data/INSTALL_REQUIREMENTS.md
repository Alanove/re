# Installing Python Requirements

If you're getting "No module named 'pytesseract'" error, follow these steps:

## Step 1: Check Your Python Environment

Make sure you're using the correct Python installation:

```bash
python --version
which python  # or: where python (on Windows)
```

## Step 2: Install Required Packages

Install the required Python packages:

```bash
pip install pytesseract pillow opencv-python
```

If you're using a virtual environment, activate it first:

```bash
# Activate virtual environment (if you have one)
# Then install packages
pip install pytesseract pillow opencv-python
```

## Step 3: Verify Installation

Run the verification script:

```bash
python verify_tesseract.py
```

You should see:
- ✓ Tesseract found at: C:\Program Files\Tesseract-OCR\tesseract.exe
- ✓ Tesseract is working! Version: [version number]

## Troubleshooting

### If pip install fails:
- Try: `python -m pip install pytesseract pillow opencv-python`
- Or: `pip3 install pytesseract pillow opencv-python`

### If you have multiple Python installations:
- Use the full path to the specific Python: `C:\Python39\python.exe -m pip install pytesseract pillow opencv-python`

### If using a virtual environment:
1. Create one: `python -m venv venv`
2. Activate it: `venv\Scripts\activate` (Windows)
3. Install packages: `pip install pytesseract pillow opencv-python`






