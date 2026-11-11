import { test, expect } from '@playwright/test';
import { TestHelpers } from './utils/test-helpers';
import testData from './data/test-data.json';

test.describe('Authentication Tests', () => {
  test('should login with valid admin credentials', async ({ page }) => {
    await TestHelpers.login(page);
    
    // Verify we're redirected to dashboard
    await page.waitForURL('**/admin/dashboard');
    await TestHelpers.expectElementVisible(page, testData.selectors.navigation.dashboardLink);
  });

  test('should show error with invalid credentials', async ({ page }) => {
    await TestHelpers.navigateTo(page, testData.urls.login);
    
    // Try to login with invalid credentials
    await page.fill(testData.selectors.login.emailField, 'invalid@gebco.com');
    await page.fill(testData.selectors.login.passwordField, 'wrongpassword');
    await page.click(testData.selectors.login.loginButton);
    
    // Should show error message
    await TestHelpers.waitForErrorMessage(page);
  });

  test('should show error with empty credentials', async ({ page }) => {
    await TestHelpers.navigateTo(page, testData.urls.login);
    
    // Try to login with empty credentials
    await page.click(testData.selectors.login.loginButton);
    
    // Should show error message
    await TestHelpers.waitForErrorMessage(page);
  });

  test('should logout successfully', async ({ page }) => {
    // First login
    await TestHelpers.login(page);
    
    // Then logout
    await TestHelpers.logout(page);
    
    // Verify we're redirected to login page
    await page.waitForURL('**/admin/login');
    await TestHelpers.expectElementVisible(page, testData.selectors.login.emailField);
  });

  test('should redirect to login when accessing protected pages without authentication', async ({ page }) => {
    // Try to access dashboard without login
    await TestHelpers.navigateTo(page, testData.urls.dashboard);
    
    // Should be redirected to login page
    await page.waitForURL('**/admin/login');
    await TestHelpers.expectElementVisible(page, testData.selectors.login.emailField);
  });

  test('should redirect to login when accessing pages without authentication', async ({ page }) => {
    // Try to access pages without login
    await TestHelpers.navigateTo(page, testData.urls.pages);
    
    // Should be redirected to login page
    await page.waitForURL('**/admin/login');
    await TestHelpers.expectElementVisible(page, testData.selectors.login.emailField);
  });

  test('should redirect to login when accessing users without authentication', async ({ page }) => {
    // Try to access users without login
    await TestHelpers.navigateTo(page, testData.urls.users);
    
    // Should be redirected to login page
    await page.waitForURL('**/admin/login');
    await TestHelpers.expectElementVisible(page, testData.selectors.login.emailField);
  });
}); 