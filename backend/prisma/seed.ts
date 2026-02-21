import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.user.upsert({
    where: { id: 1 },
    update: {
      name: 'PM Demo',
      username: 'pm',
      password: '123456',
      role: 'pm'
    },
    create: {
      id: 1,
      name: 'PM Demo',
      username: 'pm',
      password: '123456',
      role: 'pm'
    }
  });

  await prisma.user.upsert({
    where: { id: 2 },
    update: {
      name: 'Lead Demo',
      username: 'lead',
      password: '123456',
      role: 'lead'
    },
    create: {
      id: 2,
      name: 'Lead Demo',
      username: 'lead',
      password: '123456',
      role: 'lead'
    }
  });

  await prisma.user.upsert({
    where: { id: 3 },
    update: {
      name: 'Viewer Demo',
      username: 'viewer',
      password: '123456',
      role: 'viewer'
    },
    create: {
      id: 3,
      name: 'Viewer Demo',
      username: 'viewer',
      password: '123456',
      role: 'viewer'
    }
  });

  const projectCount = await prisma.project.count();
  if (projectCount === 0) {
    await prisma.project.create({
      data: {
        id: 1,
        name: 'CRM Upgrade',
        ownerId: 1,
        budget: 200000,
        startDate: '2026-02-01',
        endDate: '2026-05-31',
        requirements: {
          create: [
            {
              id: 1,
              title: 'Lead scoring automation',
              description: 'Auto classify leads by conversion probability.',
              priority: 'high',
              status: 'in_review',
              version: 'v1.0',
              changeCount: 1
            }
          ]
        },
        milestones: {
          create: [
            { id: 1, name: 'Design Sign-off', plannedDate: '2026-03-01' },
            { id: 2, name: 'UAT Complete', plannedDate: '2026-05-15' }
          ]
        },
        tasks: {
          create: [
            {
              id: 1,
              title: 'API Contract Finalization',
              assignee: 'Tech Lead',
              status: 'in_progress',
              plannedStart: '2026-02-10',
              plannedEnd: '2026-02-25'
            }
          ]
        }
      }
    });
  }

  const milestoneCount = await prisma.milestone.count();
  if (milestoneCount === 0) {
    await prisma.milestone.createMany({
      data: [
        { id: 1, projectId: 1, name: 'Design Sign-off', plannedDate: '2026-03-01' },
        { id: 2, projectId: 1, name: 'UAT Complete', plannedDate: '2026-05-15' }
      ]
    });
  }

  const taskCount = await prisma.task.count();
  if (taskCount === 0) {
    await prisma.task.create({
      data: {
        id: 1,
        projectId: 1,
        title: 'API Contract Finalization',
        assignee: 'Tech Lead',
        status: 'in_progress',
        plannedStart: '2026-02-10',
        plannedEnd: '2026-02-25'
      }
    });
  }

  const worklogCount = await prisma.worklog.count();
  if (worklogCount === 0) {
    await prisma.worklog.create({
      data: {
        projectId: 1,
        userId: 1,
        taskTitle: 'API Contract Finalization',
        hours: 6,
        hourlyRate: 300,
        workedOn: '2026-02-21',
        note: 'Kickoff worklog seed'
      }
    });
  }

  const notificationCount = await prisma.notification.count();
  if (notificationCount === 0) {
    await prisma.notification.create({
      data: {
        projectId: 1,
        level: 'info',
        title: '欢迎使用',
        message: '系统已完成初始化，可开始进行需求和进度管理。'
      }
    });
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
