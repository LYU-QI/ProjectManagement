import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: Array<
  'super_admin' | 'project_manager' | 'member' | 'pm' | 'viewer'
>) => SetMetadata(ROLES_KEY, roles);
