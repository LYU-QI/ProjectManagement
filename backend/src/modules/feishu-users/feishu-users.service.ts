import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class FeishuUsersService {
    constructor(private prisma: PrismaService) { }

    async findAll() {
        return this.prisma.feishuUser.findMany({
            orderBy: { createdAt: 'desc' }
        });
    }

    async create(data: Prisma.FeishuUserCreateInput) {
        const exists = await this.prisma.feishuUser.findUnique({
            where: { name: data.name }
        });
        if (exists) {
            throw new ConflictException(`User with name ${data.name} already exists.`);
        }
        return this.prisma.feishuUser.create({
            data
        });
    }

    async update(id: number, data: Prisma.FeishuUserUpdateInput) {
        if (data.name) {
            const exists = await this.prisma.feishuUser.findFirst({
                where: { name: data.name as string, id: { not: id } }
            });
            if (exists) {
                throw new ConflictException(`User with name ${data.name} already exists.`);
            }
        }
        try {
            return await this.prisma.feishuUser.update({
                where: { id },
                data
            });
        } catch (error) {
            throw new NotFoundException(`FeishuUser with ID ${id} not found.`);
        }
    }

    async remove(id: number) {
        try {
            return await this.prisma.feishuUser.delete({
                where: { id }
            });
        } catch (error) {
            throw new NotFoundException(`FeishuUser with ID ${id} not found.`);
        }
    }

    // 内部供 FeishuService 消费快速拉取 map 映射表
    async getNameToOpenIdMap(): Promise<Record<string, string>> {
        const users = await this.findAll();
        return users.reduce((acc, user) => {
            acc[user.name] = user.openId;
            return acc;
        }, {} as Record<string, string>);
    }

    // 自动名册收集：批量存入或更新用户信息
    async upsertMany(users: { name: string; openId: string }[]) {
        if (!users.length) return;

        for (const user of users) {
            if (!user.name || !user.openId) continue;

            // 姓名作为唯一键进行 upsert
            await this.prisma.feishuUser.upsert({
                where: { name: user.name },
                update: { openId: user.openId },
                create: { name: user.name, openId: user.openId }
            });
        }
    }
}
