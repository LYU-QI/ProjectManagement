import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Req } from '@nestjs/common';
import { IsIn, IsNotEmpty, MinLength } from 'class-validator';
import { Roles } from '../auth/roles.decorator';
import { UsersService } from './users.service';

class UpdateUserRoleDto {
  @IsIn(['super_admin', 'project_director', 'project_manager', 'pm', 'lead', 'viewer'])
  role!: 'super_admin' | 'project_director' | 'project_manager' | 'pm' | 'lead' | 'viewer';
}

class CreateUserDto {
  @IsNotEmpty()
  username!: string;

  @IsNotEmpty()
  name!: string;

  @IsNotEmpty()
  @MinLength(6)
  password!: string;

  @IsIn(['super_admin', 'project_director', 'project_manager', 'pm', 'lead', 'viewer'])
  role!: 'super_admin' | 'project_director' | 'project_manager' | 'pm' | 'lead' | 'viewer';
}

class ResetPasswordDto {
  @IsNotEmpty()
  @MinLength(6)
  password!: string;
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
  @Post()
  create(
    @Body() body: CreateUserDto,
    @Req() req: { user?: { sub?: number; role?: string } }
  ) {
    return this.usersService.createUser(req.user, body);
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

  @Roles('super_admin', 'project_director', 'lead')
  @Patch(':id/password')
  resetPassword(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: ResetPasswordDto,
    @Req() req: { user?: { sub?: number; role?: string } }
  ) {
    return this.usersService.resetPassword(req.user, id, body.password);
  }
}
