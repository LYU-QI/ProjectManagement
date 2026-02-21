import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: Array<'pm' | 'lead' | 'viewer'>) => SetMetadata(ROLES_KEY, roles);
