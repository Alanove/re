# Testing Guidelines for EMDC Website

## 🚫 Important Rules

### Never place test files in the root directory!

All test files must be organized in the appropriate directories.

## 📁 Test File Organization

```
tests/                    # Backend/unit tests (not web accessible)
├── unit/                # Unit test files
├── integration/         # Integration test files
├── e2e/                 # End-to-end test files
├── data/                # Test data and fixtures
├── fixtures/            # Test assets (images, etc.)
└── utils/               # Test utility functions

public/tests/            # Frontend/manual tests (web accessible)
├── test-*.html          # Manual test HTML files
└── assets/              # Test-specific assets
```

## ✅ Correct Way to Add Tests

### Manual Tests (HTML files that need web access)
```bash
# Create test file in web-accessible location
touch public/tests/test-worldmap-functionality.html

# Access via: http://localhost:3000/tests/test-worldmap-functionality.html
```

### Unit/Integration Tests (Backend)
```bash
# Create test file in backend tests location
touch tests/unit/worldmap.test.js

# These are not web accessible (run via npm test)
```

## 🔒 .gitignore Protection

The following patterns are ignored in the root directory to prevent accidental commits:
- `test-*.html`
- `test-*.js` 
- `test-*.ts`
- `*-test.html`

## 📝 File Naming Convention

- Use `test-` prefix for manual test files
- Use `.test.` suffix for automated test files
- Use kebab-case for filenames
- Include the feature/component being tested

### Examples
✅ Good:
- `public/tests/test-worldmap-pointers.html` (web accessible)
- `tests/unit/worldmap.test.js` (backend unit test)
- `tests/e2e/login-flow.test.ts` (backend e2e test)

❌ Bad:
- `test-worldmap.html` (in root)
- `tests/manual/test-worldmap.html` (not web accessible)
- `worldmapTest.html` (wrong case)
- `test.html` (not descriptive)

## 🚀 Quick Start

1. **Manual test (needs web access)**: Create HTML file in `public/tests/`
2. **Unit test**: Create `.test.js` file in `tests/unit/`
3. **Integration test**: Create `.test.js` file in `tests/integration/`
4. **E2E test**: Create `.test.ts` file in `tests/e2e/`

### Access Manual Tests
- URL format: `http://localhost:3000/tests/[filename].html`
- Example: `http://localhost:3000/tests/test-worldmap-fixes.html`

Remember: Keep tests organized, self-contained, and well-documented!
