import * as request from 'supertest';

const BASE_URL = process.env.TEST_API_URL || 'http://localhost:3000';
const TEST_USERNAME = process.env.TEST_USERNAME || 'admin';
const TEST_PASSWORD = process.env.TEST_PASSWORD || '123456';
const TEST_PROJECT_ID = parseInt(process.env.TEST_PROJECT_ID || '4', 10);

describe('Automation API (e2e)', () => {
  let token: string;
  let createdRuleId = '';
  let createdRuleOrgId = '';

  beforeAll(async () => {
    const response = await request(BASE_URL)
      .post('/api/v1/auth/login')
      .send({ username: TEST_USERNAME, password: TEST_PASSWORD });
    token = response.body.token;
  });

  afterAll(async () => {
    if (!createdRuleId) return;
    await request(BASE_URL)
      .delete(`/api/v1/automations/${createdRuleId}`)
      .set('Authorization', `Bearer ${token}`);
  });

  it('should create an automation rule', async () => {
    const response = await request(BASE_URL)
      .post('/api/v1/automations')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: `阶段2回归-${Date.now()}`,
        description: '阶段2 smoke test rule',
        trigger: 'requirement_created',
        conditions: [],
        actions: [
          {
            type: 'update_status',
            params: {
              entityType: 'requirement',
              status: 'draft'
            }
          }
        ],
        enabled: true
      })
      .expect(201);

    expect(response.body).toHaveProperty('id');
    expect(response.body).toHaveProperty('trigger', 'requirement_created');
    createdRuleId = response.body.id;
    createdRuleOrgId = response.body.organizationId;
  });

  it('should execute an automation rule test run', async () => {
    expect(createdRuleId).toBeTruthy();

    const response = await request(BASE_URL)
      .post(`/api/v1/automations/${createdRuleId}/run`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        payload: {
          organizationId: createdRuleOrgId,
          projectId: TEST_PROJECT_ID
        }
      })
      .expect(201);

    expect(response.body).toHaveProperty('success', true);
  });

  it('should retry an automation task through task center endpoint', async () => {
    expect(createdRuleId).toBeTruthy();

    const response = await request(BASE_URL)
      .post('/api/v1/task-center/retry')
      .set('Authorization', `Bearer ${token}`)
      .send({
        source: 'automation',
        retryMeta: {
          ruleId: createdRuleId,
          payload: {
            organizationId: createdRuleOrgId,
            projectId: TEST_PROJECT_ID
          }
        }
      })
      .expect(201);

    expect(response.body).toHaveProperty('success', true);
    expect(response.body).toHaveProperty('message');
  });

  it('should load automation execution logs', async () => {
    expect(createdRuleId).toBeTruthy();

    const response = await request(BASE_URL)
      .get(`/api/v1/automations/${createdRuleId}/logs`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);
  });
});
