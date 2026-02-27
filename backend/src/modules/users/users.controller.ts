import { Body, Controller, Get, Param, ParseIntPipe, Patch, Req } from '@nestjs/common';
import { IsIn } from 'class-validator';
import { Roles } from '../auth/roles.decorator';
import { UsersService } from './users.service';

class UpdateUserRoleDto {
  @IsIn(['super_admin', 'project_director', 'project_manager', 'pm', 'lead', 'viewer'])
  role!: 'super_admin' | 'project_director' | 'project_manager' | 'pm' | 'lead' | 'viewer';
}

@Controller('api/v1/users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Roles('pm', 'lead', 'viewer', 'project_manager', 'project_director', 'super_admin')
  @Get()
  list() {
    return this.usersService.list();
  }

  @Roles('super_admin', 'project_director', 'lead')
  @Patch(':id/role')
  updateRole(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateUserRoleDto,
    @Req() req: { user?: { sub?: number; role?: string } }
  ) {
    return this.usersService.updateRole(req.user, id, body.role);
  }
}
