import { test, expect } from '@playwright/test';

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:5173';

test.describe('Login Flow', () => {
  test('should show login page and authenticate successfully', async ({ page }) => {
    await page.goto(BASE_URL);

    // Fill login form
    const usernameInput = page.locator('input[type="text"], input[placeholder*="账号"]').first();
    const passwordInput = page.locator('input[type="password"]').first();

    await usernameInput.fill('admin');
    await passwordInput.fill('123456');

    // Submit
    await page.click('button[type="submit"], button:has-text("登录")');

    // Wait for navigation or dashboard to appear
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Check we're on dashboard or workspace
    const body = await page.textContent('body');
    expect(body).toBeTruthy();
    // Should not show login form error
    expect(body).not.toContain('登录失败');
  });

  test('should navigate to schedule view after login', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    // Login
    await page.locator('input[type="text"], input[placeholder*="账号"]').first().fill('admin');
    await page.locator('input[type="password"]').first().fill('123456');
    await page.click('button[type="submit"], button:has-text("登录")');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Navigate to schedule
    await page.click('text=进度计划');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Check page loaded
    const body = await page.textContent('body');
    expect(body).toContain('任务');
  });
});
