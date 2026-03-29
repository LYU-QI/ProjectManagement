import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, Req } from '@nestjs/common';
import { Roles } from '../../../modules/auth/roles.decorator';
import { CreateTestCaseDto, UpdateTestCaseDto } from './dto/test-case.dto';
import { TestCaseService } from './test-case.service';
import { AuthActor } from '../../../modules/access/access.service';

@Controller('api/v1/test-cases')
export class TestCaseController {
  constructor(private readonly service: TestCaseService) {}

  @Get()
  list(
    @Query('projectId', new ParseIntPipe({ optional: true })) projectId: number | undefined,
    @Query('status') status: string | undefined,
    @Query('priority') priority: string | undefined,
    @Query('search') search: string | undefined,
    @Query('tags') tags: string | undefined,
    @Query('page', new ParseIntPipe({ optional: true })) page: number | undefined,
    @Query('pageSize', new ParseIntPipe({ optional: true })) pageSize: number | undefined,
    @Req() req?: { user?: AuthActor }
  ) {
    return this.service.list(req?.user, { projectId, status, priority, search, tags, page, pageSize });
  }

  @Get(':id')
  findById(
    @Param('id', ParseIntPipe) id: number,
    @Req() req?: { user?: AuthActor }
  ) {
    return this.service.findById(req?.user, id);
  }

  @Roles('project_manager', 'member', 'pm', 'super_admin')
  @Post()
  create(
    @Body() body: CreateTestCaseDto,
    @Req() req?: { user?: AuthActor }
  ) {
    return this.service.create(req?.user, body);
  }

  @Roles('project_manager', 'member', 'pm', 'super_admin')
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateTestCaseDto,
    @Req() req?: { user?: AuthActor }
  ) {
    return this.service.update(req?.user, id, body);
  }

  @Roles('project_manager', 'member', 'pm', 'super_admin')
  @Delete(':id')
  remove(
    @Param('id', ParseIntPipe) id: number,
    @Req() req?: { user?: AuthActor }
  ) {
    return this.service.remove(req?.user, id);
  }
}
