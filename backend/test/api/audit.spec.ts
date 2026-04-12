import * as request from 'supertest';

const BASE_URL = process.env.TEST_API_URL || 'http://localhost:3000';
const TEST_USERNAME = process.env.TEST_USERNAME || 'superadmin';
const TEST_PASSWORD = process.env.TEST_PASSWORD || '123456';

describe('Audit API (e2e)', () => {
  let token: string;
  let viewerToken: string;
  let tempUserId: number | null = null;

  beforeAll(async () => {
    const response = await request(BASE_URL)
      .post('/api/v1/auth/login')
      .send({ username: TEST_USERNAME, password: TEST_PASSWORD })
      .expect(201);

    token = response.body.token;

    const viewerResponse = await request(BASE_URL)
      .post('/api/v1/auth/login')
      .send({ username: 'user', password: '123456' })
      .expect(201);

    viewerToken = viewerResponse.body.token;
  });

  afterAll(async () => {
    if (!tempUserId) return;
    await request(BASE_URL)
      .delete(`/api/v1/users/${tempUserId}`)
      .set('Authorization', `Bearer ${token}`);
  });

  it('should record successful and failed audit outcomes with enriched fields', async () => {
    await request(BASE_URL)
      .post('/api/v1/auth/login')
      .send({ username: TEST_USERNAME, password: TEST_PASSWORD })
      .expect(201);

    await request(BASE_URL)
      .post('/api/v1/auth/login')
      .send({ username: TEST_USERNAME, password: '__invalid_password__' })
      .expect(401);

    const response = await request(BASE_URL)
      .get('/api/v1/audit-logs')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);

    const successRow = response.body.find((row: Record<string, unknown>) =>
      row.path === '/api/v1/auth/login' && row.outcome === 'success' && row.statusCode === 201
    );
    const failedRow = response.body.find((row: Record<string, unknown>) =>
      row.path === '/api/v1/auth/login' && row.outcome === 'failed' && row.statusCode === 401
    );

    expect(successRow).toBeTruthy();
    expect(successRow.resourceType).toBe('auth');
    expect(successRow).toHaveProperty('requestBody');

    expect(failedRow).toBeTruthy();
    expect(failedRow.resourceType).toBe('auth');
    expect(failedRow.errorMessage).toBe('Invalid credentials');
  });

  it('should export enriched audit logs as csv', async () => {
    const response = await request(BASE_URL)
      .get('/api/v1/audit-logs/export')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.headers['content-type']).toContain('text/csv');
    expect(response.text).toContain('结果');
    expect(response.text).toContain('状态码');
    expect(response.text).toContain('错误信息');
    expect(response.text).toContain('资源类型');
    expect(response.text).toContain('来源');
    expect(response.text).toContain('变更前');
    expect(response.text).toContain('变更后');
    expect(response.text).toContain('/api/v1/auth/login');
  });

  it('should record before/after snapshots for high-risk user role changes', async () => {
    const username = `tmp_audit_role_${Date.now()}`;
    const createResponse = await request(BASE_URL)
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${token}`)
      .send({
        username,
        name: 'Tmp Audit Role',
        password: '123456',
        role: 'viewer'
      })
      .expect(201);

    tempUserId = createResponse.body.id;

    await request(BASE_URL)
      .patch(`/api/v1/users/${tempUserId}/role`)
      .set('Authorization', `Bearer ${token}`)
      .send({ role: 'member' })
      .expect(200);

    const response = await request(BASE_URL)
      .get('/api/v1/audit-logs')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const row = response.body.find((item: Record<string, unknown>) =>
      item.path === `/api/v1/users/${tempUserId}/role`
      && item.source === 'user_management.role_change'
      && item.outcome === 'success'
    );

    expect(row).toBeTruthy();
    expect(row.beforeSnapshot).toMatchObject({ id: tempUserId, role: 'viewer' });
    expect(row.afterSnapshot).toMatchObject({ id: tempUserId, role: 'member' });
  });

  it('should record AI_CHAT failure audits with scope and outcome', async () => {
    const chatResponse = await request(BASE_URL)
      .post('/api/v1/ai/chat')
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({ message: '帮我总结当前项目重点风险' })
      .expect(201);

    expect(chatResponse.body).toHaveProperty('content');

    const response = await request(BASE_URL)
      .get('/api/v1/audit-logs/chatbot')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);

    const row = response.body.find((item: Record<string, unknown>) =>
      item.message === '帮我总结当前项目重点风险'
      && item.mode === 'error'
      && item.outcome === 'failed'
    );

    expect(row).toBeTruthy();
    expect(row.error).toBe('no_accessible_project');
    expect(row.statusCode).toBe(500);
    expect(row.resourceType).toBe('ai-chat');
    expect(Array.isArray(row.scopedProjectNames)).toBe(true);
  });
});
