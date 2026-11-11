import { test, expect } from '@playwright/test';
import { TestHelpers } from './utils/test-helpers';
import testData from './data/test-data.json';

test.describe('Page Management Tests', () => {
  let testPageKey: string;

  test.beforeEach(async ({ page }) => {
    // Login before each test
    await TestHelpers.login(page);
    
    // Generate unique page key for each test
    testPageKey = `test-page-${TestHelpers.generateRandomString(6)}`;
  });

  test('should create a new page with all fields and images', async ({ page }) => {
    // Navigate to pages
    await TestHelpers.navigateTo(page, testData.urls.pages);
    await TestHelpers.waitForTable(page);

    // Click create page button
    await TestHelpers.clickAndWaitForNavigation(page, testData.selectors.pages.createPageButton);

    // Fill page form fields
    const pageFields = {
      [testData.selectors.pages.pageKeyField]: testPageKey,
      [testData.selectors.pages.pageTitleField]: testData.testPage.title,
      [testData.selectors.pages.pageUrlField]: testData.testPage.url,
      [testData.selectors.pages.backgroundImageField]: testData.testPage.backgroundImage,
      [testData.selectors.pages.menuSortField]: testData.testPage.menuSort.toString(),
      [testData.selectors.pages.seoPageTitleField]: testData.testPage.seo.pageTitle,
      [testData.selectors.pages.seoPageDescriptionField]: testData.testPage.seo.pageDescription,
      [testData.selectors.pages.seoPageKeywordsField]: testData.testPage.seo.pageKeywords,
      [testData.selectors.pages.seoPageImageField]: testData.testPage.seo.pageImage
    };

    await TestHelpers.fillFormFields(page, pageFields);

    // Check checkboxes
    if (testData.testPage.isActive) {
      await page.check(testData.selectors.pages.isActiveCheckbox);
    }
    if (testData.testPage.includeInMenu) {
      await page.check(testData.selectors.pages.includeInMenuCheckbox);
    }

    // Fill editor content
    await TestHelpers.fillQuillEditor(page, testData.testPage.content);

    // Upload page image
    await TestHelpers.uploadFile(page, testData.selectors.pages.pageImageFileInput, testData.testImages.pageImage.path);

    // Upload SEO image
    await TestHelpers.uploadFile(page, testData.selectors.pages.seoImageFileInput, testData.testImages.seoImage.path);

    // Upload image to editor
    await TestHelpers.uploadImageToQuill(page, testData.testImages.quillImage.path);

    // Save the page
    await TestHelpers.clickAndWaitForNavigation(page, testData.selectors.pages.saveButton);

    // Verify success message
    await TestHelpers.waitForSuccessMessage(page);
    await TestHelpers.expectTableContains(page, testPageKey);
    await TestHelpers.expectTableContains(page, testData.testPage.title);
  });

  test('should edit page and verify all data is correct', async ({ page }) => {
    // Navigate to pages
    await TestHelpers.navigateTo(page, testData.urls.pages);
    await TestHelpers.waitForTable(page);

    // Find and click edit button for our test page
    const editButton = page.locator(`a[href*='/admin/pages/edit/${testPageKey}']`);
    await TestHelpers.clickAndWaitForNavigation(page, editButton);

    // Verify all form fields contain correct data
    const expectedFields = {
      [testData.selectors.pages.pageKeyField]: testPageKey,
      [testData.selectors.pages.pageTitleField]: testData.testPage.title,
      [testData.selectors.pages.pageUrlField]: testData.testPage.url,
      [testData.selectors.pages.backgroundImageField]: testData.testPage.backgroundImage,
      [testData.selectors.pages.menuSortField]: testData.testPage.menuSort.toString(),
      [testData.selectors.pages.seoPageTitleField]: testData.testPage.seo.pageTitle,
      [testData.selectors.pages.seoPageDescriptionField]: testData.testPage.seo.pageDescription,
      [testData.selectors.pages.seoPageKeywordsField]: testData.testPage.seo.pageKeywords,
      [testData.selectors.pages.seoPageImageField]: testData.testPage.seo.pageImage
    };

    await TestHelpers.checkFormFields(page, expectedFields);

    // Verify checkboxes
    await TestHelpers.expectElementChecked(page, testData.selectors.pages.isActiveCheckbox, testData.testPage.isActive);
    await TestHelpers.expectElementChecked(page, testData.selectors.pages.includeInMenuCheckbox, testData.testPage.includeInMenu);

    // Verify editor content
    await TestHelpers.expectQuillEditorContent(page, testData.testPage.content);
  });

  test('should update page with new data and images', async ({ page }) => {
    // Navigate to pages
    await TestHelpers.navigateTo(page, testData.urls.pages);
    await TestHelpers.waitForTable(page);

    // Find and click edit button for our test page
    const editButton = page.locator(`a[href*='/admin/pages/edit/${testPageKey}']`);
    await TestHelpers.clickAndWaitForNavigation(page, editButton);

    // Update form fields
    const updatedFields = {
      [testData.selectors.pages.pageTitleField]: testData.updatedTestPage.title,
      [testData.selectors.pages.pageUrlField]: testData.updatedTestPage.url,
      [testData.selectors.pages.menuSortField]: testData.updatedTestPage.menuSort.toString(),
      [testData.selectors.pages.seoPageTitleField]: testData.updatedTestPage.seo.pageTitle,
      [testData.selectors.pages.seoPageDescriptionField]: testData.updatedTestPage.seo.pageDescription,
      [testData.selectors.pages.seoPageKeywordsField]: testData.updatedTestPage.seo.pageKeywords
    };

    await TestHelpers.fillFormFields(page, updatedFields);

    // Update editor content
    await TestHelpers.fillQuillEditor(page, testData.updatedTestPage.content);

    // Upload new page image
    await TestHelpers.uploadFile(page, testData.selectors.pages.pageImageFileInput, testData.testImages.updatedPageImage.path);

    // Upload new SEO image
    await TestHelpers.uploadFile(page, testData.selectors.pages.seoImageFileInput, testData.testImages.updatedSeoImage.path);

    // Save changes
    await TestHelpers.clickAndWaitForNavigation(page, testData.selectors.pages.saveButton);

    // Verify success message
    await TestHelpers.waitForSuccessMessage(page);
    await TestHelpers.expectTableContains(page, testData.updatedTestPage.title);
  });

  test('should verify updated page data is correct', async ({ page }) => {
    // Navigate to pages
    await TestHelpers.navigateTo(page, testData.urls.pages);
    await TestHelpers.waitForTable(page);

    // Find and click edit button for our test page
    const editButton = page.locator(`a[href*='/admin/pages/edit/${testPageKey}']`);
    await TestHelpers.clickAndWaitForNavigation(page, editButton);

    // Verify all updated form fields
    const expectedUpdatedFields = {
      [testData.selectors.pages.pageKeyField]: testPageKey,
      [testData.selectors.pages.pageTitleField]: testData.updatedTestPage.title,
      [testData.selectors.pages.pageUrlField]: testData.updatedTestPage.url,
      [testData.selectors.pages.menuSortField]: testData.updatedTestPage.menuSort.toString(),
      [testData.selectors.pages.seoPageTitleField]: testData.updatedTestPage.seo.pageTitle,
      [testData.selectors.pages.seoPageDescriptionField]: testData.updatedTestPage.seo.pageDescription,
      [testData.selectors.pages.seoPageKeywordsField]: testData.updatedTestPage.seo.pageKeywords
    };

    await TestHelpers.checkFormFields(page, expectedUpdatedFields);

    // Verify updated editor content
    await TestHelpers.expectQuillEditorContent(page, testData.updatedTestPage.content);
  });

  test('should delete the test page', async ({ page }) => {
    // Navigate to pages
    await TestHelpers.navigateTo(page, testData.urls.pages);
    await TestHelpers.waitForTable(page);

    // Get initial row count
    const initialRowCount = await TestHelpers.getTableRowCount(page);

    // Find and click delete button for our test page
    const deleteButton = page.locator(`tr:has-text("${testPageKey}") ${testData.selectors.pages.deleteButton}`);
    await page.click(deleteButton);

    // Confirm deletion
    await TestHelpers.confirmModal(page);

    // Verify success message
    await TestHelpers.waitForSuccessMessage(page);

    // Verify page is removed from table
    await TestHelpers.expectTableNotContains(page, testPageKey);
    await TestHelpers.expectTableNotContains(page, testData.updatedTestPage.title);

    // Verify row count decreased
    const finalRowCount = await TestHelpers.getTableRowCount(page);
    expect(finalRowCount).toBe(initialRowCount - 1);
  });
}); 