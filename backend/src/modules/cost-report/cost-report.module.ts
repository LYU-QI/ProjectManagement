import { Module } from '@nestjs/common';
import { CostReportController } from './cost-report.controller';
import { CostReportService } from './cost-report.service';
import { AccessModule } from '../access/access.module';
import { PrismaService } from '../../database/prisma.service';

@Module({
  imports: [AccessModule],
  controllers: [CostReportController],
  providers: [CostReportService, PrismaService],
  exports: [CostReportService]
})
export class CostReportModule {}
