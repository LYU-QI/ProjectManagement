import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { PrismaClient } from '@prisma/client';

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:5173';
const API_BASE_URL = process.env.TEST_API_URL || 'http://127.0.0.1:3002';
const prisma = new PrismaClient();

function randomAlias(prefix = 'STG'): string {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let suffix = '';
  for (let i = 0; i < 5; i += 1) {
    suffix += letters[Math.floor(Math.random() * letters.length)];
  }
  return `${prefix}${suffix}`;
}

async function login(page: Page) {
  await page.goto(BASE_URL);
  await page.waitForLoadState('networkidle');
  await page.locator('input[type="text"], input[placeholder*="账号"]').first().fill('admin');
  await page.locator('input[type="password"]').first().fill('123456');
  await page.click('button[type="submit"], button:has-text("登录")');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);
}

async function openGroupedView(page: Page, groupLabel: string, itemLabel: string) {
  await page.getByRole('button', { name: groupLabel, exact: true }).click();
  await page.getByRole('button', { name: itemLabel, exact: true }).click();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(800);
}

async function loginByApi(request: APIRequestContext) {
  const response = await request.post(`${API_BASE_URL}/api/v1/auth/login`, {
    data: { username: 'admin', password: '123456' }
  });
  expect(response.ok()).toBeTruthy();
  return response.json() as Promise<{ token: string; organizationId: string }>;
}

test.describe('Stage 2 Navigation Smoke', () => {
  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test('should open task center and recovery-related pages', async ({ page }) => {
    await login(page);

    await openGroupedView(page, 'AI 与工具', '任务中心');
    await expect(page.locator('body')).toContainText('统一任务中心');

    await openGroupedView(page, '协作', '飞书集成');
    await expect(page.locator('body')).toContainText('飞书多维表格');

    await openGroupedView(page, 'AI 与工具', 'PM 助手');
    await expect(page.locator('body')).toContainText('PM Assistant');

    await openGroupedView(page, 'AI 与工具', '自动化规则');
    await expect(page.locator('body')).toContainText('新建规则');
  });

  test('should jump from task center failed pm assistant item to recovery page', async ({ page, request }) => {
    test.setTimeout(60000);
    const auth = await loginByApi(request);
    let projectId: number | null = null;
    let logId: number | null = null;

    try {
      const createdProject = await request.post(`${API_BASE_URL}/api/v1/projects`, {
        headers: {
          Authorization: `Bearer ${auth.token}`,
          'X-Org-Id': auth.organizationId
        },
        data: {
          name: `Stage2 恢复跳转 ${Date.now()}`,
          alias: randomAlias(),
          budget: 1000,
          startDate: '2026-04-01',
          endDate: '2026-04-30',
          feishuChatIds: ''
        }
      });
      expect(createdProject.ok()).toBeTruthy();
      const project = await createdProject.json() as { id: number };
      projectId = project.id;

      await page.addInitScript((nextProjectId) => {
        window.localStorage.setItem('ui:lastProjectId', String(nextProjectId));
      }, project.id);

      const createdLog = await prisma.pmAssistantLog.create({
        data: {
          organizationId: auth.organizationId,
          projectId: project.id,
          jobId: 'weekly-report',
          triggeredBy: 'manual',
          status: 'failed',
          summary: '任务执行失败: weekly-report',
          error: '未找到可用群聊 Chat ID，请先在项目管理列表中为项目配置 chat_id。'
        }
      });
      logId = createdLog.id;

      await login(page);

      await openGroupedView(page, 'AI 与工具', '任务中心');

      const toolbarSelects = page.locator('.task-center-toolbar select');
      await toolbarSelects.nth(0).selectOption('pm_assistant');
      await toolbarSelects.nth(1).selectOption('failed');
      await page.getByPlaceholder('搜索标题、摘要、项目、操作人').fill('weekly-report');
      await page.waitForTimeout(1500);

      await page.getByRole('button', { name: '详情' }).first().click();
      await page.getByRole('button', { name: '前往处理' }).first().click();

      await page.waitForLoadState('networkidle');
      await expect(page.locator('body')).toContainText('来自任务中心的恢复上下文');
      await expect(page.locator('body')).toContainText('PM 助手');
    } finally {
      if (logId) {
        await prisma.pmAssistantLog.deleteMany({
          where: { id: logId }
        });
      }
      if (projectId) {
        await request.delete(`${API_BASE_URL}/api/v1/projects/${projectId}`, {
          headers: {
            Authorization: `Bearer ${auth.token}`,
            'X-Org-Id': auth.organizationId
          }
        });
      }
    }
  });

  test('should jump from task center feishu item to recovery page', async ({ page, request }) => {
    test.setTimeout(60000);
    const auth = await loginByApi(request);
    let projectId: number | null = null;
    let auditLogId: number | null = null;

    try {
      const createdProject = await request.post(`${API_BASE_URL}/api/v1/projects`, {
        headers: {
          Authorization: `Bearer ${auth.token}`,
          'X-Org-Id': auth.organizationId
        },
        data: {
          name: `Stage2 飞书恢复 ${Date.now()}`,
          alias: randomAlias('FEI'),
          budget: 1000,
          startDate: '2026-04-01',
          endDate: '2026-04-30',
          feishuChatIds: ''
        }
      });
      expect(createdProject.ok()).toBeTruthy();
      const project = await createdProject.json() as { id: number };
      projectId = project.id;

      await page.addInitScript((nextProjectId) => {
        window.localStorage.setItem('ui:lastProjectId', String(nextProjectId));
      }, project.id);

      const createdAuditLog = await prisma.auditLog.create({
        data: {
          organizationId: auth.organizationId,
          projectId: project.id,
          userName: 'Admin',
          method: 'PUT',
          path: `/api/v1/feishu/records/mock-record?projectId=${project.id}`,
          requestBody: {
            error: '飞书权限不足（91403 Forbidden）。请检查应用协作者与读写权限。',
            fields: {
              status: '待处理'
            }
          }
        }
      });
      auditLogId = createdAuditLog.id;

      await login(page);

      await openGroupedView(page, 'AI 与工具', '任务中心');

      const toolbarSelects = page.locator('.task-center-toolbar select');
      await toolbarSelects.nth(0).selectOption('feishu');
      await toolbarSelects.nth(1).selectOption('failed');
      await page.getByPlaceholder('搜索标题、摘要、项目、操作人').fill('mock-record');
      await page.waitForTimeout(1500);

      await page.getByRole('button', { name: '详情' }).first().click();
      await page.getByRole('button', { name: '前往处理' }).first().click();

      await page.waitForLoadState('networkidle');
      await expect(page.locator('body')).toContainText('来自任务中心的恢复上下文');
      await expect(page.locator('body')).toContainText('飞书集成');
    } finally {
      if (auditLogId) {
        await prisma.auditLog.deleteMany({
          where: { id: auditLogId }
        });
      }
      if (projectId) {
        await request.delete(`${API_BASE_URL}/api/v1/projects/${projectId}`, {
          headers: {
            Authorization: `Bearer ${auth.token}`,
            'X-Org-Id': auth.organizationId
          }
        });
      }
    }
  });

  test('should jump from task center failed automation item to recovery page', async ({ page, request }) => {
    test.setTimeout(60000);
    const auth = await loginByApi(request);
    let projectId: number | null = null;
    let ruleId: string | null = null;
    let logId: string | null = null;

    try {
      const createdProject = await request.post(`${API_BASE_URL}/api/v1/projects`, {
        headers: {
          Authorization: `Bearer ${auth.token}`,
          'X-Org-Id': auth.organizationId
        },
        data: {
          name: `Stage2 自动化恢复 ${Date.now()}`,
          alias: randomAlias('AUT'),
          budget: 1000,
          startDate: '2026-04-01',
          endDate: '2026-04-30',
          feishuChatIds: ''
        }
      });
      expect(createdProject.ok()).toBeTruthy();
      const project = await createdProject.json() as { id: number };
      projectId = project.id;

      await page.addInitScript((nextProjectId) => {
        window.localStorage.setItem('ui:lastProjectId', String(nextProjectId));
      }, project.id);

      const createdRule = await prisma.automationRule.create({
        data: {
          organizationId: auth.organizationId,
          name: `Stage2 自动化失败 ${Date.now()}`,
          description: '用于任务中心恢复跳转回归',
          trigger: 'workitem_status_changed',
          conditions: {},
          actions: {}
        }
      });
      ruleId = createdRule.id;

      const createdLog = await prisma.automationLog.create({
        data: {
          ruleId: createdRule.id,
          trigger: 'workitem_status_changed',
          payload: {
            itemId: 1,
            status: 'blocked'
          },
          actionsRun: [],
          success: false,
          error: '自动化规则执行失败：缺少 webhook 地址。'
        }
      });
      logId = createdLog.id;

      await login(page);

      await openGroupedView(page, 'AI 与工具', '任务中心');

      const toolbarSelects = page.locator('.task-center-toolbar select');
      await toolbarSelects.nth(0).selectOption('automation');
      await toolbarSelects.nth(1).selectOption('failed');
      await page.getByPlaceholder('搜索标题、摘要、项目、操作人').fill('Stage2 自动化失败');
      await page.waitForTimeout(1500);

      await page.getByRole('button', { name: '详情' }).first().click();
      await page.getByRole('button', { name: '前往处理' }).first().click();

      await page.waitForLoadState('networkidle');
      await expect(page.locator('body')).toContainText('来自任务中心的恢复上下文');
      await expect(page.locator('body')).toContainText('自动化规则');
      await expect(page.locator('body')).toContainText('自动化规则执行失败：缺少 webhook 地址。');
    } finally {
      if (logId) {
        await prisma.automationLog.deleteMany({
          where: { id: logId }
        });
      }
      if (ruleId) {
        await prisma.automationRule.deleteMany({
          where: { id: ruleId }
        });
      }
      if (projectId) {
        await request.delete(`${API_BASE_URL}/api/v1/projects/${projectId}`, {
          headers: {
            Authorization: `Bearer ${auth.token}`,
            'X-Org-Id': auth.organizationId
          }
        });
      }
    }
  });
});
