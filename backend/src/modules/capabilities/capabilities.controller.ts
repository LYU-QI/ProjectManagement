import { Body, Controller, Get, Post, Query, Req } from '@nestjs/common';
import { IsBoolean, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';
import { CapabilitiesService } from './capabilities.service';

class UpsertCapabilityTemplateDto {
  @IsString()
  @IsNotEmpty()
  scene!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  systemPrompt?: string;

  @IsOptional()
  @IsString()
  userPromptTemplate?: string;

  @IsOptional()
  @IsNumber()
  projectId?: number;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

@Controller('api/v1/capabilities')
export class CapabilitiesController {
  constructor(private readonly capabilitiesService: CapabilitiesService) {}

  @Get('templates')
  list(
    @Query('scene') scene: string | undefined,
    @Query('projectId') projectIdRaw: string | undefined,
    @Req() req: Record<string, unknown>
  ) {
    const org = req.org as { id?: string | null } | undefined;
    const projectId = projectIdRaw ? Number(projectIdRaw) : undefined;
    return this.capabilitiesService.list({
      organizationId: org?.id ?? undefined,
      projectId,
      scene
    });
  }

  @Post('templates')
  upsert(@Body() body: UpsertCapabilityTemplateDto, @Req() req: Record<string, unknown>) {
    const org = req.org as { id?: string | null } | undefined;
    return this.capabilitiesService.upsert({
      organizationId: org?.id ?? undefined,
      projectId: body.projectId,
      scene: body.scene,
      name: body.name,
      description: body.description,
      systemPrompt: body.systemPrompt,
      userPromptTemplate: body.userPromptTemplate,
      enabled: body.enabled
    });
  }
}
