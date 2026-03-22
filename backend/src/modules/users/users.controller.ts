import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Req } from '@nestjs/common';
import { IsIn, IsNotEmpty, MinLength } from 'class-validator';
import { Roles } from '../auth/roles.decorator';
import { UsersService } from './users.service';

class UpdateUserRoleDto {
  @IsIn(['super_admin', 'project_manager', 'pm', 'member', 'viewer'])
  role!: 'super_admin' | 'project_manager' | 'pm' | 'member' | 'viewer';
}

class CreateUserDto {
  @IsNotEmpty()
  username!: string;

  @IsNotEmpty()
  name!: string;

  @IsNotEmpty()
  @MinLength(6)
  password!: string;

  @IsIn(['super_admin', 'project_manager', 'pm', 'member', 'viewer'])
  role!: 'super_admin' | 'project_manager' | 'pm' | 'member' | 'viewer';
}

class ResetPasswordDto {
  @IsNotEmpty()
  @MinLength(6)
  password!: string;
}

@Controller('api/v1/users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Roles('super_admin', 'project_manager', 'pm', 'member', 'viewer')
  @Get()
  list() {
    return this.usersService.list();
  }

  @Roles('super_admin', 'project_manager')
  @Post()
  create(
    @Body() body: CreateUserDto,
    @Req() req: { user?: { sub?: number; role?: string } }
  ) {
    return this.usersService.createUser(req.user, body);
  }

  @Roles('super_admin', 'project_manager')
  @Patch(':id/role')
  updateRole(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateUserRoleDto,
    @Req() req: { user?: { sub?: number; role?: string } }
  ) {
    return this.usersService.updateRole(req.user, id, body.role);
  }

  @Roles('super_admin', 'project_manager')
  @Patch(':id/password')
  resetPassword(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: ResetPasswordDto,
    @Req() req: { user?: { sub?: number; role?: string } }
  ) {
    return this.usersService.resetPassword(req.user, id, body.password);
  }
}
