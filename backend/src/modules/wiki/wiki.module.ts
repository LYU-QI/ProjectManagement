import { Module } from '@nestjs/common';
import { WikiController } from './wiki.controller';
import { WikiService } from './wiki.service';
import { PrismaService } from '../../database/prisma.service';
import { AccessModule } from '../access/access.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  controllers: [WikiController],
  providers: [WikiService, PrismaService],
  imports: [AccessModule, AuthModule],
})
export class WikiModule {}
