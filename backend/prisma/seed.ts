import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // 1. Create or ensure default organization exists
  const defaultOrg = await prisma.organization.upsert({
    where: { slug: 'default' },
    update: {},
    create: {
      id: 'default',
      slug: 'default',
      name: 'Default Organization',
      plan: 'PRO',
      maxMembers: 100,
    }
  });

  // 2. Create/update test users
  const adminUser = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      name: 'Admin User',
      username: 'admin',
      password: '123456',
      role: 'pm'
    }
  });

  const viewerUser = await prisma.user.upsert({
    where: { username: 'user' },
    update: {},
    create: {
      name: 'Viewer User',
      username: 'user',
      password: '123456',
      role: 'viewer'
    }
  });

  // 3. Assign users to default org
  await prisma.orgMember.upsert({
    where: { userId_organizationId: { userId: adminUser.id, organizationId: defaultOrg.id } },
    update: { orgRole: 'owner' },
    create: {
      id: `${defaultOrg.id}-${adminUser.id}`,
      userId: adminUser.id,
      organizationId: defaultOrg.id,
      orgRole: 'owner',
    }
  });

  await prisma.orgMember.upsert({
    where: { userId_organizationId: { userId: viewerUser.id, organizationId: defaultOrg.id } },
    update: {},
    create: {
      id: `${defaultOrg.id}-${viewerUser.id}`,
      userId: viewerUser.id,
      organizationId: defaultOrg.id,
      orgRole: 'member',
    }
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
