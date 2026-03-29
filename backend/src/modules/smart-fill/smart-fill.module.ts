import { Module } from '@nestjs/common';
import { SmartFillController } from './smart-fill.controller';
import { SmartFillService } from './smart-fill.service';
import { ConfigService } from '../config/config.service';
import { PrismaService } from '../../database/prisma.service';

@Module({
  controllers: [SmartFillController],
  providers: [SmartFillService, ConfigService, PrismaService]
})
export class SmartFillModule {}
