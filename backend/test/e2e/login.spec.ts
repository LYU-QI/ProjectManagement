import { test, expect, type Page } from '@playwright/test';

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:5173';

test.describe('Login Flow', () => {
  async function login(page: Page) {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await page.locator('input[type="text"], input[placeholder*="账号"]').first().fill('admin');
    await page.locator('input[type="password"]').first().fill('123456');
    await page.click('button[type="submit"], button:has-text("登录")');
    await expect(page.getByText('SYSTEM.ONLINE')).toBeVisible({ timeout: 15000 });
  }

  test('should show login page and authenticate successfully', async ({ page }) => {
    await login(page);

    // Check we're on dashboard or workspace
    const body = await page.textContent('body');
    expect(body).toBeTruthy();
    // Should not show login form error
    expect(body).not.toContain('登录失败');
  });

  test('should navigate to schedule view after login', async ({ page }) => {
    await login(page);

    // Navigate to schedule
    await page.getByRole('button', { name: '项目管理', exact: true }).click();
    await page.getByRole('button', { name: '进度计划', exact: true }).click();
    await expect(page.locator('main')).toContainText('进度轴', { timeout: 15000 });

    await expect(page.locator('main')).toContainText('进度计划');
  });
});
