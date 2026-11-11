# Testing Framework for EMDC Website

This directory contains comprehensive tests for the EMDC website project.

## Overview

The testing framework covers:
- **Authentication**: Login, logout, and access control
- **Page Management**: Create, edit, update, and delete pages with image uploads
- **User Management**: Create, edit, update, and delete users with password changes
- **Manual Testing**: Browser-based tests for UI components and functionality

## Test Structure

```
tests/
├── manual/                     # Manual test HTML files
├── data/
│   └── test-data.json          # All test data and selectors
├── fixtures/
│   └── images/                 # Test images for uploads
├── utils/
│   └── test-helpers.ts         # Utility functions
├── auth.test.ts               # Authentication tests
├── pages.test.ts              # Page management tests
├── users.test.ts              # User management tests
└── README.md                  # This file
```

## Manual Testing Guidelines

### Rules for Manual Tests
1. **Never place test files in the root directory**
2. **All manual test HTML files must be in `tests/manual/` directory**
3. **Use descriptive filenames with `test-` prefix**
4. **Test files should be self-contained and independent**
5. **Include clear documentation of what each test validates**

### Manual Test File Structure
```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Test: Feature Name</title>
    <!-- Test-specific styles -->
</head>
<body>
    <h1>Test: Feature Name</h1>
    <p>Description of what this test validates...</p>
    
    <!-- Test content -->
    
    <!-- Test scripts -->
</body>
</html>
```

## Prerequisites

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Install Playwright Browsers**:
   ```bash
   npm run install:playwright
   ```

3. **Add Test Images**:
   Place the following images in `tests/fixtures/images/`:
   - `test-page-image.jpg`
   - `test-seo-image.jpg`
   - `test-quill-image.jpg`
   - `updated-page-image.jpg`
   - `updated-seo-image.jpg`

## Running Tests

### Start the Development Server
```bash
npm run dev
```

### Run All Tests
```bash
npm test
```

### Run Tests with UI
```bash
npm run test:ui
```

### Run Tests in Headed Mode (see browser)
```bash
npm run test:headed
```

### Run Tests in Debug Mode
```bash
npm run test:debug
```

### Run Specific Test File
```bash
npx playwright test auth.test.ts
npx playwright test pages.test.ts
npx playwright test users.test.ts
```

### Run Tests for Specific Browser
```bash
npx playwright test --project=chromium
npx playwright test --project=firefox
npx playwright test --project=webkit
```

## Test Scenarios

### Authentication Tests (`auth.test.ts`)
- ✅ Login with valid admin credentials
- ✅ Show error with invalid credentials
- ✅ Show error with empty credentials
- ✅ Logout successfully
- ✅ Redirect to login when accessing protected pages without authentication

### Page Management Tests (`pages.test.ts`)
- ✅ Create a new page with all fields and images
- ✅ Edit page and verify all data is correct
- ✅ Update page with new data and images
- ✅ Verify updated page data is correct
- ✅ Delete the test page

### User Management Tests (`users.test.ts`)
- ✅ Create a new user with all fields
- ✅ Logout and login with created user
- ✅ Edit user data and verify it is saved correctly
- ✅ Verify updated user data is correct
- ✅ Change user password and verify it works
- ✅ Delete the test user
- ✅ Verify deleted user cannot login

## Test Data

All test data is centralized in `tests/data/test-data.json`:

### Admin Credentials
```json
{
  "admin": {
    "email": "admin@gebco.com",
    "password": "sei4aBallout"
  }
}
```

### Test User Data
```json
{
  "testUser": {
    "firstName": "Test",
    "lastName": "User",
    "email": "test.user@gebco.com",
    "password": "TestPassword123!",
    "role": "editor"
  }
}
```

### Test Page Data
```json
{
  "testPage": {
    "key": "test-page",
    "title": "Test Page",
    "url": "/test-page",
    "content": "<p>Test content</p>"
  }
}
```

## Configuration

The Playwright configuration is in `playwright.config.ts`:

- **Base URL**: `http://localhost:3000`
- **Browsers**: Chrome, Firefox, Safari, Mobile Chrome, Mobile Safari
- **Screenshots**: On failure
- **Videos**: On failure
- **Traces**: On first retry
- **Web Server**: Automatically starts `npm run dev`

## Test Reports

After running tests, you can view reports:

```bash
npm run test:report
```

This opens the HTML report with:
- Test results
- Screenshots
- Videos
- Traces
- Console logs

## Debugging Tests

### Debug Mode
```bash
npm run test:debug
```

### Take Screenshots
```typescript
await TestHelpers.takeScreenshot(page, 'test-name');
```

### View Test Results
```bash
npx playwright show-report
```

## Best Practices

1. **Isolation**: Each test is independent and cleans up after itself
2. **Data Management**: Tests generate unique data to avoid conflicts
3. **Selectors**: All selectors are centralized in test-data.json
4. **Helpers**: Common operations are abstracted into TestHelpers class
5. **Timeouts**: Appropriate timeouts for different operations
6. **Error Handling**: Proper error messages and assertions

## Troubleshooting

### Common Issues

1. **Server Not Running**: Make sure `npm run dev` is running
2. **Missing Images**: Add test images to `tests/fixtures/images/`
3. **Selector Issues**: Check if selectors match the actual HTML
4. **Timeout Issues**: Increase timeouts in test-data.json

### Debug Commands

```bash
# Run single test with debug
npx playwright test --debug auth.test.ts

# Run with headed browser
npx playwright test --headed

# Run with slow motion
npx playwright test --headed --timeout=0
```

## Continuous Integration

The tests are configured to run in CI environments:

- **Retries**: 2 retries on CI
- **Workers**: 1 worker on CI
- **Forbid Only**: Prevents test.only in production

## Contributing

When adding new tests:

1. Add test data to `test-data.json`
2. Create helper functions in `test-helpers.ts`
3. Write tests following the existing pattern
4. Update this README if needed 