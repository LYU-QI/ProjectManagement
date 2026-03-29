import { Module } from '@nestjs/common';
import { ApiKeysController } from './api-keys.controller';
import { ApiKeysService } from './api-keys.service';
import { PrismaService } from '../../database/prisma.service';

@Module({
  controllers: [ApiKeysController],
  providers: [ApiKeysService, PrismaService]
})
export class ApiKeysModule {}
