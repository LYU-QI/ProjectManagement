import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

interface UpsertTemplateInput {
  organizationId?: string;
  projectId?: number;
  scene: string;
  name: string;
  description?: string;
  systemPrompt?: string;
  userPromptTemplate?: string;
  enabled?: boolean;
}

@Injectable()
export class CapabilitiesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(params: { organizationId?: string; projectId?: number; scene?: string }) {
    return this.prisma.capabilityTemplate.findMany({
      where: {
        ...(params.organizationId ? { organizationId: params.organizationId } : {}),
        ...(params.projectId ? { projectId: params.projectId } : { projectId: null }),
        ...(params.scene ? { scene: params.scene } : {})
      },
      orderBy: [{ scene: 'asc' }, { updatedAt: 'desc' }]
    });
  }

  async upsert(input: UpsertTemplateInput) {
    if (!input.organizationId && !input.projectId) {
      throw new BadRequestException('organizationId 或 projectId 至少需要一个');
    }
    if (input.projectId) {
      const project = await this.prisma.project.findUnique({
        where: { id: input.projectId },
        select: { organizationId: true }
      });
      if (!project) {
        throw new NotFoundException(`项目不存在: ${input.projectId}`);
      }
      input.organizationId = input.organizationId ?? project.organizationId;
    }

    const existing = await this.prisma.capabilityTemplate.findFirst({
      where: {
        organizationId: input.organizationId ?? undefined,
        projectId: input.projectId ?? undefined,
        scene: input.scene,
        name: input.name
      }
    });

    if (existing) {
      return this.prisma.capabilityTemplate.update({
        where: { id: existing.id },
        data: {
          description: input.description ?? null,
          systemPrompt: input.systemPrompt ?? null,
          userPromptTemplate: input.userPromptTemplate ?? null,
          enabled: input.enabled ?? true
        }
      });
    }

    return this.prisma.capabilityTemplate.create({
      data: {
        organizationId: input.organizationId ?? null,
        projectId: input.projectId ?? null,
        scene: input.scene,
        name: input.name,
        description: input.description ?? null,
        systemPrompt: input.systemPrompt ?? null,
        userPromptTemplate: input.userPromptTemplate ?? null,
        enabled: input.enabled ?? true
      }
    });
  }

  async resolve(scene: string, params: { organizationId?: string; projectId?: number }) {
    if (params.projectId) {
      const projectTemplate = await this.prisma.capabilityTemplate.findFirst({
        where: {
          projectId: params.projectId,
          scene,
          enabled: true
        },
        orderBy: { updatedAt: 'desc' }
      });
      if (projectTemplate) return projectTemplate;
    }

    if (params.organizationId) {
      const orgTemplate = await this.prisma.capabilityTemplate.findFirst({
        where: {
          organizationId: params.organizationId,
          projectId: null,
          scene,
          enabled: true
        },
        orderBy: { updatedAt: 'desc' }
      });
      if (orgTemplate) return orgTemplate;
    }

    return null;
  }
}
