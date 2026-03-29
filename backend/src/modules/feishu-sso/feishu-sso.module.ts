import { Module } from '@nestjs/common';
import { FeishuSsoController } from './feishu-sso.controller';
import { FeishuSsoService } from './feishu-sso.service';
import { AuthModule } from '../auth/auth.module';
import { ConfigModule } from '../config/config.module';
import { PrismaService } from '../../database/prisma.service';

@Module({
  imports: [AuthModule, ConfigModule],
  controllers: [FeishuSsoController],
  providers: [FeishuSsoService, PrismaService],
  exports: [FeishuSsoService]
})
export class FeishuSsoModule {}
