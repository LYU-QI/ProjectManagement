import { Body, Controller, ForbiddenException, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ConfigService } from './config.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

/**
 * 系统配置控制器
 * 正式权限模型：
 * - pm / project_manager / super_admin：可查看掩码配置列表
 * - super_admin：可查看敏感原值、可保存
 */
@Controller('api/v1/config')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ConfigController {
    constructor(private readonly configService: ConfigService) { }

    /**
     * 获取所有配置项
     * @param reveal 是否显示敏感字段的真实值
     */
    @Roles('project_manager', 'pm', 'super_admin')
    @Get()
    getAll(
        @Query('reveal') reveal?: string,
        @Req() req?: { user?: { role?: string } }
    ) {
        if (reveal === 'true') {
            if (req?.user?.role !== 'super_admin') {
                throw new ForbiddenException('Only super_admin can reveal sensitive config values');
            }
            return this.configService.getAllRaw();
        }
        return this.configService.getAll();
    }

    /**
     * 批量更新配置项
     */
    @Roles('super_admin')
    @Post()
    updateAll(@Body() body: Record<string, string>) {
        return this.configService.updateAll(body);
    }
}
