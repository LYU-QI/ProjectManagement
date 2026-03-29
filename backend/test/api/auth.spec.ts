import * as request from 'supertest';

const BASE_URL = process.env.TEST_API_URL || 'http://localhost:3000';
const TEST_USERNAME = process.env.TEST_USERNAME || 'admin';
const TEST_PASSWORD = process.env.TEST_PASSWORD || '123456';

describe('Auth API (e2e)', () => {
  describe('/POST api/v1/auth/login', () => {
    it('should return 201 and a token for valid credentials', async () => {
      const response = await request(BASE_URL)
        .post('/api/v1/auth/login')
        .send({ username: TEST_USERNAME, password: TEST_PASSWORD })
        .expect(201);

      expect(response.body).toHaveProperty('token');
      expect(typeof response.body.token).toBe('string');
      expect(response.body.token.length).toBeGreaterThan(0);
    });

    it('should return 401 for invalid credentials', async () => {
      const response = await request(BASE_URL)
        .post('/api/v1/auth/login')
        .send({ username: 'invalid', password: 'wrong' })
        .expect(401);

      expect(response.body).toHaveProperty('message');
    });

    it('should return 400 for missing credentials', async () => {
      await request(BASE_URL)
        .post('/api/v1/auth/login')
        .send({})
        .expect(400);
    });
  });

  describe('authenticated requests', () => {
    let token: string;

    beforeAll(async () => {
      const response = await request(BASE_URL)
        .post('/api/v1/auth/login')
        .send({ username: TEST_USERNAME, password: TEST_PASSWORD });
      token = response.body.token;
    });

    it('should access protected endpoint with valid token', async () => {
      await request(BASE_URL)
        .get('/api/v1/requirements')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
    });

    it('should return 401 without token', async () => {
      await request(BASE_URL)
        .get('/api/v1/requirements')
        .expect(401);
    });
  });
});
