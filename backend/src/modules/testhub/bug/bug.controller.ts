import { Body, Controller, Delete, Get, Header, Param, ParseIntPipe, Patch, Post, Query, Req, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { Roles } from '../../../modules/auth/roles.decorator';
import { CreateBugDto, UpdateBugDto } from './dto/bug.dto';
import { BugService } from './bug.service';
import { AuthActor } from '../../../modules/access/access.service';

@Controller('api/v1/bugs')
export class BugController {
  constructor(private readonly service: BugService) {}

  @Get()
  list(
    @Query('projectId', new ParseIntPipe({ optional: true })) projectId: number | undefined,
    @Query('status') status: string | undefined,
    @Query('severity') severity: string | undefined,
    @Query('priority') priority: string | undefined,
    @Query('assigneeId', new ParseIntPipe({ optional: true })) assigneeId: number | undefined,
    @Query('search') search: string | undefined,
    @Query('page', new ParseIntPipe({ optional: true })) page: number | undefined,
    @Query('pageSize', new ParseIntPipe({ optional: true })) pageSize: number | undefined,
    @Req() req?: { user?: AuthActor }
  ) {
    return this.service.list(req?.user, { projectId, status, severity, priority, assigneeId, search, page, pageSize });
  }

  @Get('export')
  @Header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  async exportExcel(
    @Query('projectId', new ParseIntPipe({ optional: true })) projectId: number | undefined,
    @Query('status') status: string | undefined,
    @Query('severity') severity: string | undefined,
    @Query('priority') priority: string | undefined,
    @Query('assigneeId', new ParseIntPipe({ optional: true })) assigneeId: number | undefined,
    @Query('search') search: string | undefined,
    @Res() res: Response,
    @Req() req?: { user?: AuthActor }
  ) {
    const buffer = await this.service.exportExcel(req?.user, { projectId, status, severity, priority, assigneeId, search });
    res.setHeader('Content-Disposition', 'attachment; filename="bugs.xlsx"');
    res.end(buffer);
  }

  @Roles('project_manager', 'member', 'pm', 'super_admin')
  @Post('import')
  @UseInterceptors(FileInterceptor('file'))
  importExcel(
    @Query('projectId', ParseIntPipe) projectId: number,
    @UploadedFile() file: Express.Multer.File,
    @Req() req?: { user?: AuthActor }
  ) {
    return this.service.importExcel(req?.user, projectId, file);
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
    @Body() body: CreateBugDto,
    @Req() req?: { user?: AuthActor }
  ) {
    return this.service.create(req?.user, body);
  }

  @Roles('project_manager', 'member', 'pm', 'super_admin')
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateBugDto,
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
