import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ConfigService } from './config.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

/**
 * 系统配置控制器
 * 仅 pm 和 lead 角色可访问
 */
@Controller('api/v1/config')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('pm', 'lead')
export class ConfigController {
    constructor(private readonly configService: ConfigService) { }

    /**
     * 获取所有配置项
     * @param reveal 是否显示敏感字段的真实值
     */
    @Get()
    getAll(@Query('reveal') reveal?: string) {
        if (reveal === 'true') {
            return this.configService.getAllRaw();
        }
        return this.configService.getAll();
    }

    /**
     * 批量更新配置项
     */
    @Post()
    updateAll(@Body() body: Record<string, string>) {
        return this.configService.updateAll(body);
    }
}
