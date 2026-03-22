import { SetMetadata } from '@nestjs/common';

export const IS_ORG_SCOPED_KEY = 'isOrgScoped';
/**
 * 标记此路由不需要组织上下文（如 /organizations 列表需要在选择组织前访问）
 * JwtAuthGuard 仍会执行，只有 OrgGuard 会跳过
 */
export const SkipOrgGuard = () => SetMetadata(IS_ORG_SCOPED_KEY, true);
