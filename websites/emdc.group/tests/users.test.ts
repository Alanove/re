import { test, expect } from '@playwright/test';
import { TestHelpers } from './utils/test-helpers';
import testData from './data/test-data.json';

test.describe('User Management Tests', () => {
  let testUserEmail: string;
  let testUserId: string;

  test.beforeEach(async ({ page }) => {
    // Login before each test
    await TestHelpers.login(page);
    
    // Generate unique email for each test
    testUserEmail = TestHelpers.generateUniqueEmail();
  });

  test('should create a new user with all fields', async ({ page }) => {
    // Navigate to users
    await TestHelpers.navigateTo(page, testData.urls.users);
    await TestHelpers.waitForTable(page);

    // Click create user button
    await TestHelpers.clickAndWaitForNavigation(page, testData.selectors.users.createUserButton);

    // Fill user form fields
    const userFields = {
      [testData.selectors.users.nameField]: `${testData.testUser.firstName} ${testData.testUser.lastName}`,
      [testData.selectors.users.emailField]: testUserEmail,
      [testData.selectors.users.passwordField]: testData.testUser.password,
      [testData.selectors.users.confirmPasswordField]: testData.testUser.password,
      [testData.selectors.users.notesField]: `Test user for ${testData.testUser.department} department`
    };

    await TestHelpers.fillFormFields(page, userFields);

    // Select status
    await page.selectOption(testData.selectors.users.statusSelect, 'Active');

    // Save the user
    await TestHelpers.clickAndWaitForNavigation(page, testData.selectors.users.saveButton);

    // Verify success message
    await TestHelpers.waitForSuccessMessage(page);
    await TestHelpers.expectTableContains(page, testUserEmail);
    await TestHelpers.expectTableContains(page, testData.testUser.firstName);
  });

  test('should logout and login with created user', async ({ page }) => {
    // First logout from admin
    await TestHelpers.logout(page);

    // Login with created user
    await TestHelpers.login(page, testUserEmail, testData.testUser.password);

    // Verify we're logged in (should redirect to dashboard)
    await page.waitForURL('**/admin/dashboard');
    await TestHelpers.expectElementVisible(page, testData.selectors.navigation.dashboardLink);
  });

  test('should edit user data and verify it is saved correctly', async ({ page }) => {
    // Navigate to users
    await TestHelpers.navigateTo(page, testData.urls.users);
    await TestHelpers.waitForTable(page);

    // Find and click edit button for our test user
    const editButton = page.locator(`tr:has-text("${testUserEmail}") a[href*="/admin/users/edit/"]`);
    await editButton.click();
    await page.waitForLoadState('networkidle');

    // Update user fields
    const updatedFields = {
      [testData.selectors.users.nameField]: `${testData.updatedTestUser.firstName} ${testData.updatedTestUser.lastName}`,
      [testData.selectors.users.notesField]: `Updated test user for ${testData.updatedTestUser.department} department`
    };

    await TestHelpers.fillFormFields(page, updatedFields);

    // Update status
    await page.selectOption(testData.selectors.users.statusSelect, 'Active');

    // Save changes
    await TestHelpers.clickAndWaitForNavigation(page, testData.selectors.users.saveButton);

    // Verify success message
    await TestHelpers.waitForSuccessMessage(page);
    await TestHelpers.expectTableContains(page, testData.updatedTestUser.firstName);
  });

  test('should verify updated user data is correct', async ({ page }) => {
    // Navigate to users
    await TestHelpers.navigateTo(page, testData.urls.users);
    await TestHelpers.waitForTable(page);

    // Find and click edit button for our test user
    const editButton = page.locator(`tr:has-text("${testUserEmail}") a[href*="/admin/users/edit/"]`);
    await editButton.click();
    await page.waitForLoadState('networkidle');

    // Verify all updated form fields
    const expectedUpdatedFields = {
      [testData.selectors.users.nameField]: `${testData.updatedTestUser.firstName} ${testData.updatedTestUser.lastName}`,
      [testData.selectors.users.emailField]: testUserEmail,
      [testData.selectors.users.notesField]: `Updated test user for ${testData.updatedTestUser.department} department`
    };

    await TestHelpers.checkFormFields(page, expectedUpdatedFields);

    // Verify status is selected correctly
    await expect(page.locator(testData.selectors.users.statusSelect)).toHaveValue('Active');
  });

  test('should change user password and verify it works', async ({ page }) => {
    // Navigate to users
    await TestHelpers.navigateTo(page, testData.urls.users);
    await TestHelpers.waitForTable(page);

    // Find and click edit button for our test user
    const editButton = page.locator(`tr:has-text("${testUserEmail}") a[href*="/admin/users/edit/"]`);
    await editButton.click();
    await page.waitForLoadState('networkidle');

    // Fill password change form
    const passwordFields = {
      [testData.selectors.users.passwordField]: testData.updatedTestUser.password,
      [testData.selectors.users.confirmPasswordField]: testData.updatedTestUser.password
    };

    await TestHelpers.fillFormFields(page, passwordFields);

    // Save password change
    await TestHelpers.clickAndWaitForNavigation(page, testData.selectors.users.saveButton);

    // Verify success message
    await TestHelpers.waitForSuccessMessage(page);

    // Logout
    await TestHelpers.logout(page);

    // Try to login with old password (should fail)
    await TestHelpers.navigateTo(page, testData.urls.login);
    await page.fill(testData.selectors.login.emailField, testUserEmail);
    await page.fill(testData.selectors.login.passwordField, testData.testUser.password);
    await page.click(testData.selectors.login.loginButton);

    // Should show error message
    await TestHelpers.waitForErrorMessage(page);

    // Login with new password (should succeed)
    await page.fill(testData.selectors.login.passwordField, testData.updatedTestUser.password);
    await page.click(testData.selectors.login.loginButton);

    // Verify we're logged in
    await page.waitForURL('**/admin/dashboard');
    await TestHelpers.expectElementVisible(page, testData.selectors.navigation.dashboardLink);
  });

  test('should delete the test user', async ({ page }) => {
    // Navigate to users
    await TestHelpers.navigateTo(page, testData.urls.users);
    await TestHelpers.waitForTable(page);

    // Get initial row count
    const initialRowCount = await TestHelpers.getTableRowCount(page);

    // Find and click delete button for our test user
    const deleteButton = page.locator(`tr:has-text("${testUserEmail}") button[onclick*="deleteItem"]`);
    await deleteButton.click();

    // Confirm deletion
    await TestHelpers.confirmModal(page);

    // Verify success message
    await TestHelpers.waitForSuccessMessage(page);

    // Verify user is removed from table
    await TestHelpers.expectTableNotContains(page, testUserEmail);
    await TestHelpers.expectTableNotContains(page, testData.updatedTestUser.firstName);

    // Verify row count decreased
    const finalRowCount = await TestHelpers.getTableRowCount(page);
    expect(finalRowCount).toBe(initialRowCount - 1);
  });

  test('should verify deleted user cannot login', async ({ page }) => {
    // Try to login with deleted user
    await TestHelpers.navigateTo(page, testData.urls.login);
    await page.fill(testData.selectors.login.emailField, testUserEmail);
    await page.fill(testData.selectors.login.passwordField, testData.updatedTestUser.password);
    await page.click(testData.selectors.login.loginButton);

    // Should show error message
    await TestHelpers.waitForErrorMessage(page);
  });
}); 