import * as request from 'supertest';

const BASE_URL = process.env.TEST_API_URL || 'http://localhost:3000';
const TEST_USERNAME = process.env.TEST_USERNAME || 'admin';
const TEST_PASSWORD = process.env.TEST_PASSWORD || '123456';
const TEST_PROJECT_ID = parseInt(process.env.TEST_PROJECT_ID || '4', 10);

describe('Feishu API (e2e)', () => {
  let token: string;

  beforeAll(async () => {
    const response = await request(BASE_URL)
      .post('/api/v1/auth/login')
      .send({ username: TEST_USERNAME, password: TEST_PASSWORD });
    token = response.body.token;
  });

  it('should load project-scoped Feishu records', async () => {
    const response = await request(BASE_URL)
      .get(`/api/v1/feishu/records?projectId=${TEST_PROJECT_ID}&pageSize=5`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body).toHaveProperty('items');
    expect(Array.isArray(response.body.items)).toBe(true);
  });
});
