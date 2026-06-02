import { Module } from '@nestjs/common';
import { DepartmentsController } from './departments.controller';
import { DepartmentsService } from './departments.service';
import { AccessModule } from '../access/access.module';
import { PrismaService } from '../../database/prisma.service';

@Module({
  imports: [AccessModule],
  controllers: [DepartmentsController],
  providers: [DepartmentsService, PrismaService],
  exports: [DepartmentsService]
})
export class DepartmentsModule {}
