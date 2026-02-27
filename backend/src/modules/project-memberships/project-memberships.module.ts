import { Module } from '@nestjs/common';
import { AccessModule } from '../access/access.module';
import { ProjectMembershipsController } from './project-memberships.controller';
import { ProjectMembershipsService } from './project-memberships.service';

@Module({
  imports: [AccessModule],
  controllers: [ProjectMembershipsController],
  providers: [ProjectMembershipsService]
})
export class ProjectMembershipsModule { }

