import * as request from 'supertest';

const BASE_URL = process.env.TEST_API_URL || 'http://localhost:3000';
const TEST_USERNAME = process.env.TEST_USERNAME || 'admin';
const TEST_PASSWORD = process.env.TEST_PASSWORD || '123456';
const TEST_PROJECT_ID = parseInt(process.env.TEST_PROJECT_ID || '4', 10);

describe('Task Center API (e2e)', () => {
  let token: string;

  beforeAll(async () => {
    const response = await request(BASE_URL)
      .post('/api/v1/auth/login')
      .send({ username: TEST_USERNAME, password: TEST_PASSWORD });
    token = response.body.token;
  });

  it('should load task center items', async () => {
    const response = await request(BASE_URL)
      .get('/api/v1/task-center/items?limit=5')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);
  });

  it('should load task center stats', async () => {
    const response = await request(BASE_URL)
      .get('/api/v1/task-center/stats?days=7')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body).toHaveProperty('total');
    expect(response.body).toHaveProperty('bySource');
    expect(response.body).toHaveProperty('byStatus');
    expect(response.body).toHaveProperty('successRate');
    expect(response.body).toHaveProperty('topErrorCodes');
  });

  it('should support project-scoped task center queries', async () => {
    const response = await request(BASE_URL)
      .get(`/api/v1/task-center/items?projectId=${TEST_PROJECT_ID}&limit=5`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);
  });

  it('should support severity and errorCode filters', async () => {
    const response = await request(BASE_URL)
      .get('/api/v1/task-center/items?severity=critical&errorCode=TC-FEI-403&limit=5')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);
  });
});
