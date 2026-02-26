import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    try {
      await this.$connect();
      console.log('✅ 数据库连接成功');
    } catch (err) {
      console.error('❌ 数据库连接失败:', err);
      throw err;
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
    console.log('已断开数据库连接');
  }
}
