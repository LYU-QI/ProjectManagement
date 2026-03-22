/* eslint-disable @typescript-eslint/no-explicit-any */
import { getOrgContext, injectOrgFilterToArgs } from './org-context';

const MODELS_WITH_ORG_ID = new Set([
  'Project', 'ProjectMembership', 'AuditLog', 'FeishuUser',
  'RiskRule', 'RiskAlert', 'RiskRuleLog', 'FeishuDependency',
  'OrgMember', 'Organization', 'Config', 'WorkItem', 'MilestoneBoardItem',
]);

const MODELS_VIA_PROJECT = new Set([
  'Requirement', 'CostEntry', 'Worklog', 'Task', 'Notification',
  'PrdDocument', 'Milestone', 'MilestoneBoardDeliverable',
]);

/**
 * Creates a Prisma query middleware that injects org filtering.
 * Works by wrapping queries with an org-scoped client from AsyncLocalStorage.
 *
 * NOTE: This requires the PrismaService to use an org-scoped extended client
 * that reads from AsyncLocalStorage. See org-scoped.client.ts for usage.
 */
export function createOrgScopedClient(prismaClient: any): any {
  const orgContext = require('./org-context');

  return prismaClient.$extends({
    query: {
      $allModels: {
        findMany: async ({ model, args, query }: any) => {
          const ctx = orgContext.getOrgContext();
          if (ctx && !ctx.bypassOrgFilter && model) {
            const modelName = model.charAt(0).toUpperCase() + model.slice(1);
            const filteredArgs = orgContext.injectOrgFilterToArgs(
              { ...args },
              modelName,
              ctx.organizationId,
              ctx.bypassOrgFilter
            );
            return query(filteredArgs);
          }
          return query(args);
        },
        findFirst: async ({ model, args, query }: any) => {
          const ctx = orgContext.getOrgContext();
          if (ctx && !ctx.bypassOrgFilter && model) {
            const modelName = model.charAt(0).toUpperCase() + model.slice(1);
            const filteredArgs = orgContext.injectOrgFilterToArgs(
              { ...args },
              modelName,
              ctx.organizationId,
              ctx.bypassOrgFilter
            );
            return query(filteredArgs);
          }
          return query(args);
        },
        findFirstOrThrow: async ({ model, args, query }: any) => {
          const ctx = orgContext.getOrgContext();
          if (ctx && !ctx.bypassOrgFilter && model) {
            const modelName = model.charAt(0).toUpperCase() + model.slice(1);
            const filteredArgs = orgContext.injectOrgFilterToArgs(
              { ...args },
              modelName,
              ctx.organizationId,
              ctx.bypassOrgFilter
            );
            return query(filteredArgs);
          }
          return query(args);
        },
        findUnique: async ({ model, args, query }: any) => {
          const ctx = orgContext.getOrgContext();
          if (ctx && !ctx.bypassOrgFilter && model) {
            const modelName = model.charAt(0).toUpperCase() + model.slice(1);
            const filteredArgs = orgContext.injectOrgFilterToArgs(
              { ...args },
              modelName,
              ctx.organizationId,
              ctx.bypassOrgFilter
            );
            return query(filteredArgs);
          }
          return query(args);
        },
        findUniqueOrThrow: async ({ model, args, query }: any) => {
          const ctx = orgContext.getOrgContext();
          if (ctx && !ctx.bypassOrgFilter && model) {
            const modelName = model.charAt(0).toUpperCase() + model.slice(1);
            const filteredArgs = orgContext.injectOrgFilterToArgs(
              { ...args },
              modelName,
              ctx.organizationId,
              ctx.bypassOrgFilter
            );
            return query(filteredArgs);
          }
          return query(args);
        },
        count: async ({ model, args, query }: any) => {
          const ctx = orgContext.getOrgContext();
          if (ctx && !ctx.bypassOrgFilter && model) {
            const modelName = model.charAt(0).toUpperCase() + model.slice(1);
            const filteredArgs = orgContext.injectOrgFilterToArgs(
              { ...args },
              modelName,
              ctx.organizationId,
              ctx.bypassOrgFilter
            );
            return query(filteredArgs);
          }
          return query(args);
        },
        updateMany: async ({ model, args, query }: any) => {
          const ctx = orgContext.getOrgContext();
          if (ctx && !ctx.bypassOrgFilter && model) {
            const modelName = model.charAt(0).toUpperCase() + model.slice(1);
            const filteredArgs = orgContext.injectOrgFilterToArgs(
              { ...args },
              modelName,
              ctx.organizationId,
              ctx.bypassOrgFilter
            );
            return query(filteredArgs);
          }
          return query(args);
        },
        deleteMany: async ({ model, args, query }: any) => {
          const ctx = orgContext.getOrgContext();
          if (ctx && !ctx.bypassOrgFilter && model) {
            const modelName = model.charAt(0).toUpperCase() + model.slice(1);
            const filteredArgs = orgContext.injectOrgFilterToArgs(
              { ...args },
              modelName,
              ctx.organizationId,
              ctx.bypassOrgFilter
            );
            return query(filteredArgs);
          }
          return query(args);
        },
        aggregate: async ({ model, args, query }: any) => {
          const ctx = orgContext.getOrgContext();
          if (ctx && !ctx.bypassOrgFilter && model) {
            const modelName = model.charAt(0).toUpperCase() + model.slice(1);
            const filteredArgs = orgContext.injectOrgFilterToArgs(
              { ...args },
              modelName,
              ctx.organizationId,
              ctx.bypassOrgFilter
            );
            return query(filteredArgs);
          }
          return query(args);
        },
      },
      // For create operations, inject organizationId into data
      $allOperations: async ({ model, operation, args, query }: any) => {
        if (!MODELS_WITH_ORG_ID.has(model)) return query(args);
        if (operation !== 'create' && operation !== 'upsert') return query(args);

        const ctx = orgContext.getOrgContext();
        if (!ctx || ctx.bypassOrgFilter || !ctx.organizationId) return query(args);

        const data = args.data as Record<string, unknown> | undefined;
        if (!data || data.organizationId !== undefined) return query(args);

        return query({ ...args, data: { ...data, organizationId: ctx.organizationId } });
      },
    },
  });
}
