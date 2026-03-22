import { AsyncLocalStorage } from 'async_hooks';

export interface OrgContext {
  organizationId: string | null;
  bypassOrgFilter: boolean;
}

export const orgContext = new AsyncLocalStorage<OrgContext>();

/**
 * Run a callback within a specific org context.
 * Use bypassOrgFilter=true for super_admin or system operations.
 */
export function runWithOrgContext<T>(
  context: OrgContext,
  fn: () => T
): T {
  return orgContext.run(context, fn);
}

/**
 * Get current org context (returns undefined if not in an org context).
 */
export function getOrgContext(): OrgContext | undefined {
  return orgContext.getStore();
}

/**
 * Inject org filter into a Prisma query args object (where clause).
 * Returns a new args object with org filtering merged in.
 *
 * For org-scoped models, adds organizationId to where clause.
 * For via-project models, adds project.organizationId to where clause.
 *
 * Pass bypassOrgFilter=true in context to skip injection.
 */
export function injectOrgFilterToArgs(
  args: Record<string, unknown>,
  modelName: string,
  orgId: string | null,
  bypassOrgFilter: boolean
): Record<string, unknown> {
  if (bypassOrgFilter || !orgId) return args;

  const MODELS_WITH_ORG_ID = new Set([
    'Project', 'ProjectMembership', 'AuditLog', 'FeishuUser',
    'RiskRule', 'RiskAlert', 'RiskRuleLog', 'FeishuDependency',
    'OrgMember', 'Organization', 'Config', 'WorkItem', 'MilestoneBoardItem',
  ]);

  const MODELS_VIA_PROJECT = new Set([
    'Requirement', 'CostEntry', 'Worklog', 'Task', 'Notification',
    'PrdDocument', 'Milestone', 'MilestoneBoardDeliverable',
  ]);

  const where = args.where as Record<string, unknown> | undefined;

  if (MODELS_WITH_ORG_ID.has(modelName)) {
    return {
      ...args,
      where: { ...where, organizationId: orgId }
    };
  }

  if (MODELS_VIA_PROJECT.has(modelName)) {
    const existingProject = where?.project as Record<string, unknown> | undefined;
    return {
      ...args,
      where: {
        ...where,
        project: { ...existingProject, organizationId: orgId }
      }
    };
  }

  return args;
}
