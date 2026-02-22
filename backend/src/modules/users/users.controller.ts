import { Controller, Get } from '@nestjs/common';
import { Roles } from '../auth/roles.decorator';
import { UsersService } from './users.service';

@Controller('api/v1/users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Roles('pm', 'lead', 'viewer')
  @Get()
  list() {
    return this.usersService.list();
  }
}
