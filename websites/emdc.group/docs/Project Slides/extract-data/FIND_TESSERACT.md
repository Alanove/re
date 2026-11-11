# Finding Tesseract OCR Installation

If Tesseract was installed via WinGet but isn't being detected, follow these steps:

## Step 1: Find Tesseract Installation

Open PowerShell and run:

```powershell
Get-ChildItem "$env:LOCALAPPDATA\Microsoft\WinGet\Packages" -Directory | Where-Object { $_.Name -like "*Tesseract*" } | ForEach-Object { Get-ChildItem $_.FullName -Filter "tesseract.exe" -Recurse | Select-Object FullName }
```

This will show you the full path to `tesseract.exe`.

## Step 2: Configure the Script

Once you have the path, edit `extract-project-data-ocr.py` and add this line **after line 60** (after the auto-detection code):

```python
# Manual Tesseract path (if auto-detection failed)
# Uncomment and update the path below:
# pytesseract.pytesseract.tesseract_cmd = r'C:\Users\YourName\AppData\Local\Microsoft\WinGet\Packages\UB-Mannheim.TesseractOCR_xxxxx\tesseract.exe'
```

Replace the path with the actual path you found in Step 1.

## Alternative: Add to PATH

You can also add Tesseract to your system PATH:

1. Copy the folder path containing `tesseract.exe` (not the exe itself)
2. Open System Properties → Environment Variables
3. Edit the "Path" variable
4. Add the folder path
5. Restart your terminal/PowerShell

## Test Installation

Run the test script:

```bash
python test_tesseract.py
```

This will verify Tesseract is properly configured.






