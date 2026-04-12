import * as request from 'supertest';

const BASE_URL = process.env.TEST_API_URL || 'http://localhost:3000';
const TEST_USERNAME = process.env.TEST_USERNAME || 'superadmin';
const TEST_PASSWORD = process.env.TEST_PASSWORD || '123456';

describe('Users API (e2e)', () => {
  let token: string;
  let currentUserId: number;

  beforeAll(async () => {
    const response = await request(BASE_URL)
      .post('/api/v1/auth/login')
      .send({ username: TEST_USERNAME, password: TEST_PASSWORD })
      .expect(201);

    token = response.body.token;
    currentUserId = response.body.user.id;
  });

  it('should allow super_admin to delete a temporary user', async () => {
    const username = `tmp_delete_spec_${Date.now()}`;
    const createResponse = await request(BASE_URL)
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${token}`)
      .send({
        username,
        name: 'Tmp Delete Spec',
        password: '123456',
        role: 'viewer'
      })
      .expect(201);

    const deleteResponse = await request(BASE_URL)
      .delete(`/api/v1/users/${createResponse.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(deleteResponse.body).toEqual({
      id: createResponse.body.id,
      username,
      ok: true
    });
  });

  it('should block deleting the current logged-in user', async () => {
    const response = await request(BASE_URL)
      .delete(`/api/v1/users/${currentUserId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(400);

    expect(response.body.message).toBe('Cannot delete the current logged-in user');
  });
});
