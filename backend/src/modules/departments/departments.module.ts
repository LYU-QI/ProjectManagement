import { Module } from '@nestjs/common';
import { DepartmentsController } from './departments.controller';
import { DepartmentsService } from './departments.service';
import { FeishuModule } from '../feishu/feishu.module';
import { AccessModule } from '../access/access.module';
import { PrismaService } from '../../database/prisma.service';

@Module({
  imports: [FeishuModule, AccessModule],
  controllers: [DepartmentsController],
  providers: [DepartmentsService, PrismaService],
  exports: [DepartmentsService]
})
export class DepartmentsModule {}
