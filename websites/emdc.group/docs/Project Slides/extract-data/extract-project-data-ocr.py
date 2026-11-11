"""
OCR-based script to extract project data from slide images
Extracts: bau, area, size, quantity, contractor, architect, client, scope, country

Requirements:
- pip install pytesseract pillow opencv-python
- Install Tesseract OCR: https://github.com/UB-Mannheim/tesseract/wiki (Windows)
  or: brew install tesseract (Mac) / apt-get install tesseract-ocr (Linux)

Run with: python extract-project-data-ocr.py

Note: Script is in docs/Project Slides/extract-data/, paths are relative to project root
"""

import json
import os
import re
import sys
from pathlib import Path
from typing import Dict, List, Optional
from datetime import datetime

try:
    import pytesseract
    from PIL import Image
    import cv2
    import numpy as np
except ImportError as e:
    print(f"ERROR: Missing required library. Install with: pip install pytesseract pillow opencv-python")
    print(f"Missing: {e}")
    sys.exit(1)

# Auto-detect Tesseract installation on Windows
if sys.platform == 'win32':
    import os
    import glob
    
    tesseract_paths = [
        r'C:\Program Files\Tesseract-OCR\tesseract.exe',
        r'C:\Program Files (x86)\Tesseract-OCR\tesseract.exe',
    ]
    
    # Check WinGet installation location
    winget_base = os.path.expanduser(r'~\AppData\Local\Microsoft\WinGet\Packages')
    if os.path.exists(winget_base):
        winget_patterns = [
            os.path.join(winget_base, 'UB-Mannheim.TesseractOCR_*', 'tesseract.exe'),
            os.path.join(winget_base, '*Tesseract*', '**', 'tesseract.exe'),
        ]
        for pattern in winget_patterns:
            matches = glob.glob(pattern, recursive=True)
            tesseract_paths.extend(matches)
    
    # Try to find Tesseract
    tesseract_found = False
    for tesseract_path in tesseract_paths:
        if os.path.exists(tesseract_path):
            pytesseract.pytesseract.tesseract_cmd = tesseract_path
            tesseract_found = True
            print(f"Found Tesseract at: {tesseract_path}")
            break
    
    # If not found in common locations, try to find it in PATH or let pytesseract handle it
    if not tesseract_found:
        try:
            # This will raise an exception if Tesseract is not found
            pytesseract.get_tesseract_version()
            print("Tesseract found in PATH")
        except Exception as e:
            print("=" * 60)
            print("ERROR: Tesseract OCR not found!")
            print("=" * 60)
            print("\nTesseract OCR is required but was not found in:")
            print("  - C:\\Program Files\\Tesseract-OCR\\")
            print("  - C:\\Program Files (x86)\\Tesseract-OCR\\")
            print("  - WinGet packages location")
            print("  - System PATH")
            print(f"\nError details: {e}")
            print("\nSOLUTIONS:")
            print("1. Install Tesseract OCR:")
            print("   Download: https://github.com/UB-Mannheim/tesseract/wiki")
            print("   Or run: winget install UB-Mannheim.TesseractOCR")
            print("\n2. If already installed via WinGet, find the path:")
            print("   Check: %LOCALAPPDATA%\\Microsoft\\WinGet\\Packages")
            print("   Look for a folder containing 'Tesseract'")
            print("\n3. Manually set the path in this script (after line 60):")
            print("   pytesseract.pytesseract.tesseract_cmd = r'C:\\Path\\To\\tesseract.exe'")
            print("=" * 60)
            sys.exit(1)

# Paths
# Script is in docs/Project Slides/extract-data/, so go up 4 levels to project root
# extract-data -> Project Slides -> docs -> emdc-website (root)
BASE_DIR = Path(__file__).parent.parent.parent.parent
PROJECT_SLIDES_DIR = BASE_DIR / "docs" / "Project Slides"
PROJECT_PHOTOS_DIR = BASE_DIR / "docs" / "CONSULT EMDC Projects Photos"
PROJECTS_JSON = BASE_DIR / "data" / "projects.json"
PUBLIC_PROJECTS_DIR = BASE_DIR / "public" / "projects"
REPORT_FILE = BASE_DIR / "docs" / "Project Slides" / "ocr_extraction_report.md"
LOG_FILE = BASE_DIR / "docs" / "Project Slides" / "extract-data" / "ocr_extraction_log.txt"

def log(message: str):
    """Log message to both console and file"""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    log_message = f"[{timestamp}] {message}"
    print(log_message)
    # Ensure log file directory exists
    LOG_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(LOG_FILE, 'a', encoding='utf-8') as f:
        f.write(log_message + '\n')

def normalize_name(name: str) -> str:
    """Normalize project name for matching"""
    name = re.sub(r'[^\w\s-]', '', name)
    name = re.sub(r'\s+', ' ', name)
    return name.strip().lower()

def preprocess_image(image_path: Path) -> np.ndarray:
    """Preprocess image for better OCR accuracy"""
    try:
        # Read image
        img = cv2.imread(str(image_path))
        if img is None:
            log(f"WARNING: Could not read image {image_path}")
            return None
        
        # Convert to grayscale
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        
        # Apply thresholding
        _, thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        
        # Denoise
        denoised = cv2.fastNlMeansDenoising(thresh, None, 10, 7, 21)
        
        return denoised
    except Exception as e:
        log(f"ERROR preprocessing image {image_path}: {e}")
        return None

def extract_text_from_slide(slide_path: Path, use_preprocessing: bool = True) -> str:
    """Extract text from slide image using OCR"""
    try:
        log(f"Processing OCR for: {slide_path.name}")
        
        if use_preprocessing:
            # Preprocess image for better OCR
            processed_img = preprocess_image(slide_path)
            if processed_img is not None:
                # Convert numpy array to PIL Image
                pil_image = Image.fromarray(processed_img)
            else:
                # Fallback to original image
                pil_image = Image.open(slide_path)
        else:
            pil_image = Image.open(slide_path)
        
        # Extract text using Tesseract
        # Use config for better accuracy: --psm 6 (assume uniform block of text)
        text = pytesseract.image_to_string(
            pil_image,
            config='--psm 6 -c tessedit_char_whitelist=0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz.,;:()[]{}&/-\\s'
        )
        
        log(f"Extracted {len(text)} characters of text")
        return text
    except Exception as e:
        log(f"ERROR extracting text from {slide_path}: {e}")
        return ''

def parse_project_data(ocr_text: str, project_title: str) -> Dict[str, str]:
    """Parse OCR text to extract project information"""
    data = {
        'bau': '',
        'area': '',
        'size': '',
        'quantity': '',
        'contractor': '',
        'architect': '',
        'client': '',
        'scope': '',
        'country': ''
    }
    
    lines = [l.strip() for l in ocr_text.split('\n') if l.strip()]
    
    # Common patterns for extraction
    patterns = {
        'bau': [
            r'bua[:\s]*([^\n]+)',  # BUA (Built-Up Area) is common
            r'bau[:\s]*([^\n]+)',
            r'bau\s*=\s*([^\n]+)',
            r'built[:\s]*area[:\s]*([^\n]+)',
            r'built[:\s]*up[:\s]*area[:\s]*([^\n]+)',
        ],
        'area': [
            r'area[:\s]*([^\n]+)',
            r'area\s*=\s*([^\n]+)',
            r'site[:\s]*area[:\s]*([^\n]+)',
        ],
        'size': [
            r'size[:\s]*([^\n]+)',
            r'size\s*=\s*([^\n]+)',
        ],
        'quantity': [
            r'quantity[:\s]*([^\n]+)',
            r'qty[:\s]*([^\n]+)',
            r'no[.\s]*of[:\s]*([^\n]+)',
        ],
        'contractor': [
            r'contractor[:\s]*([^\n]+)',
            r'contractor\s*=\s*([^\n]+)',
        ],
        'architect': [
            r'architect[:\s]*([^\n]+)',
            r'architect\s*=\s*([^\n]+)',
            r'architecture[:\s]*([^\n]+)',
        ],
        'client': [
            r'client[:\s]*([^\n]+)',
            r'client\s*=\s*([^\n]+)',
            r'owner[:\s]*([^\n]+)',
        ],
        'scope': [
            r'scope[:\s]*([^\n]+)',
            r'scope\s*=\s*([^\n]+)',
            r'services[:\s]*([^\n]+)',
        ],
        'country': [
            r'country[:\s]*([^\n]+)',
            r'location[:\s]*([^\n]+)',
            r'location\s*=\s*([^\n]+)',
        ]
    }
    
    # Try direct pattern matching
    for key, pattern_list in patterns.items():
        for pattern in pattern_list:
            match = re.search(pattern, ocr_text, re.IGNORECASE | re.MULTILINE)
            if match and match.group(1):
                value = match.group(1).strip()
                # Clean up common OCR errors
                value = re.sub(r'\s+', ' ', value)
                if value and len(value) > 1:
                    data[key] = value
                    break
    
    # Alternative: Look for labeled fields in structured format (key-value pairs)
    for i, line in enumerate(lines):
        line_lower = line.lower()
        
        # Check for BUA (Built-Up Area) - map to bau
        if not data['bau'] and ('bua' in line_lower or 'built' in line_lower and 'area' in line_lower):
            value = re.sub(r'(bua|built[-\s]*up[-\s]*area|built[-\s]*area)[:\s]*', '', line, flags=re.IGNORECASE).strip()
            if not value and i + 1 < len(lines):
                value = lines[i + 1].strip()
            value = re.sub(r'^\W+|\W+$', '', value)
            if value and len(value) > 1:
                data['bau'] = value
                continue
        
        # Check each field
        for key in data.keys():
            if not data[key] and key in line_lower:
                # Try to extract value from same line (remove label)
                value = re.sub(f'{key}[:\s]*', '', line, flags=re.IGNORECASE).strip()
                # Remove bold markers
                value = re.sub(r'\*\*', '', value).strip()
                
                # If no value on same line, check next line
                if not value and i + 1 < len(lines):
                    next_line = lines[i + 1].strip()
                    # Only use next line if it doesn't look like another label
                    if not any(k in next_line.lower() for k in ['project', 'country', 'bua', 'bau', 'area', 'contractor', 'architect', 'client', 'scope', 'size', 'quantity']):
                        value = next_line
                        # Remove bold markers
                        value = re.sub(r'\*\*', '', value).strip()
                
                # For scope, allow multi-line values (continue until next label)
                if key == 'scope' and value and i + 1 < len(lines):
                    # Collect additional lines until we hit another label
                    j = i + 1
                    while j < len(lines):
                        next_line = lines[j].strip()
                        next_lower = next_line.lower()
                        # Stop if we hit another known label
                        if any(k in next_lower for k in ['project', 'country', 'bua', 'bau', 'area', 'contractor', 'architect', 'client', 'scope', 'size', 'quantity']):
                            break
                        # Add continuation if it looks like part of the scope
                        if next_line and not next_line.startswith('**'):
                            value += ' ' + next_line
                        j += 1
                        # Limit scope to reasonable length
                        if len(value) > 200:
                            break
                
                # Clean up value
                value = re.sub(r'^\W+|\W+$', '', value)
                if value and len(value) > 1:
                    data[key] = value
    
    return data

def get_category_from_slide(slide_file: Path) -> str:
    """Extract category name from slide filename"""
    name = slide_file.stem.strip()
    # Remove trailing space if present
    return name.replace(r'\s+$', '')

def find_projects_in_category(ocr_text: str, category: str, existing_projects: List[Dict]) -> List[Dict]:
    """Find projects mentioned in OCR text - looks for lines starting with 'Project'"""
    projects = []
    lines = [l.strip() for l in ocr_text.split('\n') if l.strip()]
    
    # Debug: Log first few lines of OCR text
    log(f"First 15 lines of OCR text:")
    for i, line in enumerate(lines[:15]):
        log(f"  Line {i}: {line}")
    
    # Also log all lines containing "project"
    project_containing_lines = [(i, line) for i, line in enumerate(lines) if 'project' in line.lower()]
    if project_containing_lines:
        log(f"Lines containing 'project' ({len(project_containing_lines)}):")
        for i, line in project_containing_lines:
            log(f"  Line {i}: {line}")
    
    # Strategy 1: Try direct matching of project titles in OCR text FIRST
    # This handles cases where OCR concatenates everything like "ProjectKingAbdulAzizInternationalAirport"
    log("Trying direct project title matching in OCR text...")
    ocr_text_lower = ocr_text.lower()
    ocr_no_spaces = ocr_text_lower.replace(' ', '').replace('&', '').replace(',', '').replace('-', '').replace(':', '')
    
    # Find lines with "project" keyword for proximity matching
    project_line_indices = [i for i, line in enumerate(lines) if 'project' in line.lower()]
    
    for project in existing_projects:
        project_title = project.get('title', '')
        if not project_title or any(p['title'] == project_title for p in projects):
            continue
        
        # Extract key words from project title
        title_words = project_title.split()
        key_words = [w for w in title_words if len(w) > 3 and w.lower() not in ['the', 'and', 'of', 'for', 'in', 'on', 'at', 'to', 'a', 'an']]
        
        if not key_words:
            # For short titles, use the whole title
            key_words = [w for w in title_words if len(w) > 2]
        
        if not key_words:
            continue
        
        # Check if key words appear in OCR text (handle concatenation)
        title_no_spaces = ''.join(title_words).lower().replace('&', '').replace(',', '').replace('-', '').replace(':', '')
        
        # Strategy 1: Check if title (without spaces) appears in OCR (without spaces)
        if title_no_spaces and len(title_no_spaces) > 5 and title_no_spaces in ocr_no_spaces:
            # Find which line contains it
            for i, line in enumerate(lines):
                line_no_spaces = normalize_name(line).replace(' ', '').replace('&', '').replace(',', '').replace('-', '')
                if title_no_spaces in line_no_spaces:
                    projects.append({
                        'title': project_title,
                        'project': project,
                        'line': line,
                        'line_index': i,
                        'found_name': project_title,
                        'match_method': 'no_spaces_match'
                    })
                    log(f"  Direct no-spaces match: '{project_title}' in line {i}")
                    break
            continue
        
        # Strategy 2: Check if enough key words appear (handle concatenation)
        matches = 0
        matched_words = []
        for word in key_words:
            word_lower = word.lower()
            word_no_spaces = word_lower.replace('-', '')
            # Check if word appears in OCR (with or without spaces)
            if word_lower in ocr_text_lower or word_no_spaces in ocr_no_spaces:
                matches += 1
                matched_words.append(word)
        
        # If enough key words match, consider it a match
        required_matches = min(2, len(key_words)) if len(key_words) > 1 else 1
        if matches >= required_matches:
            # Find which line contains the matches (prefer lines with "project")
            best_line_idx = None
            best_line = None
            for i, line in enumerate(lines):
                line_lower = line.lower()
                line_no_spaces = line_lower.replace(' ', '').replace('&', '').replace(',', '').replace('-', '')
                line_matches = sum(1 for word in matched_words if word.lower() in line_lower or word.lower().replace('-', '') in line_no_spaces)
                
                # Prefer lines with "project" keyword
                has_project = 'project' in line_lower
                if line_matches >= required_matches:
                    if best_line_idx is None or (has_project and 'project' not in (lines[best_line_idx].lower() if best_line_idx is not None else '')):
                        best_line_idx = i
                        best_line = line
                        if has_project:
                            break  # Found a project line with matches, use it
            
            if best_line_idx is not None:
                projects.append({
                    'title': project_title,
                    'project': project,
                    'line': best_line,
                    'line_index': best_line_idx,
                    'found_name': project_title,
                    'match_method': 'keyword_match',
                    'matched_words': matched_words
                })
                log(f"  Direct keyword match: '{project_title}' (matched {matches}/{len(key_words)} words: {matched_words}) in line {best_line_idx}")
    
    log(f"Direct matching found {len(projects)} projects")
    
    # First, find all lines that contain "Project" and extract project names
    project_lines = []
    for i, line in enumerate(lines):
        line_lower = line.lower()
        # Look for lines containing "Project" (OCR might have spacing issues)
        if 'project' in line_lower:
            # The OCR text shows patterns like:
            # "ProjectKingAbdulAzizInternationalAirport" (all concatenated)
            # or "Project KingAbdulAziz InternationalAirport" (some spaces)
            # We need to split intelligently
            
            # First, try to split on "Project" keyword
            project_parts = re.split(r'project\s*:?\s*', line, flags=re.IGNORECASE)
            
            for part in project_parts:
                if not part.strip():
                    continue
                    
                # Clean up project name
                project_name = part.strip()
                # Remove bold markers or extra formatting
                project_name = re.sub(r'\*\*', '', project_name).strip()
                # Remove common OCR artifacts
                project_name = re.sub(r'^[^\w&]+', '', project_name)  # Remove leading non-word chars (keep &)
                project_name = re.sub(r'[^\w\s&/-]+$', '', project_name)  # Remove trailing special chars
                
                if project_name and len(project_name) > 3:
                    # Add the full concatenated name as-is
                    project_lines.append({
                        'line_index': i,
                        'project_name': project_name,
                        'full_line': line
                    })
                    log(f"  Found 'Project' line {i}: '{project_name}'")
                    
                    # Try to split concatenated names intelligently
                    # Split on capital letters: "KingAbdulAziz" -> ["King", "Abdul", "Aziz"]
                    words = re.findall(r'[A-Z][a-z]+|[A-Z]+(?=[A-Z]|$)', project_name)
                    
                    if len(words) > 1:
                        # Try progressive combinations to match project titles
                        # "KingAbdulAzizInternationalAirport" -> try "King", "KingAbdul", "KingAbdulAziz", etc.
                        for j in range(1, min(len(words) + 1, 6)):  # Try up to 5-word combinations
                            combined = ''.join(words[:j])
                            if len(combined) > 4:  # Must be meaningful
                                project_lines.append({
                                    'line_index': i,
                                    'project_name': combined,
                                    'full_line': line,
                                    'is_partial': True
                                })
                                log(f"  Found partial 'Project' name {i}: '{combined}' (from: '{project_name}')")
                        
                        # Also try individual significant words
                        for word in words:
                            if len(word) > 5:  # Only significant words
                                project_lines.append({
                                    'line_index': i,
                                    'project_name': word,
                                    'full_line': line,
                                    'is_partial': True
                                })
                                log(f"  Found word 'Project' name {i}: '{word}' (from: '{project_name}')")
    
    log(f"Found {len(project_lines)} 'Project' lines in OCR text")
    
    if len(project_lines) == 0:
        # Try alternative: look for project titles directly in OCR text
        log("No 'Project' lines found, trying direct project title matching...")
        for project in existing_projects:
            project_title = project.get('title', '')
            normalized_title = normalize_name(project_title)
            
            # Check if project title appears anywhere in OCR text
            for i, line in enumerate(lines):
                normalized_line = normalize_name(line)
                # More flexible matching
                if (normalized_title in normalized_line or 
                    normalized_line in normalized_title or
                    any(word in normalized_line for word in normalized_title.split() if len(word) > 3)):
                    if not any(p['title'] == project_title for p in projects):
                        projects.append({
                            'title': project_title,
                            'project': project,
                            'line': line,
                            'line_index': i,
                            'found_name': project_title
                        })
                        log(f"  Direct match: '{project_title}' found in line {i}")
                        break
    
    # Match found project names with existing projects
    for project_line_info in project_lines:
        found_project_name = project_line_info['project_name']
        normalized_found = normalize_name(found_project_name)
        
        # Try to match with existing projects
        best_match = None
        best_score = 0
        
        for project in existing_projects:
            project_title = project.get('title', '')
            normalized_title = normalize_name(project_title)
            
            # More flexible matching - check word overlap
            found_words = set(normalized_found.split())
            title_words = set(normalized_title.split())
            common_words = found_words.intersection(title_words)
            
            # Calculate match score
            score = 0
            if normalized_found == normalized_title:
                score = 100  # Exact match
            elif normalized_found.startswith(normalized_title) or normalized_title.startswith(normalized_found):
                score = 80  # One contains the other
            elif normalized_found in normalized_title or normalized_title in normalized_found:
                score = 70  # Substring match
            elif len(common_words) > 0:
                # Word overlap score
                score = (len(common_words) / max(len(found_words), len(title_words))) * 60
                if len(common_words) >= 2:
                    score += 20  # Bonus for multiple common words
            
            # Also try matching without spaces (for OCR errors like "KingAbdulAziz" vs "King AbdulAziz")
            found_no_spaces = normalized_found.replace(' ', '').replace('-', '').replace('&', '')
            title_no_spaces = normalized_title.replace(' ', '').replace('-', '').replace('&', '')
            if found_no_spaces == title_no_spaces:
                score = max(score, 95)
            elif found_no_spaces in title_no_spaces or title_no_spaces in found_no_spaces:
                score = max(score, 80)
            
            # Try matching word-by-word (handle OCR concatenation)
            # Split found name on capital letters: "KingAbdulAziz" -> ["king", "abdul", "aziz"]
            found_words_split = re.findall(r'[A-Z][a-z]+|[A-Z]+', found_project_name)
            found_words_normalized = [normalize_name(w) for w in found_words_split if len(w) > 2]
            title_words_list = normalized_title.split()
            
            if found_words_normalized:
                # Check if significant words from found name appear in title
                matching_words = [w for w in found_words_normalized if any(tw.startswith(w) or w in tw or tw.startswith(w[:3]) or w.startswith(tw[:3]) for tw in title_words_list)]
                if len(matching_words) >= 2:  # At least 2 words match
                    word_match_ratio = len(matching_words) / max(len(found_words_normalized), len(title_words_list))
                    score = max(score, word_match_ratio * 75)
                elif len(matching_words) == 1 and len(found_words_normalized) == 1:
                    # Single word match - check if it's a significant match
                    if len(matching_words[0]) > 5:  # Significant word
                        score = max(score, 65)
            
            # Additional: Try fuzzy matching on key words
            # Extract key words from title (skip common words)
            common_words = {'the', 'and', 'of', 'for', 'in', 'on', 'at', 'to', 'a', 'an', '&', 'and'}
            title_key_words = [w for w in title_words_list if w not in common_words and len(w) > 3]
            found_key_words = [w for w in found_words_normalized if len(w) > 3]
            
            if title_key_words and found_key_words:
                # Check if any key word from title appears in found name (or vice versa)
                for tw in title_key_words:
                    for fw in found_key_words:
                        if tw == fw or tw.startswith(fw) or fw.startswith(tw) or (len(tw) > 4 and len(fw) > 4 and (tw[:4] == fw[:4] or tw[-4:] == fw[-4:])):
                            score = max(score, 70)
                            break
                
                # Also check if multiple key words match
                key_matches = sum(1 for tw in title_key_words for fw in found_key_words if tw == fw or tw.startswith(fw) or fw.startswith(tw))
                if key_matches >= 2:
                    score = max(score, 75)
            
            # Lower score for partial matches (marked with is_partial)
            if project_line_info.get('is_partial'):
                score = score * 0.7  # Reduce score for partial matches
            
            if score > best_score:
                best_score = score
                best_match = project
        
        # Use best match if score is above threshold
        if best_match and best_score >= 40:  # Lowered threshold to 40 for better matching
            project_title = best_match.get('title', '')
            # Check if we already added this project
            if not any(p['title'] == project_title for p in projects):
                projects.append({
                    'title': project_title,
                    'project': best_match,
                    'line': project_line_info['full_line'],
                    'line_index': project_line_info['line_index'],
                    'found_name': found_project_name
                })
                log(f"Matched: '{found_project_name}' -> '{project_title}' (score: {best_score:.1f})")
        elif best_match:
            log(f"No match for '{found_project_name}' (best score: {best_score:.1f} < 40, best candidate: '{best_match.get('title', '')}')")
    
    log(f"Total projects matched: {len(projects)}")
    return projects

def process_slide(slide_path: Path, category: str, existing_projects: List[Dict]) -> Dict:
    """Process a slide and extract project data"""
    log(f"\n=== Processing slide: {slide_path.name} ===")
    
    # Extract text using OCR
    ocr_text = extract_text_from_slide(slide_path, use_preprocessing=True)
    
    if not ocr_text or len(ocr_text.strip()) < 10:
        log(f"WARNING: No text extracted from {slide_path.name}")
        return {'extracted': [], 'raw_text': ocr_text}
    
    log(f"Extracted {len(ocr_text)} characters of text")
    
    # Save raw OCR text for debugging (first 2000 chars)
    debug_file = LOG_FILE.parent / f"ocr_debug_{slide_path.stem}.txt"
    with open(debug_file, 'w', encoding='utf-8') as f:
        f.write(f"=== OCR Text for {slide_path.name} ===\n\n")
        f.write(ocr_text[:2000])
        f.write("\n\n=== First 30 lines ===\n")
        for i, line in enumerate(ocr_text.split('\n')[:30]):
            f.write(f"{i:2d}: {line}\n")
    log(f"Debug OCR text saved to: {debug_file.name}")
    
    # Find projects in this slide
    found_projects = find_projects_in_category(ocr_text, category, existing_projects)
    
    log(f"Found {len(found_projects)} projects in slide")
    
    extracted_data = []
    
    # For each found project, extract its data
    for found in found_projects:
        project_title = found['title']
        project = found['project']
        line_index = found.get('line_index', 0)
        
        log(f"\nExtracting data for: {project_title}")
        log(f"  Found at line {line_index}: {found.get('found_name', project_title)}")
        
        # Extract data from section starting at the project line
        # Get lines from project line to next project or end (max 30 lines)
        lines = ocr_text.split('\n')
        start_index = line_index
        end_index = min(len(lines), start_index + 30)
        
        # Look for next "Project" line to limit the section
        for i in range(start_index + 1, len(lines)):
            if i >= end_index:
                break
            if lines[i].strip().lower().startswith('project'):
                end_index = i
                break
        
        # Extract section for this project
        project_section = '\n'.join(lines[start_index:end_index])
        log(f"  Processing section ({end_index - start_index} lines)")
        
        # Extract data from this project's section
        extracted = parse_project_data(project_section, project_title)
        
        extracted_data.append({
            'project': project_title,
            'data': extracted,
            'raw_text': project_section[:500]  # First 500 chars for reference
        })
        
        log(f"Extracted data: {json.dumps(extracted, indent=2)}")
    
    return {'extracted': extracted_data, 'raw_text': ocr_text}

def extract_project_data_from_slides():
    """Main function to extract data from all slides"""
    # Clear log file
    if LOG_FILE.exists():
        LOG_FILE.unlink()
    
    log('=== Starting OCR-based Project Data Extraction ===')
    log(f"Base directory: {BASE_DIR}")
    
    if not PROJECTS_JSON.exists():
        log("ERROR: projects.json not found!")
        sys.exit(1)
    
    if not PROJECT_SLIDES_DIR.exists():
        log("ERROR: Project slides directory not found!")
        sys.exit(1)
    
    # Check if Tesseract is available
    try:
        pytesseract.get_tesseract_version()
        log("Tesseract OCR is available")
    except Exception as e:
        log(f"ERROR: Tesseract OCR not found. Please install Tesseract OCR.")
        log(f"Windows: https://github.com/UB-Mannheim/tesseract/wiki")
        log(f"Mac: brew install tesseract")
        log(f"Linux: apt-get install tesseract-ocr")
        sys.exit(1)
    
    # Load existing projects
    with open(PROJECTS_JSON, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    projects = data.get('projects', [])
    log(f"Loaded {len(projects)} projects")
    
    # Get all slide files
    slide_files = [
        f for f in PROJECT_SLIDES_DIR.iterdir()
        if f.is_file() and f.suffix.lower() in ['.jpg', '.jpeg', '.png']
    ]
    
    log(f"Found {len(slide_files)} slide files")
    
    all_extracted_data = []
    updates = []
    unclear_data = []
    
    # Process each slide
    for slide_path in slide_files:
        category = get_category_from_slide(slide_path)
        log(f"\n\n=== Processing category: {category} ===")
        
        # Get projects in this category
        category_projects = [
            p for p in projects
            if category in p.get('categories', [])
        ]
        
        log(f"Found {len(category_projects)} projects in category: {category}")
        
        result = process_slide(slide_path, category, category_projects)
        all_extracted_data.append({
            'category': category,
            'slide': slide_path.name,
            'extracted': result['extracted'],
            'raw_text': result['raw_text'][:1000]  # First 1000 chars
        })
        
        # Update projects with extracted data
        for extracted in result['extracted']:
            project = next((p for p in projects if p.get('title') == extracted['project']), None)
            if project:
                updated = False
                update_log = []
                
                for key, value in extracted['data'].items():
                    if value and value.strip():
                        # Only update if field is empty or very short
                        current_value = project.get(key, '').strip()
                        if not current_value or len(current_value) < 3:
                            project[key] = value
                            updated = True
                            update_log.append(f"{key}: {value}")
                
                if updated:
                    updates.append({
                        'project': extracted['project'],
                        'updates': update_log
                    })
                    log(f"Updated {extracted['project']}: {', '.join(update_log)}")
    
    # Save updated projects.json
    with open(PROJECTS_JSON, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    
    log(f"\n✓ Saved updated projects.json")
    
    # Generate report
    generate_ocr_report(all_extracted_data, updates, unclear_data)
    
    return {
        'slides_processed': len(slide_files),
        'projects_updated': len(updates),
        'total_updates': sum(len(u['updates']) for u in updates)
    }

def generate_ocr_report(all_extracted_data: List[Dict], updates: List[Dict], unclear_data: List[Dict]):
    """Generate OCR extraction report"""
    report_lines = [
        '# OCR Project Data Extraction Report',
        '',
        f'Generated: {datetime.now().isoformat()}',
        '',
        '## Summary',
        f'- Slides Processed: {len(all_extracted_data)}',
        f'- Projects Updated: {len(updates)}',
        f'- Total Field Updates: {sum(len(u["updates"]) for u in updates)}',
        '',
        '## Updates Made',
        ''
    ]
    
    if updates:
        for update in updates:
            report_lines.append(f'### {update["project"]}')
            for field_update in update['updates']:
                report_lines.append(f'- {field_update}')
            report_lines.append('')
    else:
        report_lines.append('No updates were made.')
        report_lines.append('')
    
    report_lines.append('## Extracted Data by Slide')
    report_lines.append('')
    
    for slide_data in all_extracted_data:
        report_lines.append(f'### {slide_data["category"]} ({slide_data["slide"]})')
        report_lines.append(f'Projects found: {len(slide_data["extracted"])}')
        report_lines.append('')
        
        for extracted in slide_data['extracted']:
            report_lines.append(f'#### {extracted["project"]}')
            for key, value in extracted['data'].items():
                if value:
                    report_lines.append(f'- **{key}**: {value}')
            report_lines.append('')
        
        if not slide_data['extracted']:
            report_lines.append('*No projects identified in this slide*')
            report_lines.append('')
    
    # Write report
    REPORT_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(REPORT_FILE, 'w', encoding='utf-8') as f:
        f.write('\n'.join(report_lines))
    
    log(f"✓ Report saved to: {REPORT_FILE}")

if __name__ == "__main__":
    try:
        results = extract_project_data_from_slides()
        log('\n=== Extraction Complete ===')
        log(f"Slides processed: {results['slides_processed']}")
        log(f"Projects updated: {results['projects_updated']}")
        log(f"Total field updates: {results['total_updates']}")
        log(f"\nLog saved to: {LOG_FILE}")
        log(f"Report saved to: {REPORT_FILE}")
    except Exception as e:
        log(f"ERROR: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)






