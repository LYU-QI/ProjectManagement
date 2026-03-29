import * as request from 'supertest';

const BASE_URL = process.env.TEST_API_URL || 'http://localhost:3000';
const TEST_USERNAME = process.env.TEST_USERNAME || 'admin';
const TEST_PASSWORD = process.env.TEST_PASSWORD || '123456';
const TEST_PROJECT_ID = parseInt(process.env.TEST_PROJECT_ID || '4', 10);

describe('Requirements API (e2e)', () => {
  let token: string;
  let createdRequirementId: number;

  beforeAll(async () => {
    const response = await request(BASE_URL)
      .post('/api/v1/auth/login')
      .send({ username: TEST_USERNAME, password: TEST_PASSWORD });
    token = response.body.token;
  });

  describe('/GET api/v1/requirements', () => {
    it('should return 200 with valid token', async () => {
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

    it('should filter by projectId', async () => {
      const response = await request(BASE_URL)
        .get(`/api/v1/requirements?projectId=${TEST_PROJECT_ID}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('/POST api/v1/requirements', () => {
    it('should create a new requirement', async () => {
      const response = await request(BASE_URL)
        .post('/api/v1/requirements')
        .set('Authorization', `Bearer ${token}`)
        .send({
          projectId: TEST_PROJECT_ID,
          title: 'Test Requirement',
          description: 'Test description for e2e test',
          priority: 'medium'
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.title).toBe('Test Requirement');
      createdRequirementId = response.body.id;
    });

    it('should return 400 for missing required fields', async () => {
      await request(BASE_URL)
        .post('/api/v1/requirements')
        .set('Authorization', `Bearer ${token}`)
        .send({ projectId: TEST_PROJECT_ID })
        .expect(400);
    });
  });

  describe('/PATCH api/v1/requirements/:id', () => {
    it('should update a requirement', async () => {
      if (!createdRequirementId) return;

      const response = await request(BASE_URL)
        .patch(`/api/v1/requirements/${createdRequirementId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Updated Title', priority: 'high' })
        .expect(200);

      expect(response.body.title).toBe('Updated Title');
      expect(response.body.priority).toBe('high');
    });
  });

  describe('/DELETE api/v1/requirements/:id', () => {
    it('should delete a requirement', async () => {
      if (!createdRequirementId) return;

      await request(BASE_URL)
        .delete(`/api/v1/requirements/${createdRequirementId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
    });
  });
});
