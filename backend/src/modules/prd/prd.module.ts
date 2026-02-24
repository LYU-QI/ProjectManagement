import { Module } from '@nestjs/common';
import { PrdController } from './prd.controller';
import { PrdService } from './prd.service';
import { PrismaService } from '../../database/prisma.service';

@Module({
  controllers: [PrdController],
  providers: [PrdService, PrismaService]
})
export class PrdModule {}
