import { Module } from '@nestjs/common';
import { ConfigController } from './config.controller';
import { ConfigService } from './config.service';
import { AuthModule } from '../auth/auth.module';

/**
 * 系统配置模块
 */
@Module({
    imports: [AuthModule],
    controllers: [ConfigController],
    providers: [ConfigService],
})
export class ConfigModule { }
