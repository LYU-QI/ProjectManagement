import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { Prisma } from '@prisma/client';
import { getOrgContext } from '../../prisma/org-context';

@Injectable()
export class FeishuUsersService {
    constructor(private prisma: PrismaService) { }

    private getOrgId(): string | null {
      return getOrgContext()?.organizationId ?? null;
    }

    async findAll() {
        return this.prisma.feishuUser.findMany({
            where: { organizationId: this.getOrgId() },
            orderBy: { createdAt: 'desc' }
        });
    }

    async create(data: Prisma.FeishuUserCreateInput) {
        const orgId = this.getOrgId();
        const exists = await this.prisma.feishuUser.findFirst({
            where: { name: data.name as string, organizationId: orgId }
        });
        if (exists) {
            throw new ConflictException(`User with name ${data.name} already exists.`);
        }
        return this.prisma.feishuUser.create({
            data: { ...data, organizationId: orgId }
        });
    }

    async update(id: number, data: Prisma.FeishuUserUpdateInput) {
        if (data.name) {
            const orgId = this.getOrgId();
            const exists = await this.prisma.feishuUser.findFirst({
                where: { name: data.name as string, id: { not: id }, organizationId: orgId }
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

        const orgId = this.getOrgId();
        for (const user of users) {
            if (!user.name || !user.openId) continue;

            const existing = await this.prisma.feishuUser.findFirst({
                where: { name: user.name, organizationId: orgId }
            });
            if (existing) {
                await this.prisma.feishuUser.update({
                    where: { id: existing.id },
                    data: { openId: user.openId }
                });
            } else {
                await this.prisma.feishuUser.create({
                    data: { name: user.name, openId: user.openId, organizationId: orgId }
                });
            }
        }
    }
}
