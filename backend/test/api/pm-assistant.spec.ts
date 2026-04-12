import * as request from 'supertest';

const BASE_URL = process.env.TEST_API_URL || 'http://localhost:3000';
const TEST_USERNAME = process.env.TEST_USERNAME || 'admin';
const TEST_PASSWORD = process.env.TEST_PASSWORD || '123456';
const TEST_PROJECT_ID = parseInt(process.env.TEST_PROJECT_ID || '4', 10);

describe('PM Assistant API (e2e)', () => {
  let token: string;

  beforeAll(async () => {
    const response = await request(BASE_URL)
      .post('/api/v1/auth/login')
      .send({ username: TEST_USERNAME, password: TEST_PASSWORD });
    token = response.body.token;
  });

  it('should load PM assistant job definitions', async () => {
    const response = await request(BASE_URL)
      .get('/api/v1/pm-assistant/jobs')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body.length).toBeGreaterThan(0);
  });

  it('should dry-run a project-scoped PM assistant job', async () => {
    const response = await request(BASE_URL)
      .post('/api/v1/pm-assistant/run')
      .set('Authorization', `Bearer ${token}`)
      .send({
        jobId: 'weekly-report',
        dryRun: true,
        projectId: TEST_PROJECT_ID
      })
      .expect(201);

    expect(response.body).toHaveProperty('jobId', 'weekly-report');
    expect(response.body).toHaveProperty('sent', false);
    expect(response.body).toHaveProperty('summary');
  }, 120000);

  it('should load PM assistant logs for a project', async () => {
    const response = await request(BASE_URL)
      .get(`/api/v1/pm-assistant/logs?projectId=${TEST_PROJECT_ID}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);
  });
});
