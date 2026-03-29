import { Controller, Get, Patch, Param, Body, Req, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { SkipOrgGuard } from '../auth/skip-org-guard.decorator';
import { Plan } from '@prisma/client';

class UpdatePlanDto {
  plan!: Plan;
}

@Controller('api/v1/organizations')
export class PlanController {
  constructor(private readonly prisma: PrismaService) {}

  @SkipOrgGuard()
  @Get(':id/plan')
  async getPlan(@Param('id') id: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id },
      select: { id: true, plan: true, maxMembers: true }
    });
    if (!org) {
      throw new ForbiddenException('Organization not found');
    }
    return org;
  }

  @SkipOrgGuard()
  @Patch(':id/plan')
  async updatePlan(
    @Param('id') id: string,
    @Body() dto: UpdatePlanDto,
    @Req() req: Record<string, unknown>
  ) {
    const globalRole = (req.user as { role?: string } | undefined)?.role;
    if (globalRole !== 'super_admin') {
      throw new ForbiddenException('Only super_admin can change plan');
    }
    return this.prisma.organization.update({
      where: { id },
      data: { plan: dto.plan }
    });
  }
}
