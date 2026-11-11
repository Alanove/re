/**
 * OCR-based script to extract project data from slide images
 * Extracts: bau, area, size, quantity, contractor, architect, client, scope, country
 * 
 * Requirements:
 * - npm install tesseract.js
 * - Or use: npm install tesseract.js sharp
 * 
 * Run with: node extract-project-data-ocr.js
 * 
 * Note: Script is in docs/Project Slides/extract-data/, paths are relative to project root
 */

const fs = require('fs');
const path = require('path');
const Tesseract = require('tesseract.js');

// Script is in docs/Project Slides/extract-data/, so go up 3 levels to project root
const BASE_DIR = path.resolve(__dirname, '..', '..', '..');
const PROJECT_SLIDES_DIR = path.join(BASE_DIR, 'docs', 'Project Slides');
const PROJECT_PHOTOS_DIR = path.join(BASE_DIR, 'docs', 'CONSULT EMDC Projects Photos');
const PROJECTS_JSON = path.join(BASE_DIR, 'data', 'projects.json');
const PUBLIC_PROJECTS_DIR = path.join(BASE_DIR, 'public', 'projects');
const REPORT_FILE = path.join(BASE_DIR, 'docs', 'Project Slides', 'ocr_extraction_report.md');
const OUTPUT_FILE = path.join(__dirname, 'ocr-extraction-results.txt');
function log(message) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}`;
    console.log(logMessage);
    if (fs.existsSync(OUTPUT_FILE) || OUTPUT_FILE) {
        fs.appendFileSync(OUTPUT_FILE, logMessage + '\n', 'utf8');
    }
}

function normalizeName(name) {
    return name.replace(/[^\w\s-]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function createSlug(name) {
    return name.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').trim();
}

/**
 * Parse OCR text to extract project information
 */
function parseProjectData(ocrText, projectTitle) {
    const data = {
        bau: '',
        area: '',
        size: '',
        quantity: '',
        contractor: '',
        architect: '',
        client: '',
        scope: '',
        country: ''
    };

    const lines = ocrText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    
    // Common patterns for extraction
    const patterns = {
        bau: /bau[:\s]*([^\n]+)/i,
        area: /area[:\s]*([^\n]+)/i,
        size: /size[:\s]*([^\n]+)/i,
        quantity: /quantity[:\s]*([^\n]+)/i,
        contractor: /contractor[:\s]*([^\n]+)/i,
        architect: /architect[:\s]*([^\n]+)/i,
        client: /client[:\s]*([^\n]+)/i,
        scope: /scope[:\s]*([^\n]+)/i,
        country: /country[:\s]*([^\n]+)/i
    };

    // Try direct pattern matching
    for (const [key, pattern] of Object.entries(patterns)) {
        const match = ocrText.match(pattern);
        if (match && match[1]) {
            data[key] = match[1].trim();
        }
    }

    // Alternative: Look for labeled fields in structured format
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].toLowerCase();
        
        if (line.includes('bau') && !data.bau) {
            const value = lines[i].replace(/bau[:\s]*/i, '').trim() || (lines[i + 1] || '').trim();
            if (value) data.bau = value;
        }
        if (line.includes('area') && !data.area) {
            const value = lines[i].replace(/area[:\s]*/i, '').trim() || (lines[i + 1] || '').trim();
            if (value) data.area = value;
        }
        if (line.includes('size') && !data.size) {
            const value = lines[i].replace(/size[:\s]*/i, '').trim() || (lines[i + 1] || '').trim();
            if (value) data.size = value;
        }
        if (line.includes('quantity') && !data.quantity) {
            const value = lines[i].replace(/quantity[:\s]*/i, '').trim() || (lines[i + 1] || '').trim();
            if (value) data.quantity = value;
        }
        if (line.includes('contractor') && !data.contractor) {
            const value = lines[i].replace(/contractor[:\s]*/i, '').trim() || (lines[i + 1] || '').trim();
            if (value) data.contractor = value;
        }
        if (line.includes('architect') && !data.architect) {
            const value = lines[i].replace(/architect[:\s]*/i, '').trim() || (lines[i + 1] || '').trim();
            if (value) data.architect = value;
        }
        if (line.includes('client') && !data.client) {
            const value = lines[i].replace(/client[:\s]*/i, '').trim() || (lines[i + 1] || '').trim();
            if (value) data.client = value;
        }
        if (line.includes('scope') && !data.scope) {
            // Scope might be multi-line
            let scopeValue = lines[i].replace(/scope[:\s]*/i, '').trim();
            if (!scopeValue && lines[i + 1]) {
                scopeValue = lines[i + 1].trim();
            }
            if (scopeValue) data.scope = scopeValue;
        }
        if (line.includes('country') && !data.country) {
            const value = lines[i].replace(/country[:\s]*/i, '').trim() || (lines[i + 1] || '').trim();
            if (value) data.country = value;
        }
    }

    return data;
}

/**
 * Extract text from slide image using OCR
 */
async function extractTextFromSlide(slidePath) {
    try {
        log(`Processing OCR for: ${path.basename(slidePath)}`);
        
        const { data: { text } } = await Tesseract.recognize(
            slidePath,
            'eng',
            {
                logger: m => {
                    if (m.status === 'recognizing text') {
                        log(`Progress: ${Math.round(m.progress * 100)}%`);
                    }
                }
            }
        );
        
        return text;
    } catch (error) {
        log(`ERROR extracting text from ${slidePath}: ${error.message}`);
        return '';
    }
}

/**
 * Get category from slide filename
 */
function getCategoryFromSlide(slideFile) {
    const name = path.parse(slideFile).name.trim();
    // Remove trailing space if present (e.g., "Airports & Stations .jpg" -> "Airports & Stations")
    return name.replace(/\s+$/, '');
}

/**
 * Find projects in a category from OCR text
 */
function findProjectsInCategory(ocrText, category, existingProjects) {
    const projects = [];
    const lines = ocrText.split('\n').map(l => l.trim()).filter(l => l.length > 2);
    
    // Look for project titles (usually in boxes/sections)
    // This is a heuristic - may need adjustment based on actual slide format
    const projectTitles = [];
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Skip category headers and common labels
        if (line.toLowerCase().includes('category') || 
            line.toLowerCase().includes('projects') ||
            line.length < 5) {
            continue;
        }
        
        // Check if this line matches an existing project title
        const normalizedLine = normalizeName(line);
        const matchingProject = existingProjects.find(p => {
            const normalizedTitle = normalizeName(p.title);
            return normalizedTitle === normalizedLine || 
                   normalizedLine.includes(normalizedTitle) ||
                   normalizedTitle.includes(normalizedLine);
        });
        
        if (matchingProject && !projectTitles.find(p => p.title === matchingProject.title)) {
            projectTitles.push({
                title: matchingProject.title,
                project: matchingProject,
                lineIndex: i
            });
        }
    }
    
    return projectTitles;
}

/**
 * Extract project data from slide and update projects
 */
async function processSlide(slidePath, category, existingProjects) {
    log(`\n=== Processing slide: ${path.basename(slidePath)} ===`);
    
    const ocrText = await extractTextFromSlide(slidePath);
    
    if (!ocrText || ocrText.trim().length < 10) {
        log(`WARNING: No text extracted from ${path.basename(slidePath)}`);
        return { extracted: [], rawText: ocrText };
    }
    
    log(`Extracted ${ocrText.length} characters of text`);
    
    // Find projects in this slide
    const foundProjects = findProjectsInCategory(ocrText, category, existingProjects);
    
    log(`Found ${foundProjects.length} projects in slide`);
    
    const extractedData = [];
    
    // For each found project, try to extract its data
    for (const found of foundProjects) {
        const projectTitle = found.title;
        const project = found.project;
        
        log(`\nExtracting data for: ${projectTitle}`);
        
        // Extract data around the project title
        const lines = ocrText.split('\n');
        const startIndex = Math.max(0, found.lineIndex - 5);
        const endIndex = Math.min(lines.length, found.lineIndex + 20);
        const projectSection = lines.slice(startIndex, endIndex).join('\n');
        
        const extracted = parseProjectData(projectSection, projectTitle);
        
        extractedData.push({
            project: projectTitle,
            data: extracted,
            rawText: projectSection
        });
        
        log(`Extracted data: ${JSON.stringify(extracted, null, 2)}`);
    }
    
    return { extracted: extractedData, rawText: ocrText };
}

/**
 * Main function to extract data from all slides
 */
async function extractProjectDataFromSlides() {
    // Clear output file
    if (fs.existsSync(OUTPUT_FILE)) fs.unlinkSync(OUTPUT_FILE);
    
    log('=== Starting OCR-based Project Data Extraction ===');
    log(`Base directory: ${BASE_DIR}`);
    
    if (!fs.existsSync(PROJECTS_JSON)) {
        log('ERROR: projects.json not found!');
        process.exit(1);
    }
    
    if (!fs.existsSync(PROJECT_SLIDES_DIR)) {
        log('ERROR: Project slides directory not found!');
        process.exit(1);
    }
    
    // Load existing projects
    const data = JSON.parse(fs.readFileSync(PROJECTS_JSON, 'utf8'));
    const projects = data.projects || [];
    log(`Loaded ${projects.length} projects`);
    
    // Get all slide files
    const slideFiles = fs.readdirSync(PROJECT_SLIDES_DIR)
        .filter(f => f.toLowerCase().endsWith('.jpg') || f.toLowerCase().endsWith('.jpeg') || f.toLowerCase().endsWith('.png'))
        .map(f => path.join(PROJECT_SLIDES_DIR, f));
    
    log(`Found ${slideFiles.length} slide files`);
    
    const allExtractedData = [];
    const updates = [];
    const unclearData = [];
    
    // Process each slide
    for (const slidePath of slideFiles) {
        const category = getCategoryFromSlide(slidePath);
        log(`\n\n=== Processing category: ${category} ===`);
        
        // Get projects in this category
        const categoryProjects = projects.filter(p => 
            p.categories && p.categories.includes(category)
        );
        
        log(`Found ${categoryProjects.length} projects in category: ${category}`);
        
        const result = await processSlide(slidePath, category, categoryProjects);
        allExtractedData.push({
            category,
            slide: path.basename(slidePath),
            extracted: result.extracted,
            rawText: result.rawText
        });
        
        // Update projects with extracted data
        for (const extracted of result.extracted) {
            const project = projects.find(p => p.title === extracted.project);
            if (project) {
                let updated = false;
                const updateLog = [];
                
                for (const [key, value] of Object.entries(extracted.data)) {
                    if (value && value.trim() && (!project[key] || project[key].trim() === '')) {
                        project[key] = value;
                        updated = true;
                        updateLog.push(`${key}: ${value}`);
                    }
                }
                
                if (updated) {
                    updates.push({
                        project: extracted.project,
                        updates: updateLog
                    });
                    log(`Updated ${extracted.project}: ${updateLog.join(', ')}`);
                }
            }
        }
    }
    
    // Save updated projects.json
    fs.writeFileSync(PROJECTS_JSON, JSON.stringify(data, null, 2), 'utf8');
    log(`\n✓ Saved updated projects.json`);
    
    // Generate report
    generateOCRReport(allExtractedData, updates, unclearData);
    
    return {
        slidesProcessed: slideFiles.length,
        projectsUpdated: updates.length,
        totalUpdates: updates.reduce((sum, u) => sum + u.updates.length, 0)
    };
}

/**
 * Generate OCR extraction report
 */
function generateOCRReport(allExtractedData, updates, unclearData) {
    const reportLines = [
        '# OCR Project Data Extraction Report',
        '',
        `Generated: ${new Date().toISOString()}`,
        '',
        '## Summary',
        `- Slides Processed: ${allExtractedData.length}`,
        `- Projects Updated: ${updates.length}`,
        `- Total Field Updates: ${updates.reduce((sum, u) => sum + u.updates.length, 0)}`,
        '',
        '## Updates Made',
        ''
    ];
    
    if (updates.length > 0) {
        for (const update of updates) {
            reportLines.push(`### ${update.project}`);
            for (const fieldUpdate of update.updates) {
                reportLines.push(`- ${fieldUpdate}`);
            }
            reportLines.push('');
        }
    } else {
        reportLines.push('No updates were made.');
        reportLines.push('');
    }
    
    reportLines.push('## Extracted Data by Slide', '');
    
    for (const slideData of allExtractedData) {
        reportLines.push(`### ${slideData.category} (${slideData.slide})`);
        reportLines.push(`Projects found: ${slideData.extracted.length}`);
        reportLines.push('');
        
        for (const extracted of slideData.extracted) {
            reportLines.push(`#### ${extracted.project}`);
            for (const [key, value] of Object.entries(extracted.data)) {
                if (value) {
                    reportLines.push(`- **${key}**: ${value}`);
                }
            }
            reportLines.push('');
        }
        
        if (slideData.extracted.length === 0) {
            reportLines.push('*No projects identified in this slide*');
            reportLines.push('');
        }
    }
    
    // Write report
    const reportDir = path.dirname(REPORT_FILE);
    if (!fs.existsSync(reportDir)) {
        fs.mkdirSync(reportDir, { recursive: true });
    }
    fs.writeFileSync(REPORT_FILE, reportLines.join('\n'), 'utf8');
    log(`\n✓ Report saved to: ${REPORT_FILE}`);
}

// Run the extraction
if (require.main === module) {
    extractProjectDataFromSlides()
        .then(results => {
            log('\n=== Extraction Complete ===');
            log(`Slides processed: ${results.slidesProcessed}`);
            log(`Projects updated: ${results.projectsUpdated}`);
            log(`Total field updates: ${results.totalUpdates}`);
            log(`\nResults saved to: ${OUTPUT_FILE}`);
            log(`Report saved to: ${REPORT_FILE}`);
        })
        .catch(error => {
            log(`ERROR: ${error.message}`);
            console.error(error);
            process.exit(1);
        });
}

module.exports = { extractProjectDataFromSlides, parseProjectData };






