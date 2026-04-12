import * as request from 'supertest';

const BASE_URL = process.env.TEST_API_URL || 'http://localhost:3000';

function randomAlias() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  return `TMP${Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')}`;
}

describe('Permission boundary API (e2e)', () => {
  let superToken: string;
  let viewerToken: string;
  let pmToken: string;
  let tempProjectId: number | null = null;
  let tempUserId: number | null = null;
  let auditLeakUserId: number | null = null;
  let pmMembershipId: number | null = null;

  beforeAll(async () => {
    const [superadminLogin, viewerLogin, pmLogin] = await Promise.all([
      request(BASE_URL).post('/api/v1/auth/login').send({ username: 'superadmin', password: '123456' }).expect(201),
      request(BASE_URL).post('/api/v1/auth/login').send({ username: 'user', password: '123456' }).expect(201),
      request(BASE_URL).post('/api/v1/auth/login').send({ username: 'ricky', password: '123456' }).expect(201)
    ]);

    superToken = superadminLogin.body.token;
    viewerToken = viewerLogin.body.token;
    pmToken = pmLogin.body.token;
  });

  afterAll(async () => {
    if (pmMembershipId) {
      await request(BASE_URL)
        .delete(`/api/v1/project-memberships/${pmMembershipId}`)
        .set('Authorization', `Bearer ${superToken}`);
    }
    if (tempProjectId) {
      await request(BASE_URL)
        .delete(`/api/v1/projects/${tempProjectId}`)
        .set('Authorization', `Bearer ${superToken}`);
    }
    if (tempUserId) {
      await request(BASE_URL)
        .delete(`/api/v1/users/${tempUserId}`)
        .set('Authorization', `Bearer ${superToken}`);
    }
    if (auditLeakUserId) {
      await request(BASE_URL)
        .delete(`/api/v1/users/${auditLeakUserId}`)
        .set('Authorization', `Bearer ${superToken}`);
    }
  });

  it('should reject cross-project reads and writes for users without project access', async () => {
    const createProjectResponse = await request(BASE_URL)
      .post('/api/v1/projects')
      .set('Authorization', `Bearer ${superToken}`)
      .send({
        name: `权限测试项目-${Date.now()}`,
        alias: randomAlias(),
        budget: 1000,
        startDate: '2026-04-12',
        endDate: '2026-04-30'
      })
      .expect(201);

    tempProjectId = createProjectResponse.body.id;

    await request(BASE_URL)
      .get(`/api/v1/requirements?projectId=${tempProjectId}`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .expect(403);

    const writeResponse = await request(BASE_URL)
      .post('/api/v1/requirements')
      .set('Authorization', `Bearer ${pmToken}`)
      .send({
        projectId: tempProjectId,
        title: '越权需求',
        description: 'pm should not create requirement in inaccessible project',
        priority: 'medium'
      })
      .expect(403);

    expect(String(writeResponse.body.message)).toContain(`No access to project ${tempProjectId}`);
  });

  it('should reject authorization changes by non-project-owner pm users', async () => {
    if (!tempProjectId) throw new Error('tempProjectId missing');

    const createUserResponse = await request(BASE_URL)
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${superToken}`)
      .send({
        username: `tmp_perm_${Date.now()}`,
        name: 'Tmp Permission User',
        password: '123456',
        role: 'viewer'
      })
      .expect(201);

    tempUserId = createUserResponse.body.id;

    await request(BASE_URL)
      .post('/api/v1/organizations/default/members/invite')
      .set('Authorization', `Bearer ${superToken}`)
      .send({ userId: String(tempUserId), role: 'member' })
      .expect(201);

    const grantPmMembership = await request(BASE_URL)
      .post('/api/v1/project-memberships')
      .set('Authorization', `Bearer ${superToken}`)
      .send({
        userId: 6,
        projectId: tempProjectId,
        role: 'viewer'
      })
      .expect(201);

    pmMembershipId = grantPmMembership.body.id;

    const membershipChangeResponse = await request(BASE_URL)
      .post('/api/v1/project-memberships')
      .set('Authorization', `Bearer ${pmToken}`)
      .send({
        userId: tempUserId,
        projectId: tempProjectId,
        role: 'member'
      })
      .expect(403);

    expect(String(membershipChangeResponse.body.message)).toContain('Only project creator can manage project members');

    const orgRoleChangeResponse = await request(BASE_URL)
      .patch(`/api/v1/organizations/default/members/${tempUserId}`)
      .set('Authorization', `Bearer ${pmToken}`)
      .send({ role: 'admin' })
      .expect(403);

    expect(String(orgRoleChangeResponse.body.message)).toContain('Only owner or admin can update member roles');
  });

  it('should block non-super-admin users from revealing sensitive config values', async () => {
    const forbiddenReveal = await request(BASE_URL)
      .get('/api/v1/config?reveal=true')
      .set('Authorization', `Bearer ${pmToken}`)
      .expect(403);

    expect(String(forbiddenReveal.body.message)).toContain('Only super_admin can reveal sensitive config values');

    const maskedList = await request(BASE_URL)
      .get('/api/v1/config')
      .set('Authorization', `Bearer ${pmToken}`)
      .expect(200);

    expect(Array.isArray(maskedList.body)).toBe(true);
    const sensitiveItem = maskedList.body.find((item: Record<string, unknown>) => item.key === 'JWT_SECRET');
    expect(sensitiveItem).toBeTruthy();
    expect(sensitiveItem.sensitive).toBe(true);
  });

  it('should not expose organization-level audit logs to project-scoped pm users', async () => {
    const createUserResponse = await request(BASE_URL)
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${superToken}`)
      .send({
        username: `tmp_audit_leak_${Date.now()}`,
        name: 'Tmp Audit Leak User',
        password: '123456',
        role: 'viewer'
      })
      .expect(201);

    auditLeakUserId = createUserResponse.body.id;

    const auditResponse = await request(BASE_URL)
      .get('/api/v1/audit-logs')
      .set('Authorization', `Bearer ${pmToken}`)
      .expect(200);

    expect(Array.isArray(auditResponse.body)).toBe(true);
    const leakedRow = auditResponse.body.find((item: Record<string, unknown>) =>
      item.source === 'user_management.create'
      && (item.afterSnapshot as Record<string, unknown> | undefined)?.id === auditLeakUserId
    );
    expect(leakedRow).toBeFalsy();
  });
});
