import {
  AutomationAction,
  AutomationTrigger,
  BugPriority,
  BugSeverity,
  BugStatus,
  OrgRole,
  Plan,
  PrismaClient,
  ProjectRole,
  RequirementPriority,
  RequirementStatus,
  ReviewDecision,
  SprintStatus,
  TaskStatus,
  TestCasePriority,
  TestCaseStatus,
  TestPlanStatus,
  UserRole,
  WorkItemPriority,
  WorkItemStatus,
  WorkItemType
} from '@prisma/client';

const prisma = new PrismaClient();

async function ensureUser(params: {
  username: string;
  name: string;
  password: string;
  role: UserRole;
  defaultOrgId: string;
}) {
  return prisma.user.upsert({
    where: { username: params.username },
    update: {
      name: params.name,
      password: params.password,
      role: params.role,
      defaultOrgId: params.defaultOrgId
    },
    create: {
      username: params.username,
      name: params.name,
      password: params.password,
      role: params.role,
      defaultOrgId: params.defaultOrgId
    }
  });
}

async function ensureOrgMember(params: {
  userId: number;
  organizationId: string;
  orgRole: OrgRole;
  departmentId?: string | null;
}) {
  return prisma.orgMember.upsert({
    where: {
      userId_organizationId: {
        userId: params.userId,
        organizationId: params.organizationId
      }
    },
    update: {
      orgRole: params.orgRole,
      departmentId: params.departmentId ?? null
    },
    create: {
      userId: params.userId,
      organizationId: params.organizationId,
      orgRole: params.orgRole,
      departmentId: params.departmentId ?? null
    }
  });
}

async function ensureDepartment(params: {
  organizationId: string;
  name: string;
  parentId?: string | null;
  sortOrder?: number;
  feishuDeptId?: string | null;
}) {
  const existing = await prisma.department.findFirst({
    where: {
      organizationId: params.organizationId,
      name: params.name,
      parentId: params.parentId ?? null
    }
  });

  if (existing) {
    return prisma.department.update({
      where: { id: existing.id },
      data: {
        sortOrder: params.sortOrder ?? existing.sortOrder,
        feishuDeptId: params.feishuDeptId ?? existing.feishuDeptId
      }
    });
  }

  return prisma.department.create({
    data: {
      organizationId: params.organizationId,
      name: params.name,
      parentId: params.parentId ?? null,
      sortOrder: params.sortOrder ?? 0,
      feishuDeptId: params.feishuDeptId ?? null
    }
  });
}

async function main() {
  const defaultOrg = await prisma.organization.upsert({
    where: { slug: 'default' },
    update: {
      name: '弋途',
      plan: Plan.PRO,
      maxMembers: 100
    },
    create: {
      id: 'default',
      slug: 'default',
      name: '弋途',
      plan: Plan.PRO,
      maxMembers: 100
    }
  });

  const superAdmin = await ensureUser({
    username: 'superadmin',
    name: 'Super Admin',
    password: '123456',
    role: UserRole.super_admin,
    defaultOrgId: defaultOrg.id
  });

  const adminUser = await ensureUser({
    username: 'admin',
    name: 'Admin User',
    password: '123456',
    role: UserRole.pm,
    defaultOrgId: defaultOrg.id
  });

  const viewerUser = await ensureUser({
    username: 'user',
    name: 'Viewer User',
    password: '123456',
    role: UserRole.viewer,
    defaultOrgId: defaultOrg.id
  });

  const rickyUser = await ensureUser({
    username: 'ricky',
    name: '吕琦',
    password: '123456',
    role: UserRole.pm,
    defaultOrgId: defaultOrg.id
  });

  const managementDept = await ensureDepartment({
    organizationId: defaultOrg.id,
    name: '项目管理部',
    sortOrder: 10
  });
  const productDept = await ensureDepartment({
    organizationId: defaultOrg.id,
    name: '产品与设计部',
    sortOrder: 20
  });
  const engineeringDept = await ensureDepartment({
    organizationId: defaultOrg.id,
    name: '研发交付部',
    sortOrder: 30
  });
  const qaDept = await ensureDepartment({
    organizationId: defaultOrg.id,
    name: '测试质量部',
    sortOrder: 40
  });

  await ensureOrgMember({
    userId: superAdmin.id,
    organizationId: defaultOrg.id,
    orgRole: OrgRole.owner,
    departmentId: managementDept.id
  });
  await ensureOrgMember({
    userId: adminUser.id,
    organizationId: defaultOrg.id,
    orgRole: OrgRole.admin,
    departmentId: managementDept.id
  });
  await ensureOrgMember({
    userId: viewerUser.id,
    organizationId: defaultOrg.id,
    orgRole: OrgRole.viewer,
    departmentId: productDept.id
  });
  await ensureOrgMember({
    userId: rickyUser.id,
    organizationId: defaultOrg.id,
    orgRole: OrgRole.member,
    departmentId: engineeringDept.id
  });

  const project = await prisma.project.upsert({
    where: { alias: 'BQCZ' },
    update: {
      name: '北汽车展POC项目',
      organizationId: defaultOrg.id,
      ownerId: superAdmin.id,
      budget: 450000,
      startDate: '2026-02-26',
      endDate: '2026-03-27'
    },
    create: {
      name: '北汽车展POC项目',
      alias: 'BQCZ',
      organizationId: defaultOrg.id,
      ownerId: superAdmin.id,
      budget: 450000,
      startDate: '2026-02-26',
      endDate: '2026-03-27'
    }
  });

  await prisma.projectMembership.upsert({
    where: {
      userId_projectId: {
        userId: superAdmin.id,
        projectId: project.id
      }
    },
    update: { organizationId: defaultOrg.id, role: ProjectRole.director },
    create: {
      userId: superAdmin.id,
      projectId: project.id,
      organizationId: defaultOrg.id,
      role: ProjectRole.director
    }
  });
  await prisma.projectMembership.upsert({
    where: {
      userId_projectId: {
        userId: rickyUser.id,
        projectId: project.id
      }
    },
    update: { organizationId: defaultOrg.id, role: ProjectRole.manager },
    create: {
      userId: rickyUser.id,
      projectId: project.id,
      organizationId: defaultOrg.id,
      role: ProjectRole.manager
    }
  });
  await prisma.projectMembership.upsert({
    where: {
      userId_projectId: {
        userId: adminUser.id,
        projectId: project.id
      }
    },
    update: { organizationId: defaultOrg.id, role: ProjectRole.member },
    create: {
      userId: adminUser.id,
      projectId: project.id,
      organizationId: defaultOrg.id,
      role: ProjectRole.member
    }
  });

  const requirementCount = await prisma.requirement.count({ where: { projectId: project.id } });
  if (requirementCount === 0) {
    const req1 = await prisma.requirement.create({
      data: {
        projectId: project.id,
        projectSeq: 204,
        title: '完成车展交互主链路需求冻结',
        description: '完成北汽车展现场主展项的语音交互、路线导览、讲解播报与后台监控需求冻结。',
        priority: RequirementPriority.high,
        status: RequirementStatus.approved,
        version: 'v1.0'
      }
    });
    const req2 = await prisma.requirement.create({
      data: {
        projectId: project.id,
        projectSeq: 205,
        title: '联调与彩排支持能力',
        description: '提供现场联调、彩排演练、日志回放及应急切换能力，满足交付窗口要求。',
        priority: RequirementPriority.medium,
        status: RequirementStatus.planned,
        version: 'v1.0'
      }
    });

    await prisma.requirementReview.createMany({
      data: [
        {
          requirementId: req1.id,
          reviewer: '吕琦',
          decision: ReviewDecision.approved,
          comment: '范围与交付节点明确，可以进入排期。'
        },
        {
          requirementId: req2.id,
          reviewer: 'Admin User',
          decision: ReviewDecision.approved,
          comment: '联调保障项纳入交付准备阶段。'
        }
      ]
    });
  }

  const sprintCount = await prisma.sprint.count({ where: { projectId: project.id } });
  if (sprintCount === 0) {
    await prisma.sprint.createMany({
      data: [
        {
          projectId: project.id,
          organizationId: defaultOrg.id,
          name: 'Sprint 1 - 需求冻结与方案确认',
          goal: '冻结核心需求并完成方案评审',
          status: SprintStatus.completed,
          startDate: '2026-02-26',
          endDate: '2026-03-04'
        },
        {
          projectId: project.id,
          organizationId: defaultOrg.id,
          name: 'Sprint 2 - 开发与联调',
          goal: '完成关键能力开发并进入联调',
          status: SprintStatus.active,
          startDate: '2026-03-05',
          endDate: '2026-03-18'
        },
        {
          projectId: project.id,
          organizationId: defaultOrg.id,
          name: 'Sprint 3 - 彩排与交付',
          goal: '完成现场彩排、应急验证和最终交付',
          status: SprintStatus.planning,
          startDate: '2026-03-19',
          endDate: '2026-03-27'
        }
      ]
    });
  }

  const milestoneCount = await prisma.milestone.count({ where: { projectId: project.id } });
  if (milestoneCount === 0) {
    await prisma.milestone.createMany({
      data: [
        {
          projectId: project.id,
          name: '需求冻结',
          plannedDate: '2026-03-04',
          actualDate: '2026-03-03'
        },
        {
          projectId: project.id,
          name: '联调完成',
          plannedDate: '2026-03-18',
          actualDate: '2026-03-18'
        },
        {
          projectId: project.id,
          name: '现场交付',
          plannedDate: '2026-03-27'
        }
      ]
    });
  }

  const workItemCount = await prisma.workItem.count({ where: { projectId: project.id } });
  if (workItemCount === 0) {
    const wi1 = await prisma.workItem.create({
      data: {
        projectId: project.id,
        title: '完成展项语音主流程开发',
        description: '实现唤醒、导览、知识讲解与兜底回复主链路。',
        type: WorkItemType.todo,
        priority: WorkItemPriority.high,
        status: WorkItemStatus.done,
        creatorId: superAdmin.id,
        assigneeId: rickyUser.id,
        assigneeName: rickyUser.name,
        dueDate: '2026-03-12'
      }
    });
    const wi2 = await prisma.workItem.create({
      data: {
        projectId: project.id,
        title: '联调飞书看板与报警通知',
        description: '打通自动化规则、看板状态同步和群通知链路。',
        type: WorkItemType.issue,
        priority: WorkItemPriority.medium,
        status: WorkItemStatus.in_progress,
        creatorId: superAdmin.id,
        assigneeId: adminUser.id,
        assigneeName: adminUser.name,
        dueDate: '2026-03-20'
      }
    });
    await prisma.workItem.create({
      data: {
        projectId: project.id,
        title: '现场彩排清单复核',
        description: '复核音频、网络、设备、回滚方案与驻场人员安排。',
        type: WorkItemType.todo,
        priority: WorkItemPriority.medium,
        status: WorkItemStatus.todo,
        creatorId: superAdmin.id,
        assigneeId: viewerUser.id,
        assigneeName: viewerUser.name,
        dueDate: '2026-03-24',
        parentId: wi2.id
      }
    });
    await prisma.workItemHistory.createMany({
      data: [
        {
          workItemId: wi1.id,
          field: 'status',
          beforeValue: 'in_progress',
          afterValue: 'done',
          changedById: rickyUser.id
        },
        {
          workItemId: wi2.id,
          field: 'assignee',
          beforeValue: '',
          afterValue: adminUser.name,
          changedById: superAdmin.id
        }
      ]
    });
  }

  const testCaseCount = await prisma.testCase.count({ where: { projectId: project.id } });
  let smokeCaseId: number | null = null;
  let failoverCaseId: number | null = null;
  if (testCaseCount === 0) {
    const smokeCase = await prisma.testCase.create({
      data: {
        projectId: project.id,
        organizationId: defaultOrg.id,
        title: '展项主流程冒烟测试',
        description: '验证唤醒、导览、知识讲解、播报和结束语。',
        preconditions: '部署预发环境，飞书/语音服务可用。',
        expectedResult: '主流程 3 分钟内顺畅完成，无阻塞。',
        priority: TestCasePriority.critical,
        status: TestCaseStatus.active,
        creatorId: superAdmin.id,
        steps: [
          { step: 1, action: '进入展项首页并触发唤醒' },
          { step: 2, action: '执行导览问答与知识讲解' },
          { step: 3, action: '检查播报与日志回传' }
        ]
      }
    });
    const failoverCase = await prisma.testCase.create({
      data: {
        projectId: project.id,
        organizationId: defaultOrg.id,
        title: '网络异常降级与兜底',
        description: '验证弱网条件下的兜底回复与降级策略。',
        preconditions: '限制网络带宽，模拟上游波动。',
        expectedResult: '系统可返回兜底提示，日志记录完整。',
        priority: TestCasePriority.high,
        status: TestCaseStatus.active,
        creatorId: adminUser.id,
        steps: [
          { step: 1, action: '模拟上游超时' },
          { step: 2, action: '发起讲解请求' },
          { step: 3, action: '确认回退语音与告警' }
        ]
      }
    });
    smokeCaseId = smokeCase.id;
    failoverCaseId = failoverCase.id;
  } else {
    const cases = await prisma.testCase.findMany({
      where: { projectId: project.id },
      orderBy: { id: 'asc' },
      take: 2
    });
    smokeCaseId = cases[0]?.id ?? null;
    failoverCaseId = cases[1]?.id ?? cases[0]?.id ?? null;
  }

  const testPlanCount = await prisma.testPlan.count({ where: { projectId: project.id } });
  if (testPlanCount === 0 && smokeCaseId && failoverCaseId) {
    const plan = await prisma.testPlan.create({
      data: {
        projectId: project.id,
        organizationId: defaultOrg.id,
        title: '北汽车展 POC 联调测试计划',
        description: '覆盖主链路、弱网降级、彩排前回归。',
        status: TestPlanStatus.active,
        startDate: '2026-03-10',
        endDate: '2026-03-22',
        creatorId: adminUser.id
      }
    });
    await prisma.testPlanItem.createMany({
      data: [
        {
          planId: plan.id,
          testCaseId: smokeCaseId,
          result: 'passed',
          notes: '主链路回归通过',
          executedAt: new Date('2026-03-15T10:00:00+08:00'),
          executorId: adminUser.id
        },
        {
          planId: plan.id,
          testCaseId: failoverCaseId,
          result: 'blocked',
          notes: '需补充异常日志埋点后复测',
          executorId: rickyUser.id
        }
      ]
    });
  }

  const bugCount = await prisma.bug.count({ where: { projectId: project.id } });
  if (bugCount === 0) {
    await prisma.bug.createMany({
      data: [
        {
          projectId: project.id,
          organizationId: defaultOrg.id,
          testCaseId: failoverCaseId,
          title: '弱网场景下播报延迟过高',
          description: '在 4G 限速条件下，讲解播报首包耗时超过 6 秒。',
          steps: '限速到 256kbps 后触发知识讲解',
          severity: BugSeverity.major,
          priority: BugPriority.high,
          status: BugStatus.in_progress,
          assigneeId: rickyUser.id,
          assigneeName: rickyUser.name,
          reporterId: adminUser.id,
          reporterName: adminUser.name,
          createdAt: new Date('2026-03-14T09:00:00+08:00'),
          updatedAt: new Date('2026-03-17T10:00:00+08:00')
        },
        {
          projectId: project.id,
          organizationId: defaultOrg.id,
          testCaseId: smokeCaseId,
          title: '后台日志页筛选条件未持久化',
          description: '切换项目后日志页筛选条件被重置，影响排查效率。',
          steps: '进入日志页设置筛选后切换项目',
          severity: BugSeverity.minor,
          priority: BugPriority.medium,
          status: BugStatus.resolved,
          assigneeId: adminUser.id,
          assigneeName: adminUser.name,
          reporterId: superAdmin.id,
          reporterName: superAdmin.name,
          createdAt: new Date('2026-03-13T09:00:00+08:00'),
          updatedAt: new Date('2026-03-16T18:00:00+08:00'),
          resolvedAt: new Date('2026-03-16T18:00:00+08:00')
        }
      ]
    });
  }

  const wikiCount = await prisma.wikiPage.count({ where: { projectId: project.id } });
  if (wikiCount === 0) {
    const folder = await prisma.wikiPage.create({
      data: {
        projectId: project.id,
        organizationId: defaultOrg.id,
        title: '交付资料',
        content: '北汽车展 POC 项目交付资料目录',
        type: 'folder',
        slug: 'delivery-docs',
        sortOrder: 1,
        creatorId: superAdmin.id
      }
    });
    await prisma.wikiPage.createMany({
      data: [
        {
          projectId: project.id,
          organizationId: defaultOrg.id,
          parentId: folder.id,
          title: '部署说明',
          content: '# 部署说明\n\n1. 启动后端与前端\n2. 校验 Redis / Postgres\n3. 检查飞书集成与自动化规则',
          type: 'document',
          slug: 'deployment-guide',
          sortOrder: 10,
          creatorId: adminUser.id
        },
        {
          projectId: project.id,
          organizationId: defaultOrg.id,
          parentId: folder.id,
          title: '现场应急预案',
          content: '# 现场应急预案\n\n- 语音服务异常时切到兜底播报\n- 飞书写回失败时保留本地审计与重试队列\n- 弱网时启用降级链路',
          type: 'document',
          slug: 'onsite-fallback-plan',
          sortOrder: 20,
          creatorId: rickyUser.id
        }
      ]
    });
  }

  const automationCount = await prisma.automationRule.count({
    where: { organizationId: defaultOrg.id }
  });
  if (automationCount === 0) {
    await prisma.automationRule.createMany({
      data: [
        {
          organizationId: defaultOrg.id,
          name: '高优先级需求创建提醒',
          description: '高优先级需求进入系统后自动通知项目群',
          trigger: AutomationTrigger.requirement_created,
          conditions: { priority: ['high'] },
          actions: [
            {
              type: AutomationAction.send_notification,
              target: 'project_room',
              template: '有新的高优先级需求待处理'
            }
          ],
          enabled: true
        },
        {
          organizationId: defaultOrg.id,
          name: '关键缺陷升级派单',
          description: '出现 critical / blocker 缺陷时自动派单并创建待办',
          trigger: AutomationTrigger.bug_severity_critical,
          conditions: { severities: ['critical', 'blocker'] },
          actions: [
            {
              type: AutomationAction.assign_to_user,
              assignee: 'ricky'
            },
            {
              type: AutomationAction.create_workitem,
              title: '处理关键缺陷'
            }
          ],
          enabled: true
        },
        {
          organizationId: defaultOrg.id,
          name: '里程碑临近提醒',
          description: '交付里程碑前 3 天提醒项目经理与交付负责人',
          trigger: AutomationTrigger.milestone_due_soon,
          conditions: { daysBefore: 3 },
          actions: [
            {
              type: AutomationAction.send_notification,
              target: 'pm_owner',
              template: '里程碑即将到期，请确认现场准备情况'
            }
          ],
          enabled: true
        }
      ]
    });
  }

  const taskCount = await prisma.task.count({ where: { projectId: project.id } });
  if (taskCount === 0) {
    await prisma.task.createMany({
      data: [
        {
          projectId: project.id,
          title: '完成展项脚本确认',
          assignee: '吕琦',
          status: TaskStatus.done,
          plannedStart: '2026-02-27',
          plannedEnd: '2026-03-03'
        },
        {
          projectId: project.id,
          title: '完成联调与彩排',
          assignee: 'Admin User',
          status: TaskStatus.in_progress,
          plannedStart: '2026-03-10',
          plannedEnd: '2026-03-22'
        }
      ]
    });
  }

  const worklogCount = await prisma.worklog.count({ where: { projectId: project.id } });
  if (worklogCount === 0) {
    await prisma.worklog.createMany({
      data: [
        {
          projectId: project.id,
          userId: rickyUser.id,
          assigneeName: rickyUser.name,
          taskTitle: '交互主链路开发',
          weekStart: '2026-03-09',
          weekEnd: '2026-03-15',
          totalDays: 6,
          hours: 48,
          hourlyRate: 350,
          workedOn: '2026-03-15'
        },
        {
          projectId: project.id,
          userId: adminUser.id,
          assigneeName: adminUser.name,
          taskTitle: '联调测试与质量回归',
          weekStart: '2026-03-16',
          weekEnd: '2026-03-22',
          totalDays: 5,
          hours: 40,
          hourlyRate: 280,
          workedOn: '2026-03-22'
        }
      ]
    });
  }

  const notificationCount = await prisma.notification.count({
    where: { projectId: project.id }
  });
  if (notificationCount === 0) {
    await prisma.notification.createMany({
      data: [
        {
          projectId: project.id,
          level: 'info',
          title: '初始化完成',
          message: '北汽车展 POC 项目基础数据已就绪。'
        },
        {
          projectId: project.id,
          level: 'warning',
          title: '联调关注',
          message: '弱网播报延迟问题仍在处理中，请关注缺陷列表。'
        }
      ]
    });
  }

  console.log(
    JSON.stringify(
      {
        organizationId: defaultOrg.id,
        projectId: project.id,
        users: ['superadmin', 'admin', 'user', 'ricky'],
        initialized: true
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
