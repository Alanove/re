const fs = require('fs');
const path = require('path');

const localesDir = path.join(__dirname, '../data/locales');
const rootDir = path.join(__dirname, '../');
const outputFile = path.join(__dirname, 'missing_keys.json');

function flattenKeys(obj, prefix = '') {
    let keys = [];
    for (const k in obj) {
        if (typeof obj[k] === 'object' && obj[k] !== null) {
            keys = keys.concat(flattenKeys(obj[k], prefix + k + '.'));
        } else {
            keys.push(prefix + k);
        }
    }
    return keys;
}

function loadLocales() {
    const locales = {};
    if (fs.existsSync(localesDir)) {
        const files = fs.readdirSync(localesDir);
        files.forEach(file => {
            if (file.endsWith('.json')) {
                const lang = path.parse(file).name;
                try {
                    const content = JSON.parse(fs.readFileSync(path.join(localesDir, file), 'utf8'));
                    locales[lang] = new Set(flattenKeys(content));
                } catch (e) {
                    console.error(`Error parsing ${file}:`, e.message);
                }
            }
        });
    }
    return locales;
}

function getAllFiles(dirPath, arrayOfFiles) {
    const files = fs.readdirSync(dirPath);
    arrayOfFiles = arrayOfFiles || [];

    files.forEach(function(file) {
        if (fs.statSync(dirPath + "/" + file).isDirectory()) {
            if (file !== 'node_modules' && file !== '.git' && file !== 'dist' && file !== 'data' && file !== '.gemini' && file !== '.vscode') {
                arrayOfFiles = getAllFiles(dirPath + "/" + file, arrayOfFiles);
            }
        } else {
            if (file.endsWith('.ejs') || file.endsWith('.ts') || file.endsWith('.js')) {
                arrayOfFiles.push(path.join(dirPath, "/", file));
            }
        }
    });

    return arrayOfFiles;
}

function scanFiles() {
    const usedKeys = new Set();
    // Regex for t('key') or t("key") or __('key') or __("key")
    const regex = /(?:t|__)\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    
    const dirsToScan = [
        path.join(rootDir, 'views'),
        path.join(rootDir, 'src')
    ];

    let allFiles = [];
    dirsToScan.forEach(dir => {
        if (fs.existsSync(dir)) {
            allFiles = allFiles.concat(getAllFiles(dir));
        }
    });

    allFiles.forEach(file => {
        const content = fs.readFileSync(file, 'utf8');
        let match;
        while ((match = regex.exec(content)) !== null) {
            const key = match[1];
            // Filter out obvious non-keys
            if (key.includes('/') || key.includes('\\') || key.startsWith('@') || key.includes(' ')) {
                // Skip paths, emails, sentences with spaces (assuming keys are strict dot notation)
                // However, some keys might have spaces? In this project clearly keys are strictly structured.
                 continue;
            }
             // Also filter headers like 'content-type' if they appear somehow (unlikely in t() but possible in other contexts if regex is loose)
             if (key.includes('-') && !key.includes('.')) {
                 // heuristic: keys usually have dots. dashes are okay e.g. 'add-product' but usually it's 'add.product'
                 // Let's keep dashes for now but be wary.
             }
            usedKeys.add(key);
        }
    });
    return usedKeys;
}

function main() {
    const locales = loadLocales();
    const usedKeys = scanFiles();
    const missing = {};

    Object.keys(locales).forEach(lang => {
        missing[lang] = [];
        usedKeys.forEach(key => {
            if (!locales[lang].has(key)) {
                missing[lang].push(key);
            }
        });
        missing[lang].sort(); 
    });

    fs.writeFileSync(outputFile, JSON.stringify(missing, null, 2));
    console.log(`Report written to ${outputFile}`);
}

main();
