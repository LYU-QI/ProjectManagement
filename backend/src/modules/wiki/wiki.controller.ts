import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req
} from '@nestjs/common';
import { WikiService } from './wiki.service';
import { CreateWikiPageDto, ListWikiPageQueryDto, UpdateWikiPageDto } from './wiki.dto';
import { AccessService } from '../access/access.service';
import { Roles } from '../auth/roles.decorator';

@Controller('api/v1/wiki')
export class WikiController {
  constructor(
    private readonly wikiService: WikiService,
    private readonly accessService: AccessService
  ) {}

  @Get('pages')
  async list(@Query() query: ListWikiPageQueryDto) {
    if (!query.projectId) return [];
    return this.wikiService.list(query.projectId);
  }

  @Get('pages/:id')
  async getOne(@Param('id', ParseIntPipe) id: number) {
    const page = await this.wikiService.findById(id);
    if (!page) throw new BadRequestException('页面不存在');
    return page;
  }

  @Post('pages')
  @Roles('project_manager', 'member', 'pm', 'super_admin')
  async create(
    @Body() body: CreateWikiPageDto,
    @Req() req: { user?: { sub?: number; role?: string } }
  ) {
    await this.accessService.assertProjectAccess(req.user as any, body.projectId);
    return this.wikiService.create(body);
  }

  @Patch('pages/:id')
  @Roles('project_manager', 'member', 'pm', 'super_admin')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateWikiPageDto,
    @Req() req: { user?: { sub?: number; role?: string } }
  ) {
    const page = await this.wikiService.findById(id);
    if (!page) throw new BadRequestException('页面不存在');
    await this.accessService.assertProjectAccess(req.user as any, page.projectId);
    return this.wikiService.update(id, body);
  }

  @Delete('pages/:id')
  @Roles('project_manager', 'member', 'pm', 'super_admin')
  async delete(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: { user?: { sub?: number; role?: string } }
  ) {
    const page = await this.wikiService.findById(id);
    if (!page) throw new BadRequestException('页面不存在');
    await this.accessService.assertProjectAccess(req.user as any, page.projectId);
    return this.wikiService.delete(id);
  }
}
