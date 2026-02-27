import { Module } from '@nestjs/common';
import { AccessModule } from '../access/access.module';
import { CostsController } from './costs.controller';
import { CostsService } from './costs.service';

@Module({
  imports: [AccessModule],
  controllers: [CostsController],
  providers: [CostsService]
})
export class CostsModule {}
