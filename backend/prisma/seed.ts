import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.user.upsert({
    where: { username: 'admin' },
    update: {
      name: 'Admin',
      password: '123456',
      role: 'pm'
    },
    create: {
      name: 'Admin',
      username: 'admin',
      password: '123456',
      role: 'pm'
    }
  });

  await prisma.user.upsert({
    where: { username: 'user' },
    update: {
      name: 'User',
      password: '123456',
      role: 'viewer'
    },
    create: {
      name: 'User',
      username: 'user',
      password: '123456',
      role: 'viewer'
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
