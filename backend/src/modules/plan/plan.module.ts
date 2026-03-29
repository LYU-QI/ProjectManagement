import { Module } from '@nestjs/common';
import { PlanController } from './plan.controller';
import { PlanLimitService } from './plan.service';
import { PrismaService } from '../../database/prisma.service';

@Module({
  controllers: [PlanController],
  providers: [PlanLimitService, PrismaService],
  exports: [PlanLimitService]
})
export class PlanModule {}
