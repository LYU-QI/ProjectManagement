import { IsString, IsEnum, IsOptional } from 'class-validator';

export class InviteMemberDto {
  @IsString()
  @IsString()
  userId!: string;

  @IsOptional()
  @IsEnum(['owner', 'admin', 'member', 'viewer'])
  role?: 'owner' | 'admin' | 'member' | 'viewer';
}

export class UpdateMemberRoleDto {
  @IsEnum(['owner', 'admin', 'member', 'viewer'])
  role!: 'owner' | 'admin' | 'member' | 'viewer';
}
