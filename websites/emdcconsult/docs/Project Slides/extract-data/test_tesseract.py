"""Test script to find and verify Tesseract OCR installation"""
import os
import sys
import glob

print("=== Tesseract OCR Detection Test ===\n")

# Check Python packages
print("1. Checking Python packages...")
try:
    import pytesseract
    from PIL import Image
    import cv2
    print("   ✓ All Python packages installed")
except ImportError as e:
    print(f"   ✗ Missing package: {e}")
    sys.exit(1)

# Check for Tesseract executable
print("\n2. Searching for Tesseract executable...")
tesseract_paths = [
    r'C:\Program Files\Tesseract-OCR\tesseract.exe',
    r'C:\Program Files (x86)\Tesseract-OCR\tesseract.exe',
]

# Check WinGet location
winget_base = os.path.expanduser(r'~\AppData\Local\Microsoft\WinGet\Packages')
if os.path.exists(winget_base):
    print(f"   Checking WinGet location: {winget_base}")
    winget_patterns = [
        os.path.join(winget_base, '*Tesseract*', '**', 'tesseract.exe'),
        os.path.join(winget_base, 'UB-Mannheim.TesseractOCR_*', '**', 'tesseract.exe'),
    ]
    for pattern in winget_patterns:
        matches = glob.glob(pattern, recursive=True)
        tesseract_paths.extend(matches)

found_paths = []
for path in tesseract_paths:
    if os.path.exists(path):
        found_paths.append(path)
        print(f"   ✓ Found: {path}")

if not found_paths:
    print("   ✗ Tesseract not found in standard locations")
    print("\n3. Testing pytesseract default detection...")
    try:
        version = pytesseract.get_tesseract_version()
        print(f"   ✓ Tesseract found via pytesseract (version: {version})")
        print(f"   Path: {pytesseract.pytesseract.tesseract_cmd}")
    except Exception as e:
        print(f"   ✗ Tesseract not found: {e}")
        print("\n=== SOLUTION ===")
        print("Tesseract OCR is not installed or not in PATH.")
        print("\nOption 1: Install Tesseract OCR")
        print("  Download from: https://github.com/UB-Mannheim/tesseract/wiki")
        print("  Or use: winget install UB-Mannheim.TesseractOCR")
        print("\nOption 2: If already installed, add to PATH or set manually:")
        print("  In extract-project-data-ocr.py, add after line 31:")
        print("  pytesseract.pytesseract.tesseract_cmd = r'C:\\Path\\To\\Tesseract-OCR\\tesseract.exe'")
        sys.exit(1)
else:
    # Set the first found path
    pytesseract.pytesseract.tesseract_cmd = found_paths[0]
    print(f"\n3. Testing Tesseract...")
    try:
        version = pytesseract.get_tesseract_version()
        print(f"   ✓ Tesseract working! Version: {version}")
        print(f"   Using path: {found_paths[0]}")
        print("\n=== SUCCESS ===")
        print("Tesseract is properly configured. You can now run:")
        print("  python extract-project-data-ocr.py")
    except Exception as e:
        print(f"   ✗ Error testing Tesseract: {e}")
        sys.exit(1)






