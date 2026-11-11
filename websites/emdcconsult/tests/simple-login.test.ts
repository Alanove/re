import { test, expect } from '@playwright/test';

test.describe('Simple Login Test', () => {
  test('should be able to access login page', async ({ page }) => {
    // Navigate to login page
    await page.goto('http://localhost:3000/admin/login');
    
    // Wait for page to load
    await page.waitForLoadState('networkidle');
    
    // Check if we're on the login page
    await expect(page).toHaveTitle(/Admin Login/);
    
    // Check if login form elements are present
    await expect(page.locator('input[type="email"], input[name="username"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('should login with admin credentials', async ({ page }) => {
    // Navigate to login page
    await page.goto('http://localhost:3000/admin/login');
    
    // Fill in credentials
    await page.fill('input[type="email"], input[name="username"]', 'admin@gebco.com');
    await page.fill('input[type="password"]', 'sei4aBallout');
    
    // Click login button
    await page.click('button[type="submit"]');
    
    // Wait for redirect to dashboard
    await page.waitForURL('**/admin/dashboard');
    
    // Verify we're on dashboard
    await expect(page).toHaveTitle(/Admin Dashboard/);
  });
}); 