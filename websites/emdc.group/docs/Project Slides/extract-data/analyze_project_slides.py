"""
Script to analyze project slides and update projects.json
This script:
1. Analyzes project slides to extract project information
2. Matches projects with photos from CONSULT EMDC Projects Photos folder
3. Updates projects.json accordingly
4. Copies images to public/projects/{folder_name}/{project_image}
5. Creates a report of unclear data and missing images

Note: Script is in docs/Project Slides/extract-data/, paths are relative to project root
"""

import json
import os
import shutil
import sys
from pathlib import Path
from typing import Dict, List, Tuple, Optional
import re
from datetime import datetime

# Paths
# Script is in docs/Project Slides/extract-data/, so go up 3 levels to project root
BASE_DIR = Path(__file__).parent.parent.parent
PROJECT_SLIDES_DIR = BASE_DIR / "docs" / "Project Slides"
PROJECT_PHOTOS_DIR = BASE_DIR / "docs" / "CONSULT EMDC Projects Photos"
PROJECTS_JSON = BASE_DIR / "data" / "projects.json"
PUBLIC_PROJECTS_DIR = BASE_DIR / "public" / "projects"
REPORT_FILE = BASE_DIR / "docs" / "Project Slides" / "analysis_report.md"

def normalize_name(name: str) -> str:
    """Normalize project name for matching"""
    # Remove special characters, convert to lowercase, remove extra spaces
    name = re.sub(r'[^\w\s-]', '', name)
    name = re.sub(r'\s+', ' ', name)
    return name.strip().lower()

def create_slug(name: str) -> str:
    """Create URL-friendly slug from name"""
    slug = re.sub(r'[^\w\s-]', '', name)
    slug = re.sub(r'[-\s]+', '-', slug)
    return slug.lower().strip('-')

def get_project_photos_by_category() -> Dict[str, List[Dict]]:
    """Get all project photos organized by category"""
    photos_by_category = {}
    
    if not PROJECT_PHOTOS_DIR.exists():
        return photos_by_category
    
    for category_folder in PROJECT_PHOTOS_DIR.iterdir():
        if category_folder.is_dir():
            category_name = category_folder.name
            photos = []
            
            for photo_file in category_folder.iterdir():
                if photo_file.is_file() and photo_file.suffix.lower() in ['.jpg', '.jpeg', '.png', '.webp']:
                    photos.append({
                        'filename': photo_file.name,
                        'path': photo_file,
                        'category': category_name
                    })
            
            photos_by_category[category_name] = photos
    
    return photos_by_category

def find_matching_photo(project_title: str, category: str, photos_by_category: Dict) -> Optional[Dict]:
    """Find matching photo for a project"""
    if category not in photos_by_category:
        return None
    
    normalized_title = normalize_name(project_title)
    
    for photo in photos_by_category[category]:
        photo_name = normalize_name(Path(photo['filename']).stem)
        
        # Try exact match
        if normalized_title == photo_name:
            return photo
        
        # Try partial match (project name contains photo name or vice versa)
        if normalized_title in photo_name or photo_name in normalized_title:
            return photo
    
    return None

def get_category_from_slide_filename(slide_file: Path) -> str:
    """Extract category name from slide filename"""
    name = slide_file.stem
    # Remove trailing space if present
    name = name.strip()
    return name

def copy_project_image(source_path: Path, dest_folder: Path, image_name: str) -> bool:
    """Copy project image to destination folder"""
    try:
        dest_folder.mkdir(parents=True, exist_ok=True)
        dest_path = dest_folder / image_name
        
        if source_path.exists():
            shutil.copy2(source_path, dest_path)
            return True
        return False
    except Exception as e:
        print(f"Error copying {source_path} to {dest_folder}: {e}")
        return False

def analyze_and_update_projects():
    """Main function to analyze slides and update projects.json"""
    
    # Load existing projects
    with open(PROJECTS_JSON, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    projects = data.get('projects', [])
    categories = data.get('categories', [])
    
    # Get project photos by category
    photos_by_category = get_project_photos_by_category()
    
    # Track updates and issues
    updates = []
    missing_images = []
    unclear_data = []
    projects_updated = 0
    images_copied = 0
    
    # Process each project
    for project in projects:
        project_title = project.get('title', '')
        project_categories = project.get('categories', [])
        folder_name = project.get('folder_name', '')
        current_image = project.get('project_image', '')
        
        # Find matching photo for each category
        photo_found = False
        for category in project_categories:
            if category in photos_by_category:
                matching_photo = find_matching_photo(project_title, category, photos_by_category)
                
                if matching_photo:
                    photo_found = True
                    source_path = matching_photo['path']
                    
                    # Determine image name (use folder_name if available, otherwise create from title)
                    if not folder_name:
                        folder_name = create_slug(project_title)
                        project['folder_name'] = folder_name
                    
                    # Use original filename but normalize it
                    image_name = matching_photo['filename']
                    
                    # Update project_image if different
                    if current_image != image_name:
                        project['project_image'] = image_name
                        updates.append(f"Updated image for '{project_title}': {current_image} -> {image_name}")
                    
                    # Copy image to public/projects folder
                    dest_folder = PUBLIC_PROJECTS_DIR / folder_name
                    if copy_project_image(source_path, dest_folder, image_name):
                        images_copied += 1
                    else:
                        missing_images.append({
                            'project': project_title,
                            'source': str(source_path),
                            'destination': str(dest_folder / image_name)
                        })
                    
                    break
        
        if not photo_found:
            # Check if image already exists in public folder
            if folder_name:
                project_folder = PUBLIC_PROJECTS_DIR / folder_name
                if project_folder.exists() and current_image:
                    image_path = project_folder / current_image
                    if not image_path.exists():
                        missing_images.append({
                            'project': project_title,
                            'category': project_categories,
                            'expected_image': current_image,
                            'note': 'Photo not found in source folder'
                        })
            else:
                unclear_data.append({
                    'project': project_title,
                    'issue': 'No folder_name and no matching photo found',
                    'categories': project_categories
                })
        
        # Update URL if missing
        if not project.get('url'):
            project['url'] = folder_name or create_slug(project_title)
    
    # Save updated projects.json
    with open(PROJECTS_JSON, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    
    projects_updated = len(updates)
    
    # Generate report
    generate_report(updates, missing_images, unclear_data, projects_updated, images_copied, photos_by_category)
    
    return {
        'projects_updated': projects_updated,
        'images_copied': images_copied,
        'missing_images': len(missing_images),
        'unclear_data': len(unclear_data)
    }

def generate_report(updates: List[str], missing_images: List[Dict], unclear_data: List[Dict], 
                   projects_updated: int, images_copied: int, photos_by_category: Dict):
    """Generate analysis report"""
    
    report_lines = [
        "# Project Slides Analysis Report",
        "",
        f"Generated: {Path(__file__).stat().st_mtime}",
        "",
        "## Summary",
        f"- Projects Updated: {projects_updated}",
        f"- Images Copied: {images_copied}",
        f"- Missing Images: {len(missing_images)}",
        f"- Unclear Data Items: {len(unclear_data)}",
        "",
        "## Available Photos by Category",
        ""
    ]
    
    # List available photos
    for category, photos in photos_by_category.items():
        report_lines.append(f"### {category}")
        report_lines.append(f"Total photos: {len(photos)}")
        for photo in photos:
            report_lines.append(f"- {photo['filename']}")
        report_lines.append("")
    
    # Missing images
    if missing_images:
        report_lines.extend([
            "## Missing Images",
            ""
        ])
        for item in missing_images:
            report_lines.append(f"### {item['project']}")
            for key, value in item.items():
                if key != 'project':
                    report_lines.append(f"- {key}: {value}")
            report_lines.append("")
    
    # Unclear data
    if unclear_data:
        report_lines.extend([
            "## Unclear Data",
            ""
        ])
        for item in unclear_data:
            report_lines.append(f"### {item['project']}")
            for key, value in item.items():
                if key != 'project':
                    report_lines.append(f"- {key}: {value}")
            report_lines.append("")
    
    # Updates made
    if updates:
        report_lines.extend([
            "## Updates Made",
            ""
        ])
        for update in updates:
            report_lines.append(f"- {update}")
        report_lines.append("")
    
    # Write report
    REPORT_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(REPORT_FILE, 'w', encoding='utf-8') as f:
        f.write('\n'.join(report_lines))
    
    print(f"Report saved to: {REPORT_FILE}")

if __name__ == "__main__":
    log_file = BASE_DIR / "docs" / "Project Slides" / "extract-data" / "analysis_log.txt"
    
    def log(message):
        """Log message to both console and file"""
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        log_message = f"[{timestamp}] {message}"
        print(log_message)
        with open(log_file, 'a', encoding='utf-8') as f:
            f.write(log_message + '\n')
    
    try:
        # Clear previous log
        if log_file.exists():
            log_file.unlink()
        
        log("Starting project slides analysis...")
        log(f"Base directory: {BASE_DIR}")
        log(f"Projects JSON exists: {PROJECTS_JSON.exists()}")
        log(f"Project photos dir exists: {PROJECT_PHOTOS_DIR.exists()}")
        log(f"Public projects dir exists: {PUBLIC_PROJECTS_DIR.exists()}")
        
        if not PROJECTS_JSON.exists():
            log("ERROR: projects.json not found!")
            sys.exit(1)
        
        if not PROJECT_PHOTOS_DIR.exists():
            log("WARNING: Project photos directory not found!")
        
        results = analyze_and_update_projects()
        log(f"\nAnalysis complete!")
        log(f"Projects updated: {results['projects_updated']}")
        log(f"Images copied: {results['images_copied']}")
        log(f"Missing images: {results['missing_images']}")
        log(f"Unclear data items: {results['unclear_data']}")
        log(f"\nReport saved to: {REPORT_FILE}")
        log(f"Log saved to: {log_file}")
    except Exception as e:
        error_msg = f"Error: {e}"
        log(error_msg)
        import traceback
        traceback_str = traceback.format_exc()
        log(traceback_str)
        print(traceback_str)
        sys.exit(1)






