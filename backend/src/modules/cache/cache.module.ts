import { Module, Global } from '@nestjs/common';
import { RedisService } from './cache.service';

@Global()
@Module({
  providers: [RedisService],
  exports: [RedisService]
})
export class CacheModule {}
