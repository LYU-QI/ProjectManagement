import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, ParseIntPipe } from '@nestjs/common';
import { FeishuUsersService } from './feishu-users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('api/v1/feishu-users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FeishuUsersController {
    constructor(private readonly feishuUsersService: FeishuUsersService) { }

    @Get()
    async findAll() {
        return this.feishuUsersService.findAll();
    }

    @Post()
    @Roles('pm', 'lead')
    async create(@Body() body: { name: string; openId: string }) {
        return this.feishuUsersService.create(body);
    }

    @Put(':id')
    @Roles('pm', 'lead')
    async update(@Param('id', ParseIntPipe) id: number, @Body() body: { name?: string; openId?: string }) {
        return this.feishuUsersService.update(id, body);
    }

    @Delete(':id')
    @Roles('pm', 'lead')
    async remove(@Param('id', ParseIntPipe) id: number) {
        return this.feishuUsersService.remove(id);
    }
}
