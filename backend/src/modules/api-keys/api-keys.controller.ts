import { BadRequestException, Body, Controller, Delete, Get, Param, Post, Req } from '@nestjs/common';
import { IsArray, IsOptional, IsString, IsDateString } from 'class-validator';
import { ApiKeysService } from './api-keys.service';

class CreateApiKeyDto {
  @IsString()
  name!: string;

  @IsArray()
  @IsString({ each: true })
  permissions!: string[];
}

@Controller('api/v1/api-keys')
export class ApiKeysController {
  constructor(private readonly apiKeysService: ApiKeysService) {}

  @Get()
  list(@Req() req: any) {
    const orgId = req['org']?.id;
    if (!orgId) return [];
    return this.apiKeysService.list(orgId);
  }

  @Post()
  create(@Body() body: CreateApiKeyDto, @Req() req: any) {
    const orgId = req['org']?.id;
    if (!orgId) throw new BadRequestException('No organization context');
    return this.apiKeysService.generateKey(orgId, body.name, body.permissions);
  }

  @Delete(':id')
  revoke(@Param('id') id: string, @Req() req: any) {
    const orgId = req['org']?.id;
    if (!orgId) throw new BadRequestException('No organization context');
    return this.apiKeysService.revokeKey(id, orgId);
  }
}
