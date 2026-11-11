"""Test OCR extraction to see what's being extracted"""
import pytesseract
from PIL import Image
import cv2
import numpy as np
from pathlib import Path
import json
import re

pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'

BASE_DIR = Path(__file__).parent.parent.parent.parent
PROJECT_SLIDES_DIR = BASE_DIR / "docs" / "Project Slides"
PROJECTS_JSON = BASE_DIR / "data" / "projects.json"

# Load projects
with open(PROJECTS_JSON, 'r', encoding='utf-8') as f:
    data = json.load(f)

projects = data.get('projects', [])
airports = [p for p in projects if 'Airports & Stations' in p.get('categories', [])]

print("Airports & Stations projects in JSON:")
for p in airports:
    print(f"  - {p['title']}")

print("\n" + "="*60)
print("Testing OCR on Airports & Stations slide...")
print("="*60)

slide_path = PROJECT_SLIDES_DIR / "Airports & Stations .jpg"

# Preprocess image
img = cv2.imread(str(slide_path))
gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
_, thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
denoised = cv2.fastNlMeansDenoising(thresh, None, 10, 7, 21)

# Extract text
text = pytesseract.image_to_string(Image.fromarray(denoised), config='--psm 6')
lines = [l.strip() for l in text.split('\n') if l.strip()]

print(f"\nExtracted {len(lines)} lines of text")
print("\nFirst 20 lines:")
for i, line in enumerate(lines[:20]):
    print(f"  {i:2d}: {line}")

print("\n" + "="*60)
print("Looking for 'Project' lines:")
print("="*60)

for i, line in enumerate(lines):
    if 'project' in line.lower():
        print(f"\nLine {i}: {line}")
        # Try to extract project name
        project_name = re.sub(r'^.*?project\s*:?\s*', '', line, flags=re.IGNORECASE).strip()
        print(f"  Extracted name: '{project_name}'")
        
        # Try to match with projects
        for project in airports:
            title = project['title']
            if project_name.lower() in title.lower() or title.lower() in project_name.lower():
                print(f"  -> Possible match: {title}")






