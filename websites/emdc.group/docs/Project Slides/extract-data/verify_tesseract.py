"""Quick verification that Tesseract is detected"""
import os
import sys

print("Verifying Tesseract installation...\n")

# Check if Tesseract exists at the standard location
tesseract_path = r'C:\Program Files\Tesseract-OCR\tesseract.exe'
if os.path.exists(tesseract_path):
    print(f"✓ Tesseract found at: {tesseract_path}")
    
    # Test with pytesseract
    try:
        import pytesseract
    except ImportError:
        print("✗ pytesseract module not found!")
        print("\nPlease install the required Python packages:")
        print("  pip install pytesseract pillow opencv-python")
        print("\nOr if using a virtual environment, activate it first, then:")
        print("  pip install pytesseract pillow opencv-python")
        sys.exit(1)
    
    try:
        pytesseract.pytesseract.tesseract_cmd = tesseract_path
        version = pytesseract.get_tesseract_version()
        print(f"✓ Tesseract is working! Version: {version}")
        print("\n✓ Everything is configured correctly!")
        print("You can now run: python extract-project-data-ocr.py")
        sys.exit(0)
    except Exception as e:
        print(f"✗ Error testing Tesseract: {e}")
        print(f"  Tesseract path: {tesseract_path}")
        sys.exit(1)
else:
    print(f"✗ Tesseract not found at: {tesseract_path}")
    print("Please verify the installation path.")
    sys.exit(1)






