import { Body, Controller, Get, Param, Post, Put, Req } from '@nestjs/common';
import { Roles } from '../auth/roles.decorator';
import { AuditableRequest } from '../../audit/audit.types';
import { ResourceMaintenanceService } from './resource-maintenance.service';

@Controller('api/v1/resource-maintenance')
@Roles('super_admin', 'project_manager', 'dept_head', 'pm')
export class ResourceMaintenanceController {
  constructor(private readonly service: ResourceMaintenanceService) {}

  @Get('options')
  options(@Req() req: AuditableRequest) {
    return this.service.options(this.actor(req));
  }

  @Get('people')
  listPeople(@Req() req: AuditableRequest) {
    return this.service.listPeople(this.actor(req));
  }

  @Post('people')
  createPerson(@Body() body: Record<string, unknown>, @Req() req: AuditableRequest) {
    return this.service.createPerson(this.actor(req), body, req);
  }

  @Put('people/:recordId')
  updatePerson(@Param('recordId') recordId: string, @Body() body: Record<string, unknown>, @Req() req: AuditableRequest) {
    return this.service.updatePerson(this.actor(req), recordId, body, req);
  }

  @Get('allocations')
  listAllocations(@Req() req: AuditableRequest) {
    return this.service.listAllocations(this.actor(req));
  }

  @Post('allocations')
  createAllocation(@Body() body: Record<string, unknown>, @Req() req: AuditableRequest) {
    return this.service.createAllocation(this.actor(req), body, req);
  }

  @Put('allocations/:recordId')
  updateAllocation(@Param('recordId') recordId: string, @Body() body: Record<string, unknown>, @Req() req: AuditableRequest) {
    return this.service.updateAllocation(this.actor(req), recordId, body, req);
  }

  @Get('availability')
  listAvailability(@Req() req: AuditableRequest) {
    return this.service.listAvailability(this.actor(req));
  }

  @Post('availability')
  createAvailability(@Body() body: Record<string, unknown>, @Req() req: AuditableRequest) {
    return this.service.createAvailability(this.actor(req), body, req);
  }

  @Put('availability/:recordId')
  updateAvailability(@Param('recordId') recordId: string, @Body() body: Record<string, unknown>, @Req() req: AuditableRequest) {
    return this.service.updateAvailability(this.actor(req), recordId, body, req);
  }

  private actor(req: AuditableRequest) {
    return {
      ...req.user,
      organizationId: req.org?.id ?? req.user?.organizationId,
      orgRole: req.org?.orgRole ?? req.user?.orgRole
    };
  }
}
