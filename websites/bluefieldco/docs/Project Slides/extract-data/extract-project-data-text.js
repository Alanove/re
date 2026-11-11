/**
 * Extract project data from plain text file (project-text.txt)
 * This is the most accurate method - uses actual text content, no OCR needed.
 * 
 * Structure:
 * - Categories are separated by ": © 2024"
 * - Projects are separated by the word "Project" on its own line
 * - Each property is on a separate line (Country, BUA, Area, Contractor, etc.)
 * 
 * Run with: node extract-project-data-text.js
 */

const fs = require('fs');
const path = require('path');

// Base directory (project root - 3 levels up from this script)
// Script is at: docs/Project Slides/extract-data/extract-project-data-text.js
// Need to go to: emdc-website (project root)
const BASE_DIR = path.resolve(__dirname, '..', '..', '..');
const PROJECT_TEXT_FILE = path.join(BASE_DIR, 'docs', 'Project Slides', 'project-text.txt');
const PROJECTS_JSON = path.join(BASE_DIR, 'data', 'projects.json');
const LOG_FILE = path.join(BASE_DIR, 'docs', 'Project Slides', 'extract-data', 'text_extraction_log.txt');
const REPORT_FILE = path.join(BASE_DIR, 'docs', 'Project Slides', 'text_extraction_report.md');

// Ensure log directory exists
const logDir = path.dirname(LOG_FILE);
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
}

function log(message) {
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const logMessage = `[${timestamp}] ${message}`;
    console.log(logMessage);
    try {
        fs.appendFileSync(LOG_FILE, logMessage + '\n', 'utf8');
    } catch (err) {
        // If log file write fails, at least print to console
        console.error('Log write error:', err.message);
    }
}

function normalizeName(name) {
    return name.toLowerCase().replace(/[^\w\s]/g, '').trim();
}

function createSlug(name) {
    return name.toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim();
}

function findProjectImage(projectTitle, categoryName) {
    const photosDir = path.join(BASE_DIR, 'docs', 'CONSULT EMDC Projects Photos', categoryName);
    if (!fs.existsSync(photosDir)) {
        return null;
    }
    
    const files = fs.readdirSync(photosDir);
    const normalizedTitle = normalizeName(projectTitle);
    
    // Try exact match first
    for (const file of files) {
        if (file.toLowerCase().endsWith('.jpg') || file.toLowerCase().endsWith('.jpeg') || 
            file.toLowerCase().endsWith('.png') || file.toLowerCase().endsWith('.webp')) {
            const fileName = path.parse(file).name;
            const normalizedFile = normalizeName(fileName);
            if (normalizedFile === normalizedTitle || normalizedFile.includes(normalizedTitle) || normalizedTitle.includes(normalizedFile)) {
                return file;
            }
        }
    }
    
    return null;
}

function parseProjectSection(lines, startIdx) {
    const data = {
        bau: '',
        area: '',
        size: '',
        quantity: '',
        contractor: '',
        architect: '',
        client: '',
        scope: '',
        country: '',
        land: '',
        capacity: '',
        districts: '',
        owner: '',
        consultant: '',
        title: ''
    };
    
    // Project name is ALWAYS on the line immediately after "Project"
    const projectLine = lines[startIdx].trim();
    let currentIdx;
    
    if (projectLine.toLowerCase() === 'project') {
        // Project name is ALWAYS on the next line - no exceptions
        if (startIdx + 1 < lines.length) {
            const nextLine = lines[startIdx + 1].trim();
            // The next line is ALWAYS the project name (even if it looks like a field label)
            // Only skip if it's empty
            if (nextLine) {
                data.title = nextLine;
                currentIdx = startIdx + 2;
            } else {
                // Empty line after Project - no title
                currentIdx = startIdx + 1;
            }
        } else {
            // No next line - no title
            currentIdx = startIdx + 1;
        }
    } else {
        // "Project" should be on its own line, but handle edge case where it's on same line
        data.title = projectLine.replace(/^project\s*:?\s*/i, '').trim();
        currentIdx = startIdx + 1;
    }
    
    // Parse fields until we hit the next "Project" marker
    let i = currentIdx;
    while (i < lines.length) {
        const line = lines[i].trim();
        
        // Stop if we hit another "Project" marker (exact match on its own line)
        if (line.toLowerCase() === 'project') {
            break;
        }
        
        // Skip empty lines
        if (!line) {
            i++;
            continue;
        }
        
        const lineLower = line.toLowerCase();
        
        // Parse Country (value on next line)
        if (!data.country && lineLower.startsWith('country')) {
            if (i + 1 < lines.length) {
                const nextLine = lines[i + 1].trim();
                if (nextLine && !nextLine.toLowerCase().match(/^(project|country|bua|area|contractor|architect|client|scope|size|quantity|consultant|districts|capacity|land|owner)/)) {
                    data.country = nextLine;
                    i += 2;
                    continue;
                }
            }
            i++;
            continue;
        }
        
        // Parse BUA (Built-Up Area) (value on next line)
        if (!data.bau && (lineLower.includes('bua') || (lineLower.includes('built') && lineLower.includes('area')))) {
            if (i + 1 < lines.length) {
                const nextLine = lines[i + 1].trim();
                if (nextLine && !nextLine.toLowerCase().match(/^(project|country|bua|area|contractor|architect|client|scope|size|quantity|consultant|districts|capacity|land|owner)/)) {
                    data.bau = nextLine;
                    i += 2;
                    continue;
                }
            }
            i++;
            continue;
        }
        
        // Parse Area (value on next line)
        if (!data.area && lineLower.startsWith('area')) {
            if (i + 1 < lines.length) {
                const nextLine = lines[i + 1].trim();
                if (nextLine && !nextLine.toLowerCase().match(/^(project|country|bua|area|contractor|architect|client|scope|size|quantity|consultant|districts|capacity|land|owner)/)) {
                    data.area = nextLine;
                    i += 2;
                    continue;
                }
            }
            i++;
            continue;
        }
        
        // Parse Size (value on next line)
        if (!data.size && lineLower.startsWith('size')) {
            if (i + 1 < lines.length) {
                const nextLine = lines[i + 1].trim();
                if (nextLine && !nextLine.toLowerCase().match(/^(project|country|bua|area|contractor|architect|client|scope|size|quantity|consultant|districts|capacity|land|owner)/)) {
                    data.size = nextLine;
                    i += 2;
                    continue;
                }
            }
            i++;
            continue;
        }
        
        // Parse Quantity (value on next line)
        if (!data.quantity && lineLower.startsWith('quantity')) {
            if (i + 1 < lines.length) {
                const nextLine = lines[i + 1].trim();
                if (nextLine && !nextLine.toLowerCase().match(/^(project|country|bua|area|contractor|architect|client|scope|size|quantity|consultant|districts|capacity|land|owner)/)) {
                    data.quantity = nextLine;
                    i += 2;
                    continue;
                }
            }
            i++;
            continue;
        }
        
        // Parse Contractor (value on next line)
        if (!data.contractor && lineLower.startsWith('contractor')) {
            if (i + 1 < lines.length) {
                const nextLine = lines[i + 1].trim();
                if (nextLine && !nextLine.toLowerCase().match(/^(project|country|bua|area|contractor|architect|client|scope|size|quantity|consultant|districts|capacity|land|owner)/)) {
                    data.contractor = nextLine;
                    i += 2;
                    continue;
                }
            }
            i++;
            continue;
        }
        
        // Parse Consultant (value on next line, map to contractor if contractor is empty)
        if (!data.contractor && lineLower.startsWith('consultant')) {
            if (i + 1 < lines.length) {
                const nextLine = lines[i + 1].trim();
                if (nextLine && !nextLine.toLowerCase().match(/^(project|country|bua|area|contractor|architect|client|scope|size|quantity|consultant|districts|capacity|land|owner)/)) {
                    data.contractor = nextLine;
                    i += 2;
                    continue;
                }
            }
            i++;
            continue;
        }
        
        // Parse Architect (value on next line)
        if (!data.architect && lineLower.startsWith('architect')) {
            if (i + 1 < lines.length) {
                const nextLine = lines[i + 1].trim();
                if (nextLine && !nextLine.toLowerCase().match(/^(project|country|bua|area|contractor|architect|client|scope|size|quantity|consultant|districts|capacity|land|owner)/)) {
                    data.architect = nextLine;
                    i += 2;
                    continue;
                }
            }
            i++;
            continue;
        }
        
        // Parse Client (value on next line)
        if (!data.client && lineLower.startsWith('client')) {
            if (i + 1 < lines.length) {
                const nextLine = lines[i + 1].trim();
                if (nextLine && !nextLine.toLowerCase().match(/^(project|country|bua|area|contractor|architect|client|scope|size|quantity|consultant|districts|capacity|land|owner)/)) {
                    data.client = nextLine;
                    i += 2;
                    continue;
                }
            }
            i++;
            continue;
        }
        
        // Parse Owner (value on next line, map to client if client is empty)
        if (!data.client && lineLower.startsWith('owner')) {
            if (i + 1 < lines.length) {
                const nextLine = lines[i + 1].trim();
                if (nextLine && !nextLine.toLowerCase().match(/^(project|country|bua|area|contractor|architect|client|scope|size|quantity|consultant|districts|capacity|land|owner)/)) {
                    data.client = nextLine;
                    i += 2;
                    continue;
                }
            }
            i++;
            continue;
        }
        
        // Parse Land (value on next line)
        if (!data.land && lineLower.startsWith('land')) {
            if (i + 1 < lines.length) {
                const nextLine = lines[i + 1].trim();
                if (nextLine && !nextLine.toLowerCase().match(/^(project|country|bua|area|contractor|architect|client|scope|size|quantity|consultant|districts|capacity|land|owner)/)) {
                    data.land = nextLine;
                    i += 2;
                    continue;
                }
            }
            i++;
            continue;
        }
        
        // Parse Capacity (value on next line)
        if (!data.capacity && lineLower.startsWith('capacity')) {
            if (i + 1 < lines.length) {
                const nextLine = lines[i + 1].trim();
                if (nextLine && !nextLine.toLowerCase().match(/^(project|country|bua|area|contractor|architect|client|scope|size|quantity|consultant|districts|capacity|land|owner)/)) {
                    data.capacity = nextLine;
                    i += 2;
                    continue;
                }
            }
            i++;
            continue;
        }
        
        // Parse Districts (value on next line)
        if (!data.districts && lineLower.startsWith('districts')) {
            if (i + 1 < lines.length) {
                const nextLine = lines[i + 1].trim();
                if (nextLine && !nextLine.toLowerCase().match(/^(project|country|bua|area|contractor|architect|client|scope|size|quantity|consultant|districts|capacity|land|owner)/)) {
                    data.districts = nextLine;
                    i += 2;
                    continue;
                }
            }
            i++;
            continue;
        }
        
        // Parse Scope (value on next line, sometimes 2-3 lines)
        // Scope continues until we hit another "Project" marker
        if (lineLower.startsWith('scope')) {
            const scopeLines = [];
            
            // Read value from next line(s) - continue until we hit "Project" marker
            let j = i + 1;
            while (j < lines.length) {
                const nextLine = lines[j].trim();
                
                // Stop if we hit another "Project" marker (exact match on its own line)
                if (nextLine.toLowerCase() === 'project') {
                    break;
                }
                
                // Stop if we hit another field label (exact match at start of line)
                if (nextLine && nextLine.toLowerCase().match(/^(country|bua|bau|area|size|quantity|contractor|architect|client|consultant|districts|capacity|land|owner)\s*$/)) {
                    break;
                }
                
                // Skip empty lines (but continue - they might be within scope)
                if (!nextLine) {
                    j++;
                    continue;
                }
                
                scopeLines.push(nextLine);
                j++;
                
                // Scope is typically 1-3 lines, but allow up to 5 for safety
                if (scopeLines.length >= 5) {
                    break;
                }
            }
            
            if (scopeLines.length > 0) {
                data.scope = scopeLines.join(' ');
                i = j; // Move to the line after scope (which should be "Project" or next field)
                continue;
            }
            i++;
            continue;
        }
        
        i++;
    }
    
    return data;
}

function findProjectsInCategory(textLines, category) {
    const projects = [];
    
    // Find all "Project" markers (must be on its own line, not part of scope text)
    const projectIndices = [];
    for (let i = 0; i < textLines.length; i++) {
        const line = textLines[i].trim();
        // Only match "Project" on its own line (exact match, case insensitive)
        if (line.toLowerCase() === 'project') {
            projectIndices.push(i);
        }
    }
    
    log(`Found ${projectIndices.length} 'Project' markers in category '${category}'`);
    
    // Parse each project section
    for (let i = 0; i < projectIndices.length; i++) {
        const projIdx = projectIndices[i];
        
        // Debug: Show what line we're looking at
        const projLine = textLines[projIdx] ? textLines[projIdx].trim() : 'EMPTY';
        const nextLine = projIdx + 1 < textLines.length ? textLines[projIdx + 1].trim() : 'EMPTY';
        log(`  Processing Project marker at index ${projIdx}: '${projLine}' -> next line: '${nextLine}'`);
        
        // Parse project data
        const projectData = parseProjectSection(textLines, projIdx);
        
        if (!projectData.title) {
            log(`  WARNING: Project at line ${projIdx} has no title - skipping`);
            continue;
        }
        
        const projectTitle = projectData.title;
        log(`  Found project: '${projectTitle}'`);
        
        // Create new project object
        const slug = createSlug(projectTitle);
        const projectImage = findProjectImage(projectTitle, category);
        
        const newProject = {
            title: projectTitle,
            folder_name: slug,
            project_image: projectImage || `${slug}.jpg`,
            categories: [category],
            works: [],
            url: slug,
            bau: projectData.bau || '',
            area: projectData.area || '',
            size: projectData.size || '',
            quantity: projectData.quantity || '',
            contractor: projectData.contractor || '',
            architect: projectData.architect || '',
            client: projectData.client || '',
            scope: projectData.scope || '',
            country: projectData.country || '',
            land: projectData.land || '',
            capacity: projectData.capacity || '',
            districts: projectData.districts || '',
            owner: projectData.owner || '',
            consultant: projectData.consultant || ''
        };
        
        projects.push({
            title: projectTitle,
            project: newProject,
            data: projectData,
            foundName: projectTitle
        });
    }
    
    log(`Total projects found in category '${category}': ${projects.length}`);
    return projects;
}

function extractProjectDataFromText() {
    try {
        // Clear log file (logDir is already defined at top of file)
        fs.writeFileSync(LOG_FILE, '', 'utf8');
        
        log('=== Starting Text-based Project Data Extraction ===');
        log(`Base directory: ${BASE_DIR}`);
        log(`Reading from: ${PROJECT_TEXT_FILE}`);
        
        // Read text file
        if (!fs.existsSync(PROJECT_TEXT_FILE)) {
            log(`ERROR: Text file not found: ${PROJECT_TEXT_FILE}`);
            console.error(`ERROR: Text file not found: ${PROJECT_TEXT_FILE}`);
            return;
        }
        
        const textContent = fs.readFileSync(PROJECT_TEXT_FILE, 'utf8');
        log(`Read ${textContent.length} characters from text file`);
        
        // Split by empty lines (categories are separated by empty lines)
        // Process line by line to properly handle empty lines
        const lines = textContent.split('\n');
        const categories = [];
        let currentCategory = [];
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            // If we hit an empty line and current category has content, start new category
            if (!line && currentCategory.length > 0) {
                categories.push(currentCategory.join('\n'));
                currentCategory = [];
            } else if (line) {
                currentCategory.push(lines[i]); // Keep original line with whitespace
            }
        }
        // Add last category
        if (currentCategory.length > 0) {
            categories.push(currentCategory.join('\n'));
        }
        
        log(`Found ${categories.length} categories`);
        
        // Debug: Show first few categories
        for (let i = 0; i < Math.min(3, categories.length); i++) {
            const firstLines = categories[i].split('\n').slice(0, 3).join(' | ');
            log(`  Category ${i} starts with: ${firstLines.substring(0, 100)}`);
        }
        
        // Load existing projects.json structure (to preserve other fields if needed)
        let projectsData;
        try {
            projectsData = JSON.parse(fs.readFileSync(PROJECTS_JSON, 'utf8'));
        } catch (err) {
            projectsData = { projects: [] };
        }
        
        const allExtracted = [];
        const newProjects = [];
        
        // Process each category
        for (let catIdx = 0; catIdx < categories.length; catIdx++) {
            const categoryText = categories[catIdx];
            if (!categoryText.trim()) {
                continue;
            }
            
            const lines = categoryText.split('\n').map(l => l.trimEnd());
            
            // First non-empty line should be category name
            let categoryName = '';
            for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
                const trimmed = lines[lineIdx].trim();
                if (trimmed) {
                    categoryName = trimmed;
                    break;
                }
            }
            
            if (!categoryName) {
                continue;
            }
            
            log(`\n=== Processing category: ${categoryName} ===`);
            
            // Find and parse all projects in this category (no matching needed - create new)
            // Skip the first line (category name) when processing
            const categoryLines = lines.slice(1);
            const foundProjects = findProjectsInCategory(categoryLines, categoryName);
            allExtracted.push(...foundProjects);
            
            // Add all projects to the new projects array
            for (const item of foundProjects) {
                newProjects.push(item.project);
                log(`  Created project: '${item.title}'`);
            }
        }
        
        // Replace all projects with new ones
        projectsData.projects = newProjects;
        
        // Save updated projects.json
        fs.writeFileSync(PROJECTS_JSON, JSON.stringify(projectsData, null, 2), 'utf8');
        log(`\n✓ Saved updated projects.json with ${newProjects.length} projects`);
        
        // Generate report
        const reportLines = [
            '# Text Extraction Report - Complete Rebuild',
            `Generated: ${new Date().toISOString().replace('T', ' ').substring(0, 19)}`,
            '',
            `Categories processed: ${categories.length}`,
            `Projects created: ${newProjects.length}`,
            '',
            '## Summary by Category',
            ''
        ];
        
        // Group by category
        const projectsByCategory = {};
        for (const item of allExtracted) {
            const category = item.project.categories[0];
            if (!projectsByCategory[category]) {
                projectsByCategory[category] = [];
            }
            projectsByCategory[category].push(item);
        }
        
        for (const [category, items] of Object.entries(projectsByCategory)) {
            reportLines.push(`### ${category} (${items.length} projects)`);
            for (const item of items) {
                reportLines.push(`- **${item.title}**`);
                reportLines.push(`  - Country: ${item.data.country || 'N/A'}`);
                reportLines.push(`  - BUA: ${item.data.bau || 'N/A'}`);
                reportLines.push(`  - Contractor: ${item.data.contractor || 'N/A'}`);
                reportLines.push(`  - Architect: ${item.data.architect || 'N/A'}`);
                reportLines.push(`  - Scope: ${item.data.scope || 'N/A'}`);
            }
            reportLines.push('');
        }
        
        fs.writeFileSync(REPORT_FILE, reportLines.join('\n'), 'utf8');
        log(`✓ Report saved to: ${REPORT_FILE}`);
        
        log('\n=== Extraction Complete ===');
        log(`Categories processed: ${categories.length}`);
        log(`Projects created: ${newProjects.length}`);
        log(`\nLog saved to: ${LOG_FILE}`);
        log(`Report saved to: ${REPORT_FILE}`);
        
    } catch (error) {
        log(`ERROR: ${error.message}`);
        log(error.stack);
        throw error;
    }
}

// Run the extraction
extractProjectDataFromText();






