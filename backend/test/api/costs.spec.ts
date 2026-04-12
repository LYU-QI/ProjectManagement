import * as request from 'supertest';

const BASE_URL = process.env.TEST_API_URL || 'http://localhost:3000';
const TEST_USERNAME = process.env.TEST_USERNAME || 'admin';
const TEST_PASSWORD = process.env.TEST_PASSWORD || '123456';
const TEST_PROJECT_ID = parseInt(process.env.TEST_PROJECT_ID || '4', 10);

describe('Costs API (e2e)', () => {
  let token: string;

  beforeAll(async () => {
    const response = await request(BASE_URL)
      .post('/api/v1/auth/login')
      .send({ username: TEST_USERNAME, password: TEST_PASSWORD });
    token = response.body.token;
  });

  it('should load cost entries for a project', async () => {
    const response = await request(BASE_URL)
      .get(`/api/v1/cost-entries?projectId=${TEST_PROJECT_ID}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);
  });

  it('should load cost summary with unified metrics fields', async () => {
    const response = await request(BASE_URL)
      .get(`/api/v1/cost-entries/summary?projectId=${TEST_PROJECT_ID}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body).toHaveProperty('projectId', TEST_PROJECT_ID);
    expect(response.body).toHaveProperty('budget');
    expect(response.body).toHaveProperty('actual');
    expect(response.body).toHaveProperty('varianceRate');
    expect(response.body).toHaveProperty('byType');
    expect(response.body.byType).toHaveProperty('labor');
    expect(response.body.byType).toHaveProperty('outsource');
    expect(response.body.byType).toHaveProperty('cloud');
  });
});
