import { BadRequestException, Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, Req } from '@nestjs/common';
import { IsArray, IsBoolean, IsOptional, IsString } from 'class-validator';
import { WebhooksService } from './webhooks.service';

class CreateWebhookDto {
  @IsString()
  name!: string;

  @IsString()
  url!: string;

  @IsOptional()
  @IsString()
  secret?: string;

  @IsArray()
  @IsString({ each: true })
  events!: string[];
}

class UpdateWebhookDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  url?: string;

  @IsOptional()
  @IsString()
  secret?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  events?: string[];

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

@Controller('api/v1/webhooks')
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  @Get()
  list(@Req() req: any) {
    const orgId = req['org']?.id;
    return this.webhooksService.list(orgId);
  }

  @Post()
  create(@Body() body: CreateWebhookDto, @Req() req: any) {
    const orgId = req['org']?.id;
    if (!orgId) throw new BadRequestException('No organization context');
    return this.webhooksService.create(orgId, body);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: UpdateWebhookDto, @Req() req: any) {
    const orgId = req['org']?.id;
    if (!orgId) throw new BadRequestException('No organization context');
    return this.webhooksService.update(id, orgId, body);
  }

  @Delete(':id')
  delete(@Param('id') id: string, @Req() req: any) {
    const orgId = req['org']?.id;
    if (!orgId) throw new BadRequestException('No organization context');
    return this.webhooksService.delete(id, orgId);
  }

  @Get(':id/deliveries')
  getDeliveries(
    @Param('id') id: string,
    @Query('page') pageRaw?: string,
    @Query('limit') limitRaw?: string,
    @Req() req?: any
  ) {
    const orgId = req?.['org']?.id;
    const page = pageRaw ? Math.max(1, parseInt(pageRaw, 10)) : 1;
    const limit = limitRaw ? Math.min(100, Math.max(1, parseInt(limitRaw, 10))) : 20;
    return this.webhooksService.getDeliveries(id, orgId, page, limit);
  }

  @Post(':id/test')
  testWebhook(@Param('id') id: string, @Req() req: any) {
    const orgId = req['org']?.id;
    if (!orgId) throw new BadRequestException('No organization context');
    return this.webhooksService.testWebhook(id, orgId);
  }
}
