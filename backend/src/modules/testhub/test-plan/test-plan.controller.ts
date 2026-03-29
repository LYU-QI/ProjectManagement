import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, Req } from '@nestjs/common';
import { Roles } from '../../../modules/auth/roles.decorator';
import {
  CreateTestPlanDto,
  UpdateTestPlanDto,
  ListTestPlanQueryDto,
  AddTestCasesDto,
  ExecuteTestCaseDto
} from './dto/test-plan.dto';
import { TestPlanService } from './test-plan.service';
import { AuthActor } from '../../../modules/access/access.service';

@Controller('api/v1/test-plans')
export class TestPlanController {
  constructor(private readonly service: TestPlanService) {}

  @Get()
  list(
    @Query('projectId', new ParseIntPipe({ optional: true })) projectId: number | undefined,
    @Query('status') status: string | undefined,
    @Query('search') search: string | undefined,
    @Query('page', new ParseIntPipe({ optional: true })) page: number | undefined,
    @Query('pageSize', new ParseIntPipe({ optional: true })) pageSize: number | undefined,
    @Req() req?: { user?: AuthActor }
  ) {
    return this.service.list(req?.user, { projectId, status, search, page, pageSize });
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
    @Body() body: CreateTestPlanDto,
    @Req() req?: { user?: AuthActor }
  ) {
    return this.service.create(req?.user, body);
  }

  @Roles('project_manager', 'member', 'pm', 'super_admin')
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateTestPlanDto,
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

  @Roles('project_manager', 'member', 'pm', 'super_admin')
  @Post(':id/cases')
  addCases(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: AddTestCasesDto,
    @Req() req?: { user?: AuthActor }
  ) {
    return this.service.addCases(req?.user, id, body);
  }

  @Roles('project_manager', 'member', 'pm', 'super_admin')
  @Patch(':planId/cases/:testCaseId')
  executeCase(
    @Param('planId', ParseIntPipe) planId: number,
    @Param('testCaseId', ParseIntPipe) testCaseId: number,
    @Body() body: ExecuteTestCaseDto,
    @Req() req?: { user?: AuthActor }
  ) {
    return this.service.executeCase(req?.user, planId, testCaseId, body);
  }
}
